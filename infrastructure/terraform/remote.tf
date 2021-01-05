terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "sandboxnu"

    workspaces {
      name = "course-catalog-api"
    }
  }
}
