module "dev" {
  source = "./modules/searchneu"

  stage                = "dev"

  vpc_id             = aws_vpc.main.id
  public_subnet_ids  = aws_subnet.public.*.id
  private_subnet_ids = aws_subnet.private.*.id

  alb_listener_arn = module.alb.https_listener_arns[0]
  alb_sg_id        = aws_security_group.lb.id
  alb_dns_name     = module.alb.this_lb_dns_name // this one is sus to me, as are all the ALB ones

  domains = ["dev.searchneu.com"]

  cloudflare_zone_id = var.cloudflare_zone_id

  ecr_url = aws_ecr_repository.app.repository_url

  secrets = var.dev_secrets // need to populate this

  jumphost_sg_id = aws_security_group.jumphost.id // :yikes:
}
