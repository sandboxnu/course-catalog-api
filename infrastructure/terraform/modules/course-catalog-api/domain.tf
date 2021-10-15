# domain record
resource "cloudflare_record" "cname" {
  count = length(var.domains)
  zone_id = var.cloudflare_zone_id
  name = var.domains[count.index]
  type = "CNAME"
  value = var.alb_dns_name
  proxied = true
}

# Forward traffic to this environment based on the host
resource "aws_lb_listener_rule" "host_based" {
  listener_arn = var.alb_listener_arn

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.webserver.arn
  }

  condition {
    host_header {
      values = var.domains
    }
  }
}

# AWS load balancer rule for notifications server
resource "aws_lb_listener_rule" "notifs" {
  listener_arn = var.alb_listener_arn

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.notifserver.arn
  }

  condition {
    host_header {
      values = ["${module.label.stage == "staging" ? module.label.stage : ""}notifs.searchneu.com"]
    }
  }
}

resource "aws_lb_target_group" "webserver" {
  name        = "${module.label.id}-tg"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    matcher = "200"
    path = "/.well-known/apollo/server-health"
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "notifserver" {
  name        = "${module.label.stage}-cca-notif-tg"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    matcher = "200"
    path = "/knockknock"
    unhealthy_threshold = 3
  }
}
