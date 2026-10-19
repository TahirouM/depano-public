output "api_url" {
  value = "https://${var.api_domain}"
}

output "bucket" {
  value = scaleway_object_bucket.private.name
}
