# provider.tf

# Specify the provider and access details
provider "aws" {
  region = var.aws_region
}

provider "cloudflare" {
  source = "cloudflare/cloudflare"
  version = "~> 2.0"
}

provider "github" {
  organization = "sandboxnu"
}
