variable "aws_region" {
  description = "Region the main stack is deployed to. Must match the AWS_REGION variable of the GitHub environment."
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Must match project_name in ../terraform/variables.tf: the deploy role's permissions are scoped by this prefix."
  type        = string
  default     = "event-driven-notification-platform"
}

variable "github_repository" {
  description = "owner/repo allowed to assume the deploy role."
  type        = string
  default     = "luizcurti/event-driven-notification-platform"
}

variable "github_environment" {
  description = "GitHub environment the deploy job runs in. Only that environment can assume the role."
  type        = string
  default     = "production"
}

variable "create_oidc_provider" {
  description = "Set to false if this AWS account already has the token.actions.githubusercontent.com OIDC provider (an account can only have one)."
  type        = bool
  default     = true
}
