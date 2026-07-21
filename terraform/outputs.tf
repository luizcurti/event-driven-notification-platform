output "api_url" {
  value = aws_api_gateway_stage.prod.invoke_url
}

output "event_bus_name" {
  value = aws_cloudwatch_event_bus.notification_bus.name
}

output "notifications_table_name" {
  value = aws_dynamodb_table.notifications.name
}

output "retry_queue_url" {
  value = aws_sqs_queue.retry_queue.url
}
