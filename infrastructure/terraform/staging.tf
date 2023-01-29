module "staging" {
  source = "./modules/course-catalog-api"

  stage              = "staging"

  vpc_id             = aws_vpc.main.id
  public_subnet_ids  = aws_subnet.public.*.id
  private_subnet_ids = aws_subnet.private.*.id

  alb_listener_arn   = module.alb.https_listener_arns[0]

  alb_sg_id          = aws_security_group.lb.id
  alb_dns_name       = module.alb.this_lb_dns_name
  api_domain         = "stagingapi.searchneu.com"
  notifs_domain      = "stagingnotifs.searchneu.com"
  domains            = [var.api_domain, var.notifs_domain] 
  cloudflare_zone_id = var.cloudflare_zone_id

  ecr_url = aws_ecr_repository.app.repository_url

  secrets = var.staging_secrets

  jumphost_sg_id     = aws_security_group.jumphost.id
}
