terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  access_key = var.use_localstack ? "test" : null
  secret_key = var.use_localstack ? "test" : null

  skip_credentials_validation = var.use_localstack
  skip_metadata_api_check     = var.use_localstack
  skip_requesting_account_id  = var.use_localstack

  endpoints {
    apigateway = var.use_localstack ? var.localstack_endpoint : null
    cloudwatch = var.use_localstack ? var.localstack_endpoint : null
    dynamodb   = var.use_localstack ? var.localstack_endpoint : null
    eventbridge = var.use_localstack ? var.localstack_endpoint : null
    iam         = var.use_localstack ? var.localstack_endpoint : null
    lambda      = var.use_localstack ? var.localstack_endpoint : null
    sqs         = var.use_localstack ? var.localstack_endpoint : null
    wafv2       = var.use_localstack ? var.localstack_endpoint : null
  }
}

locals {
  common_tags = {
    Project = var.project_name
  }
}
