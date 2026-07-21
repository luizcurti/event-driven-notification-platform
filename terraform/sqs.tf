resource "aws_sqs_queue" "retry_dlq" {
  name = "${var.project_name}-retry-dlq"
  tags = local.common_tags
}

resource "aws_sqs_queue" "retry_queue" {
  name                       = "${var.project_name}-retry-queue"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 1209600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.retry_dlq.arn
    maxReceiveCount     = var.max_retries
  })

  tags = local.common_tags
}
