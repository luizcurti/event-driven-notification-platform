locals {
  # Suffixes match the literal function_name values in lambda.tf. Kept separate from
  # local.lambda_function_names in cloudwatch.tf (which reads the *created* resources'
  # attributes) to avoid a dependency cycle: these log groups must exist before the
  # Lambdas that write to them.
  lambda_name_suffixes = ["notification-api", "email", "sms", "push", "retry-worker"]
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = toset(local.lambda_name_suffixes)

  name              = "/aws/lambda/${var.project_name}-${each.key}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_gateway_access_logs" {
  name              = "/aws/apigateway/${var.project_name}-access-logs"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}
