terraform {
  required_version = "0.13.6"
  required_providers {
    random = ">= 2.2.0"
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 2.0"
    }

    github = {
      source = "integrations/github"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "github" {
  organization = "sandboxnu"
}
