output "jumphost_ip" {
  value = "ubuntu@${aws_eip.jumphost.public_ip}"
  description = "Public IP of jumphost. Use the ssh key set in Terraform env."
}

output "prod_es_host" {
  value = module.prod.es_host
}

output "prod_rds_host" {
  value = module.prod.rds_host
}

output "prod_rds_pass" {
  value = module.prod.rds_ps
}

output "staging_es_host" {
  value = module.staging.es_host
}

output "staging_rds_host" {
  value = module.staging.rds_host
}

output "staging_rds_pass" {
  value = module.staging.rds_ps
}

output "dev_es_host" {
  value = module.dev.es_host
}

output "dev_rds_host" {
  value = module.dev.rds_host
}

output "dev_rds_pass" {
  value = module.dev.rds_ps
}
