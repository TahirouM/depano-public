terraform {
  required_providers {
    scaleway = { source = "scaleway/scaleway", version = "~> 2.50" }
  }
  backend "s3" {
    bucket                      = "depano-terraform-state"
    key                         = "prod.tfstate"
    region                      = "fr-par"
    endpoints                   = { s3 = "https://s3.fr-par.scw.cloud" }
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
  }
}

provider "scaleway" {
  region = "fr-par"
  zone   = "fr-par-1"
}

variable "image_tag" {
  type = string
}

variable "secrets" {
  type      = map(string)
  sensitive = true
  default   = {}
}

module "stack" {
  source          = "../../modules/stack"
  env             = "prod"
  image_tag       = var.image_tag
  api_domain      = "api.depano.fr"
  db_node_type    = "DB-PRO2-XXS"
  redis_node_type = "RED1-S"
  secrets         = var.secrets
}

output "api_url" {
  value = module.stack.api_url
}
