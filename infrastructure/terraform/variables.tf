# AWS Settings
variable "aws_region" {
  description = "The AWS region things are created in"
  default     = "us-east-1"
}

# Cloudflare

variable "cloudflare_zone_id" {
  description = "cloudflare zone id"
} 

# Application Settings

variable "name" {
  description = "Name of the application"
  default     = "course-catalog-api"
}

variable "prod_secrets" {
  description = "Secrets to put in SSM Parameter Store and add as environment variables to prod"
}

variable "staging_secrets" {
  description = "Secrets to put in SSM Parameter Store and add as environment variables to staging"
}

variable "dev_secrets" {
  description = "Secrets to put in SSM Parameter Store and add as environment variables to dev environment"
}

# Jumphost
variable "ssh_public_key" {
  description = "ssh public key to use to access the jumphost. To add more keys, ssh in and add to ~/.ssh/authorized file"
}

# Docker + ALB Settings
variable "az_count" {
  description = "Number of AZs to cover in a given region"
  default     = "2"
}

