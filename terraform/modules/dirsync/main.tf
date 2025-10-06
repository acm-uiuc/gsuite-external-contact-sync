data "archive_file" "lambda_code" {
  type        = "zip"
  source_dir  = "${path.module}/../../../dist"
  output_path = "${path.module}/../../../dist/dirsync.zip"
}
locals {
  sync_lambda_name = "${var.ProjectId}-engine"
}
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${local.sync_lambda_name}"
  retention_in_days = var.LogRetentionDays
}

resource "aws_iam_role" "this" {
  name = "${local.sync_lambda_name}-exec-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        },
      },
    ]
  })
}

resource "aws_iam_policy" "this" {
  name = "${local.sync_lambda_name}-base-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Effect   = "Allow",
        Resource = ["${aws_cloudwatch_log_group.this.arn}:*"]
      },
      {
        Action = ["secretsmanager:GetSecretValue"],
        Effect = "Allow",
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:secret:gsuite-dirsync-config*",
        ]
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "this" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.this.arn
}

resource "aws_lambda_function" "this" {
  depends_on                     = [aws_cloudwatch_log_group.this]
  function_name                  = local.sync_lambda_name
  role                           = aws_iam_role.this.arn
  architectures                  = ["arm64"]
  handler                        = "sync.handler"
  runtime                        = "nodejs22.x"
  filename                       = data.archive_file.lambda_code.output_path
  timeout                        = 900
  memory_size                    = 2048
  source_code_hash               = data.archive_file.lambda_code.output_sha256
  reserved_concurrent_executions = 1
  description                    = "GSuite Sync Lambda."
  environment {
    variables = {
      "RunEnvironment" = var.RunEnvironment
    }
  }
}

resource "aws_cloudwatch_event_rule" "this" {
  name                = "${local.sync_lambda_name}-schedule"
  description         = "Trigger GSuite directory sync on a schedule"
  schedule_expression = var.SyncFrequency
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.this.arn
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.this.name
  target_id = "DirsyncLambdaTarget"
  arn       = aws_lambda_function.this.arn
}


resource "aws_cloudwatch_metric_alarm" "invocation_error" {
  alarm_name          = "${local.sync_lambda_name}-error-invocation"
  alarm_description   = "GSuite Directory Sync lambda threw a critical error."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = "300"
  evaluation_periods  = "1"
  comparison_operator = "GreaterThanThreshold"
  threshold           = "1"
  alarm_actions = [
    var.SnsArn
  ]
  dimensions = {
    FunctionName = local.sync_lambda_name
  }
}

resource "aws_cloudwatch_metric_alarm" "no_invocation" {
  alarm_name          = "${local.sync_lambda_name}-no-invocation"
  alarm_description   = "GSuite Directory Sync lambda has not executed in the past 4 hours."
  namespace           = "AWS/Lambda"
  metric_name         = "Invocations"
  statistic           = "Sum"
  period              = "14400"
  evaluation_periods  = "1"
  comparison_operator = "LessThanThreshold"
  threshold           = "1"
  treat_missing_data  = "breaching"
  alarm_actions = [
    var.SnsArn
  ]
  dimensions = {
    FunctionName = local.sync_lambda_name
  }
}
