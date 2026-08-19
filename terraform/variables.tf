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
