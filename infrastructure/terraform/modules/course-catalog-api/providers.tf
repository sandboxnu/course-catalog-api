terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 2.0"
    }

    github = {
      source = "integrations/github"
    }
  }
}

provider "github" {
  organization = "sandboxnu"
}
