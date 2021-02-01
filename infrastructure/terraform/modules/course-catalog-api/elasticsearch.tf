# ==================== Elasticsearch cluster ====================
module "elasticsearch" {
  source                  = "git::https://github.com/cloudposse/terraform-aws-elasticsearch.git?ref=tags/0.27.0"
  name                    = module.label.name
  stage                   = module.label.stage
  security_groups         = [aws_security_group.ecs_tasks.id, var.jumphost_sg_id] # sg that can connect, not sg of ES itself!
  vpc_id                  = var.vpc_id

  # Just 1 subnet/availability zone cause ES is dumb $$$
  subnet_ids              = [var.private_subnet_ids[0]]
  zone_awareness_enabled  = "false"
  availability_zone_count = 1

  elasticsearch_version   = "7.1"
  instance_type           = "t2.small.elasticsearch"
  instance_count          = 1
  ebs_volume_size         = 20
  encrypt_at_rest_enabled = "false"

  // needs to be `false` after generating the role the first time--i.e. after you create staging ES you need to turn this off for prod ES
  create_iam_service_linked_role = "false"
  iam_role_arns           = ["*"] // open access is ok because we're in VPC + security group
  iam_actions             = ["es:*"]
  kibana_subdomain_name = "kibana-es"


  advanced_options = {
    "rest.action.multi.allow_explicit_index" = "true"
  }
}
