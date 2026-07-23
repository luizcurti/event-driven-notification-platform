resource "aws_lambda_function" "notification_api" {
  function_name = "${var.project_name}-notification-api"
  role          = aws_iam_role.lambda_role.arn
  runtime       = var.use_localstack ? "nodejs20.x" : "nodejs22.x"
  handler       = "handlers/api/notification-api-lambda.handler"
  filename      = var.lambda_zip_path
  timeout       = 30

  environment {
    variables = {
      NOTIFICATIONS_TABLE_NAME = aws_dynamodb_table.notifications.name
      EVENT_BUS_NAME           = aws_cloudwatch_event_bus.notification_bus.name
      RETRY_QUEUE_URL          = aws_sqs_queue.retry_queue.url
      MAX_RETRIES              = tostring(var.max_retries)
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "email" {
  function_name = "${var.project_name}-email"
  role          = aws_iam_role.lambda_role.arn
  runtime       = var.use_localstack ? "nodejs20.x" : "nodejs22.x"
  handler       = "handlers/consumers/channel-lambdas.emailHandler"
  filename      = var.lambda_zip_path
  timeout       = 30

  environment {
    variables = {
      NOTIFICATIONS_TABLE_NAME = aws_dynamodb_table.notifications.name
      RETRY_QUEUE_URL          = aws_sqs_queue.retry_queue.url
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "sms" {
  function_name = "${var.project_name}-sms"
  role          = aws_iam_role.lambda_role.arn
  runtime       = var.use_localstack ? "nodejs20.x" : "nodejs22.x"
  handler       = "handlers/consumers/channel-lambdas.smsHandler"
  filename      = var.lambda_zip_path
  timeout       = 30

  environment {
    variables = {
      NOTIFICATIONS_TABLE_NAME = aws_dynamodb_table.notifications.name
      RETRY_QUEUE_URL          = aws_sqs_queue.retry_queue.url
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "push" {
  function_name = "${var.project_name}-push"
  role          = aws_iam_role.lambda_role.arn
  runtime       = var.use_localstack ? "nodejs20.x" : "nodejs22.x"
  handler       = "handlers/consumers/channel-lambdas.pushHandler"
  filename      = var.lambda_zip_path
  timeout       = 30

  environment {
    variables = {
      NOTIFICATIONS_TABLE_NAME = aws_dynamodb_table.notifications.name
      RETRY_QUEUE_URL          = aws_sqs_queue.retry_queue.url
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "retry_worker" {
  function_name = "${var.project_name}-retry-worker"
  role          = aws_iam_role.lambda_role.arn
  runtime       = var.use_localstack ? "nodejs20.x" : "nodejs22.x"
  handler       = "handlers/retry/retry-worker-lambda.handler"
  filename      = var.lambda_zip_path
  timeout       = 30

  environment {
    variables = {
      EVENT_BUS_NAME = aws_cloudwatch_event_bus.notification_bus.name
      MAX_RETRIES    = tostring(var.max_retries)
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "email_target" {
  rule           = aws_cloudwatch_event_rule.email_rule.name
  event_bus_name = aws_cloudwatch_event_bus.notification_bus.name
  arn            = aws_lambda_function.email.arn
}

resource "aws_cloudwatch_event_target" "sms_target" {
  rule           = aws_cloudwatch_event_rule.sms_rule.name
  event_bus_name = aws_cloudwatch_event_bus.notification_bus.name
  arn            = aws_lambda_function.sms.arn
}

resource "aws_cloudwatch_event_target" "push_target" {
  rule           = aws_cloudwatch_event_rule.push_rule.name
  event_bus_name = aws_cloudwatch_event_bus.notification_bus.name
  arn            = aws_lambda_function.push.arn
}

resource "aws_lambda_permission" "allow_eventbridge_email" {
  statement_id  = "AllowExecutionFromEventBridgeEmail"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.email_rule.arn
}

resource "aws_lambda_permission" "allow_eventbridge_sms" {
  statement_id  = "AllowExecutionFromEventBridgeSms"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sms.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.sms_rule.arn
}

resource "aws_lambda_permission" "allow_eventbridge_push" {
  statement_id  = "AllowExecutionFromEventBridgePush"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.push.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.push_rule.arn
}

resource "aws_lambda_event_source_mapping" "retry_sqs_trigger" {
  event_source_arn = aws_sqs_queue.retry_queue.arn
  function_name    = aws_lambda_function.retry_worker.arn
  batch_size       = 10
  enabled          = true
}
