resource "aws_api_gateway_rest_api" "notifications_api" {
  name = "${var.project_name}-api"
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

  depends_on = [
    aws_api_gateway_integration.notifications_integration,
    aws_api_gateway_integration.notification_id_integration,
  ]
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.deployment.id
  rest_api_id   = aws_api_gateway_rest_api.notifications_api.id
  stage_name    = "prod"
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
