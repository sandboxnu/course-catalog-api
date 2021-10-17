# Get HTTPS cert
resource "aws_acm_certificate" "cert" {
  domain_name               = "api.searchneu.com"
  subject_alternative_names = ["*.searchneu.com"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_record" "cert" {
  for_each = {
    for dvo in aws_acm_certificate.example.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name = each.value.name
  value = trimsuffix(each.value.record, ".")
  ttl = 1
  type = each.value.type
  zone_id = data.aws_route53_zone.example.zone_id
}
