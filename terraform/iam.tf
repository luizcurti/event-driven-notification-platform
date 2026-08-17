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
  log_permissions = {
    Effect   = "Allow"
    Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    Resource = "*"
  }
  channel_names = ["email", "sms", "push"]
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
      local.log_permissions,
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
      local.log_permissions,
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.notifications.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.retry_queue.arn
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
      local.log_permissions,
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
