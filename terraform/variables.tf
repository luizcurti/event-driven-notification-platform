variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "event-driven-notification-platform"
}

variable "lambda_zip_path" {
  type    = string
  default = "../dist/lambdas.zip"
}

variable "api_key_value" {
  type      = string
  sensitive = true
}

variable "max_retries" {
  type    = number
  default = 3
}

variable "use_localstack" {
  type    = bool
  default = false
}

variable "localstack_endpoint" {
  type    = string
  default = "http://localhost:4566"
}

variable "pushgateway_url" {
  type    = string
  default = ""
}

variable "api_throttle_rate_limit" {
  type    = number
  default = 5
}

variable "api_throttle_burst_limit" {
  type    = number
  default = 10
}

variable "alert_email" {
  description = "Email address subscribed to the alerts SNS topic. Leave empty to skip the subscription."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for every Lambda and API Gateway access log group."
  type        = number
  default     = 14
}

variable "lambda_reserved_concurrency" {
  description = "Reserved concurrent executions per Lambda, bounding how much of the account's concurrency pool each function can consume. Sized against the API's own throttle_settings (api_throttle_burst_limit) so a traffic spike can't starve other functions or exhaust the account limit."
  type        = number
  default     = 10
}

variable "lambda_duration_alarm_threshold_ratio" {
  description = "Fraction of each Lambda's configured timeout that Duration must exceed (p99) to trigger the alarm, e.g. 0.8 = 80% of timeout."
  type        = number
  default     = 0.8
}
