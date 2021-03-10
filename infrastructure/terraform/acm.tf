# Get HTTPS cert
# TODO currently unneeded because our cert is for *.searchneu.com
resource "aws_acm_certificate" "cert" {
  domain_name               = "api.searchneu.com"
  subject_alternative_names = ["*.api.searchneu.com"]
  validation_method         = "DNS"

  #   lifecycle {
  #     create_before_destroy = true
  #   }
}

resource "cloudflare_record" "cert" {
  zone_id = var.cloudflare_zone_id
  name    = tolist(aws_acm_certificate.cert.domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.cert.domain_validation_options)[0].resource_record_type
  value   = trimsuffix(tolist(aws_acm_certificate.cert.domain_validation_options)[0].resource_record_value, ".")
  ttl     = 1
}
