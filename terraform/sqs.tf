resource "aws_sqs_queue" "retry_dlq" {
  name                    = "${var.project_name}-retry-dlq"
  sqs_managed_sse_enabled = true
  tags                    = local.common_tags
}

resource "aws_sqs_queue" "retry_queue" {
  name                       = "${var.project_name}-retry-queue"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 1209600
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.retry_dlq.arn
    maxReceiveCount     = var.max_retries
  })

  tags = local.common_tags
}
