resource "aws_wafv2_web_acl" "api_waf" {
  count = var.use_localstack ? 0 : 1

  name  = "${var.project_name}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "managed-common"
      sampled_requests_enabled   = true
    }
  }

  # Covers known exploited RCE/injection patterns, including CVE-2021-44228 (Log4Shell).
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "managed-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "api-waf"
    sampled_requests_enabled   = true
  }

  tags = local.common_tags
}

resource "aws_wafv2_web_acl_association" "api_association" {
  count = var.use_localstack ? 0 : 1

  resource_arn = aws_api_gateway_stage.prod.arn
  web_acl_arn  = aws_wafv2_web_acl.api_waf[0].arn
}

# WAF log destinations must be a CloudWatch Logs group named with this exact prefix.
resource "aws_cloudwatch_log_group" "waf" {
  count = var.use_localstack ? 0 : 1

  name              = "aws-waf-logs-${var.project_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_wafv2_web_acl_logging_configuration" "api_waf" {
  count = var.use_localstack ? 0 : 1

  resource_arn            = aws_wafv2_web_acl.api_waf[0].arn
  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]
}
