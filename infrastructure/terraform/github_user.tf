
## User for Github Actions

resource "aws_iam_user" "github_actions_user" {
  name = "github-actions-user"
}

resource "aws_iam_access_key" "github_actions_user" {
  user    = aws_iam_user.github_actions_user.name
}

resource "aws_iam_user_policy_attachment" "github_actions_user" {
  user       = aws_iam_user.github_actions_user.name
  policy_arn = aws_iam_policy.github_actions_user.arn
}

resource "aws_iam_policy" "github_actions_user" {
  name        = "github-actions-user-policy"
  description = "Policy for Github Actions to push to ECR"
  policy      = data.aws_iam_policy_document.github_actions_user.json
}

data "aws_iam_policy_document" "github_actions_user" {
  version = "2012-10-17"
  statement {
    sid    = "AllowPush"
    effect = "Allow"
    actions = [
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:BatchCheckLayerAvailability",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload"
    ]
    resources = [aws_ecr_repository.app.arn]
  }
  statement {
    sid    = "DeployService"
    effect = "Allow"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices"
    ]
    resources = ["*"]
  }
  statement {
    sid    = "GetAuthorizationToken"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken"
    ]
    resources = ["*"]
  }
}

# Put user access key into github actions secrets
resource "github_actions_secret" "access_key" {
  repository       = "course-catalog-api"
  secret_name      = "AWS_ACCESS_KEY_ID"
  plaintext_value  = aws_iam_access_key.github_actions_user.id
}

resource "github_actions_secret" "secret_key" {
  repository       = "course-catalog-api"
  secret_name      = "AWS_SECRET_ACCESS_KEY"
  plaintext_value  = aws_iam_access_key.github_actions_user.secret
}
