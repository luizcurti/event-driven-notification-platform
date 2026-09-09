resource "aws_cloudwatch_metric_alarm" "retry_dlq_messages_visible" {
  alarm_name          = "${var.project_name}-retry-dlq-messages-visible"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "The retry DLQ has at least one message: a notification exhausted the SQS redrive policy after repeated retry-worker invocation failures (see Retry & Failure Lifecycle in the README)."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.retry_dlq.name
  }

  tags = local.common_tags
}

locals {
  lambda_function_names = {
    notification-api = aws_lambda_function.notification_api.function_name
    email            = aws_lambda_function.email.function_name
    sms              = aws_lambda_function.sms.function_name
    push             = aws_lambda_function.push.function_name
    retry-worker     = aws_lambda_function.retry_worker.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = local.lambda_function_names

  alarm_name          = "${var.project_name}-${each.key}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "${each.key} Lambda reported one or more invocation errors."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = each.value
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = local.lambda_function_names

  alarm_name          = "${var.project_name}-${each.key}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "${each.key} Lambda was throttled, i.e. it hit its reserved_concurrent_executions limit (${var.lambda_reserved_concurrency})."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = each.value
  }

  tags = local.common_tags
}

# All five Lambdas share the same 30s timeout (see lambda.tf), so one threshold applies to all.
locals {
  lambda_timeout_seconds   = 30
  lambda_duration_alarm_ms = local.lambda_timeout_seconds * 1000 * var.lambda_duration_alarm_threshold_ratio
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = local.lambda_function_names

  alarm_name          = "${var.project_name}-${each.key}-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  extended_statistic  = "p99"
  threshold           = local.lambda_duration_alarm_ms
  treat_missing_data  = "notBreaching"
  alarm_description   = "${each.key} Lambda p99 duration exceeded ${var.lambda_duration_alarm_threshold_ratio * 100}% of its ${local.lambda_timeout_seconds}s timeout."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = each.value
  }

  tags = local.common_tags
}

# No 4XXError alarm: this API returns 400/403/404 as expected, routine responses (validation
# errors, missing API key, unknown id, cancel conflicts — see the Postman collection in
# postman/, which deliberately exercises each of them), so a count/threshold-based alarm on
# 4XX would fire on normal traffic. A rate-based alarm (4XX as a % of total requests) would be
# meaningful, but needs real traffic volume to pick a sane threshold against.
resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx" {
  alarm_name          = "${var.project_name}-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "API Gateway returned one or more 5XX responses (server-side errors)."
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    ApiName = aws_api_gateway_rest_api.notifications_api.name
    Stage   = aws_api_gateway_stage.prod.stage_name
  }

  tags = local.common_tags
}
