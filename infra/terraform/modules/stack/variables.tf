variable "env" {
  type        = string
  description = "staging ou prod"
}

variable "image_tag" {
  type        = string
  description = "Tag des images api/worker (SHA du commit)"
}

variable "api_domain" {
  type = string
}

variable "db_node_type" {
  type    = string
  default = "DB-DEV-S"
}

variable "redis_node_type" {
  type    = string
  default = "RED1-MICRO"
}

variable "secrets" {
  type        = map(string)
  sensitive   = true
  description = "JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, OTP_PEPPER, STRIPE_*, TWILIO_*, S3_ACCESS_KEY, S3_SECRET_KEY, EXPO_ACCESS_TOKEN…"
}
