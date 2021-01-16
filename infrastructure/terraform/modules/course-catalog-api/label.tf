module "label" {
  source     = "git::https://github.com/cloudposse/terraform-null-label.git?ref=tags/0.22.0"
  stage      = var.stage
  name       = "course-catalog-api"
  delimiter  = "-"
}
