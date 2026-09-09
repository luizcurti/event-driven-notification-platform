resource "aws_dynamodb_table" "notifications" {
  name         = "${var.project_name}-notifications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  # checkov:skip=CKV_AWS_119: encrypted at rest with the AWS-owned key by default; a customer-managed
  # CMK adds key-management overhead (policy, rotation, IAM grants) with no compliance driver at this scale.
  point_in_time_recovery {
    enabled = true
  }

  tags = local.common_tags
}
