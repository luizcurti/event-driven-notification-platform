resource "aws_cloudwatch_event_bus" "notification_bus" {
  name = "${var.project_name}-bus"
  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "email_rule" {
  name           = "${var.project_name}-email-rule"
  event_bus_name = aws_cloudwatch_event_bus.notification_bus.name

  event_pattern = jsonencode({
    detail-type = ["OrderApproved", "UserRegistered", "PasswordChanged", "NotificationRequested"]
  })
}

resource "aws_cloudwatch_event_rule" "sms_rule" {
  name           = "${var.project_name}-sms-rule"
  event_bus_name = aws_cloudwatch_event_bus.notification_bus.name

  event_pattern = jsonencode({
    detail-type = ["PaymentFailed", "PasswordChanged", "NotificationRequested"]
  })
}

resource "aws_cloudwatch_event_rule" "push_rule" {
  name           = "${var.project_name}-push-rule"
  event_bus_name = aws_cloudwatch_event_bus.notification_bus.name

  event_pattern = jsonencode({
    detail-type = ["OrderApproved", "DocumentProcessed", "NotificationRequested"]
  })
}
