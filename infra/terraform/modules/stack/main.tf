terraform {
  required_providers {
    scaleway = { source = "scaleway/scaleway", version = "~> 2.50" }
    random   = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

locals {
  name = "depano-${var.env}"
}

# --- Réseau privé : Postgres et Redis ne sont pas exposés sur Internet ---
resource "scaleway_vpc" "main" {
  name = local.name
}

resource "scaleway_vpc_private_network" "main" {
  name   = local.name
  vpc_id = scaleway_vpc.main.id
}

# --- PostgreSQL managé (PostGIS disponible), sauvegardes quotidiennes chiffrées ---
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "scaleway_rdb_instance" "main" {
  name                      = local.name
  node_type                 = var.db_node_type
  engine                    = "PostgreSQL-16"
  is_ha_cluster             = var.env == "prod"
  user_name                 = "depano"
  password                  = random_password.db.result
  encryption_at_rest        = true
  backup_schedule_frequency = 24
  backup_schedule_retention = var.env == "prod" ? 30 : 7
  disable_backup            = false

  private_network {
    pn_id       = scaleway_vpc_private_network.main.id
    enable_ipam = true
  }
}

resource "scaleway_rdb_database" "main" {
  instance_id = scaleway_rdb_instance.main.id
  name        = "depano"
}

# --- Redis managé (BullMQ, rate limiting, adaptateur Socket.IO) ---
resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "scaleway_redis_cluster" "main" {
  name         = local.name
  version      = "7.2.5"
  node_type    = var.redis_node_type
  user_name    = "depano"
  password     = random_password.redis.result
  cluster_size = 1
  tls_enabled  = true

  private_network {
    id = scaleway_vpc_private_network.main.id
  }
}

# --- Stockage objet privé (photos, documents KYC, factures) ---
resource "scaleway_object_bucket" "private" {
  name = "${local.name}-private"
  versioning {
    enabled = true
  }
  lifecycle_rule {
    id      = "purge-tmp"
    enabled = true
    prefix  = "tmp/"
    expiration {
      days = 1
    }
  }
}

resource "scaleway_object_bucket_acl" "private" {
  bucket = scaleway_object_bucket.private.id
  acl    = "private"
}

# --- Registre d'images et conteneurs serverless (API + workers) ---
resource "scaleway_registry_namespace" "main" {
  name      = "depano"
  is_public = false
  count     = var.env == "prod" ? 1 : 0
}

resource "scaleway_container_namespace" "main" {
  name = local.name
}

locals {
  common_env = {
    NODE_ENV         = "production"
    S3_ENDPOINT      = "https://s3.fr-par.scw.cloud"
    S3_REGION        = "fr-par"
    S3_BUCKET        = scaleway_object_bucket.private.name
    PAYMENT_PROVIDER = "stripe"
    SMS_PROVIDER     = "twilio"
    PUSH_PROVIDER    = "expo"
    API_PUBLIC_URL   = "https://${var.api_domain}"
  }
  common_secrets = merge(var.secrets, {
    DATABASE_URL = "postgres://depano:${random_password.db.result}@${scaleway_rdb_instance.main.private_network[0].ip}:${scaleway_rdb_instance.main.private_network[0].port}/depano?sslmode=require"
    REDIS_URL    = "rediss://depano:${random_password.redis.result}@${one(scaleway_redis_cluster.main.private_network[*].ips)[0]}:6379"
  })
}

resource "scaleway_container" "api" {
  name                         = "api"
  namespace_id                 = scaleway_container_namespace.main.id
  registry_image               = "rg.fr-par.scw.cloud/depano/api:${var.image_tag}"
  port                         = 3000
  cpu_limit                    = 1000
  memory_limit                 = 1024
  min_scale                    = var.env == "prod" ? 2 : 1
  max_scale                    = 10
  privacy                      = "public"
  protocol                     = "http1"
  deploy                       = true
  private_network_id           = scaleway_vpc_private_network.main.id
  environment_variables        = local.common_env
  secret_environment_variables = local.common_secrets
  health_check {
    http { path = "/v1/health" }
    failure_threshold = 3
    interval          = "10s"
  }
}

resource "scaleway_container" "worker" {
  name                         = "worker"
  namespace_id                 = scaleway_container_namespace.main.id
  registry_image               = "rg.fr-par.scw.cloud/depano/worker:${var.image_tag}"
  port                         = 8080 # endpoint /health exposé par le worker
  cpu_limit                    = 1000
  memory_limit                 = 1024
  min_scale                    = 1
  max_scale                    = 4
  privacy                      = "private"
  deploy                       = true
  private_network_id           = scaleway_vpc_private_network.main.id
  environment_variables        = local.common_env
  secret_environment_variables = local.common_secrets
}

resource "scaleway_container_domain" "api" {
  container_id = scaleway_container.api.id
  hostname     = var.api_domain
}
