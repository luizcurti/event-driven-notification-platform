resource "aws_api_gateway_rest_api" "notifications_api" {
  name = "${var.project_name}-api"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_resource" "notifications" {
  rest_api_id = aws_api_gateway_rest_api.notifications_api.id
  parent_id   = aws_api_gateway_rest_api.notifications_api.root_resource_id
  path_part   = "notifications"
}

resource "aws_api_gateway_resource" "notification_id" {
  rest_api_id = aws_api_gateway_rest_api.notifications_api.id
  parent_id   = aws_api_gateway_resource.notifications.id
  path_part   = "{id}"
}

resource "aws_api_gateway_method" "notifications_any" {
  rest_api_id      = aws_api_gateway_rest_api.notifications_api.id
  resource_id      = aws_api_gateway_resource.notifications.id
  http_method      = "ANY"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_method" "notification_id_any" {
  rest_api_id      = aws_api_gateway_rest_api.notifications_api.id
  resource_id      = aws_api_gateway_resource.notification_id.id
  http_method      = "ANY"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "notifications_integration" {
  rest_api_id             = aws_api_gateway_rest_api.notifications_api.id
  resource_id             = aws_api_gateway_resource.notifications.id
  http_method             = aws_api_gateway_method.notifications_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.notification_api.invoke_arn
}

resource "aws_api_gateway_integration" "notification_id_integration" {
  rest_api_id             = aws_api_gateway_rest_api.notifications_api.id
  resource_id             = aws_api_gateway_resource.notification_id.id
  http_method             = aws_api_gateway_method.notification_id_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.notification_api.invoke_arn
}

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id = aws_api_gateway_rest_api.notifications_api.id

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.notifications_integration,
    aws_api_gateway_integration.notification_id_integration,
  ]
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.deployment.id
  rest_api_id   = aws_api_gateway_rest_api.notifications_api.id
  stage_name    = "prod"

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_access_logs.arn
    format = jsonencode({
      requestId            = "$context.requestId"
      ip                   = "$context.identity.sourceIp"
      requestTime          = "$context.requestTime"
      httpMethod           = "$context.httpMethod"
      path                 = "$context.path"
      status               = "$context.status"
      responseLength       = "$context.responseLength"
      errorMessage         = "$context.error.message"
      integrationLatencyMs = "$context.integration.latency"
    })
  }

  depends_on = [aws_api_gateway_account.this]
}

# Account-level (not per-API) setting required for API Gateway to write access/execution
# logs to CloudWatch. If this AWS account already runs other API Gateways with a different
# CloudWatch role configured this way, this resource will overwrite that account-wide setting.
resource "aws_api_gateway_account" "this" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn
}

resource "aws_iam_role" "api_gateway_cloudwatch" {
  name = "${var.project_name}-apigateway-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "apigateway.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_method_settings" "prod" {
  rest_api_id = aws_api_gateway_rest_api.notifications_api.id
  stage_name  = aws_api_gateway_stage.prod.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled = true
    logging_level   = "INFO"
  }
}

resource "aws_api_gateway_api_key" "api_key" {
  name  = "${var.project_name}-api-key"
  value = var.api_key_value
}

resource "aws_api_gateway_usage_plan" "usage_plan" {
  name = "${var.project_name}-usage-plan"

  api_stages {
    api_id = aws_api_gateway_rest_api.notifications_api.id
    stage  = aws_api_gateway_stage.prod.stage_name
  }

  throttle_settings {
    rate_limit  = var.api_throttle_rate_limit
    burst_limit = var.api_throttle_burst_limit
  }
}

resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.api_key.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.usage_plan.id
}

resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.notification_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.notifications_api.execution_arn}/*/*"
}
