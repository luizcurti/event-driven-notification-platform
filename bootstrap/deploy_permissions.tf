# Least-privilege-ish permissions for the deploy role: everything the main stack in
# ../terraform needs to create, update and destroy, scoped by the `${var.project_name}-` name
# prefix wherever the service supports resource-level permissions.
#
# Unavoidably broader:
#   - API Gateway REST APIs are addressed by generated IDs, not names, so apigateway:* is
#     scoped to the region rather than the project. The same goes for the account-level
#     CloudWatch role setting (aws_api_gateway_account).
#   - WAFv2 ACL associations and managed rule groups span ARNs outside the project prefix.
#   - Lambda event source mappings are addressed by UUID.
#   - A handful of Describe/List calls only accept "*".

locals {
  p      = var.project_name
  region = var.aws_region
  acct   = local.account_id
}

data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    sid       = "StateBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn]
  }

  statement {
    sid       = "StateObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.tfstate.arn}/*"]
  }

  statement {
    sid     = "LambdaFunctions"
    actions = ["lambda:*"]
    resources = [
      "arn:aws:lambda:${local.region}:${local.acct}:function:${local.p}-*",
    ]
  }

  statement {
    sid = "LambdaEventSourceMappings"
    actions = [
      "lambda:CreateEventSourceMapping",
      "lambda:GetEventSourceMapping",
      "lambda:UpdateEventSourceMapping",
      "lambda:DeleteEventSourceMapping",
      "lambda:ListEventSourceMappings",
      "lambda:TagResource",
      "lambda:ListTags",
    ]
    resources = ["*"]
  }

  statement {
    sid = "IamProjectRoles"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRoleTags",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
    ]
    resources = ["arn:aws:iam::${local.acct}:role/${local.p}-*"]
  }

  # The only managed policy the stack attaches (api_gateway.tf). Restricting the policy ARN
  # stops the deploy role from attaching AdministratorAccess to a role it creates.
  statement {
    sid       = "IamAttachApiGatewayLoggingPolicyOnly"
    actions   = ["iam:AttachRolePolicy", "iam:DetachRolePolicy"]
    resources = ["arn:aws:iam::${local.acct}:role/${local.p}-*"]

    condition {
      test     = "ArnEquals"
      variable = "iam:PolicyARN"
      values   = ["arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"]
    }
  }

  statement {
    sid       = "IamPassProjectRoles"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${local.acct}:role/${local.p}-*"]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["lambda.amazonaws.com", "apigateway.amazonaws.com"]
    }
  }

  statement {
    sid       = "ApiGateway"
    actions   = ["apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE"]
    resources = ["arn:aws:apigateway:${local.region}::/*"]
  }

  statement {
    sid       = "Waf"
    actions   = ["wafv2:*"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [local.region]
    }
  }

  statement {
    sid     = "DynamoDb"
    actions = ["dynamodb:*"]
    resources = [
      "arn:aws:dynamodb:${local.region}:${local.acct}:table/${local.p}-*",
      "arn:aws:dynamodb:${local.region}:${local.acct}:table/${local.p}-*/index/*",
    ]
  }

  statement {
    sid       = "Sqs"
    actions   = ["sqs:*"]
    resources = ["arn:aws:sqs:${local.region}:${local.acct}:${local.p}-*"]
  }

  statement {
    sid       = "Sns"
    actions   = ["sns:*"]
    resources = ["arn:aws:sns:${local.region}:${local.acct}:${local.p}-*"]
  }

  statement {
    sid     = "EventBridge"
    actions = ["events:*"]
    resources = [
      "arn:aws:events:${local.region}:${local.acct}:event-bus/${local.p}-*",
      "arn:aws:events:${local.region}:${local.acct}:rule/${local.p}-*",
    ]
  }

  statement {
    sid     = "LogGroups"
    actions = ["logs:*"]
    resources = [
      "arn:aws:logs:${local.region}:${local.acct}:log-group:/aws/lambda/${local.p}-*",
      "arn:aws:logs:${local.region}:${local.acct}:log-group:/aws/apigateway/${local.p}-*",
      "arn:aws:logs:${local.region}:${local.acct}:log-group:aws-waf-logs-${local.p}*",
    ]
  }

  statement {
    sid       = "Alarms"
    actions   = ["cloudwatch:*"]
    resources = ["arn:aws:cloudwatch:${local.region}:${local.acct}:alarm:${local.p}-*"]
  }

  statement {
    sid = "AccountWideReadsAndLogDelivery"
    actions = [
      "sts:GetCallerIdentity",
      "cloudwatch:DescribeAlarms",
      "logs:DescribeLogGroups",
      "logs:DescribeResourcePolicies",
      "logs:PutResourcePolicy",
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "lambda:GetAccountSettings",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
    ]
    resources = ["*"]
  }

  # The deploy role matches the `${var.project_name}-*` prefix itself; never let it rewrite its
  # own trust or permissions.
  statement {
    sid    = "DenySelfModification"
    effect = "Deny"
    actions = [
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:DeleteRole",
      "iam:TagRole",
      "iam:UntagRole",
    ]
    resources = [aws_iam_role.github_deploy.arn]
  }
}
