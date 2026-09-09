data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

locals {
  channel_names = ["email", "sms", "push"]

  # X-Ray requires no Resource scoping: PutTraceSegments/PutTelemetryRecords are not
  # resource-level actions (see https://docs.aws.amazon.com/xray/latest/devguide/security_iam_id-based-policy-examples.html).
  xray_permissions = {
    Effect   = "Allow"
    Action   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
    Resource = "*"
  }
}

# notification-api-lambda: creates/lists/gets/cancels notifications and publishes the
# initial event. Never touches SQS and never mutates a single channel's delivery state.
resource "aws_iam_role" "notification_api_role" {
  name               = "${var.project_name}-notification-api-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "notification_api_policy" {
  name = "${var.project_name}-notification-api-policy"
  role = aws_iam_role.notification_api_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.lambda["notification-api"].arn}:*"
      },
      local.xray_permissions,
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Scan"]
        Resource = aws_dynamodb_table.notifications.arn
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = aws_cloudwatch_event_bus.notification_bus.arn
      }
    ]
  })
}

# email/sms/push consumer lambdas: each gets its own role. They only ever read the
# notification, patch their own channel's delivery state, and enqueue their own retries.
# They can also write to the DLQ directly, but only as the async-invoke failure destination
# (aws_lambda_function_event_invoke_config.channel_async_failure in lambda.tf) for invocation-level
# failures — never as an application-level choice made by the handler code itself.
resource "aws_iam_role" "channel_role" {
  for_each = toset(local.channel_names)

  name               = "${var.project_name}-${each.key}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "channel_policy" {
  for_each = toset(local.channel_names)

  name = "${var.project_name}-${each.key}-policy"
  role = aws_iam_role.channel_role[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.lambda[each.key].arn}:*"
      },
      local.xray_permissions,
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.notifications.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.retry_queue.arn
      },
      {
        # Destination for the async-invoke failure path configured in
        # aws_lambda_function_event_invoke_config.channel_async_failure (lambda.tf).
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.retry_dlq.arn
      }
    ]
  })
}

# retry-worker-lambda: only reads from the retry queue, republishes to EventBridge, and
# patches a channel's state to FAILED once the retry budget is exhausted. No dynamodb:PutItem
# or dynamodb:Scan, and no access to the DLQ (SQS's redrive policy manages that on its own).
resource "aws_iam_role" "retry_worker_role" {
  name               = "${var.project_name}-retry-worker-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "retry_worker_policy" {
  name = "${var.project_name}-retry-worker-policy"
  role = aws_iam_role.retry_worker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.lambda["retry-worker"].arn}:*"
      },
      local.xray_permissions,
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = aws_cloudwatch_event_bus.notification_bus.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.notifications.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.retry_queue.arn
      }
    ]
  })
}
