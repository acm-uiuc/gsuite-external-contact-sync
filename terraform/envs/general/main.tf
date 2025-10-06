terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.10.0"
    }
  }

  required_version = ">= 1.2"

  backend "s3" {
    bucket       = "898906883758-terraform"
    key          = "gsuite-dirsync"
    region       = "us-east-1"
    use_lockfile = true
  }
}


provider "aws" {
  allowed_account_ids = ["898906883758"]
  region              = "us-east-1"
  default_tags {
    tags = {
      project           = var.ProjectId
      terraform_managed = true
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

module "dirsync" {
  source           = "../../modules/dirsync"
  ProjectId        = var.ProjectId
  RunEnvironment   = "prod"
  LogRetentionDays = var.LogRetentionDays
  SyncFrequency    = "rate(1 hour)"
  SnsArn           = var.SnsArn
}
