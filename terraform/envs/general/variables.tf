variable "LogRetentionDays" {
  type    = number
  default = 90
}

variable "ProjectId" {
  type    = string
  default = "gsuite-dirsync"
}

variable "SnsArn" {
  type    = string
  default = "arn:aws:sns:us-east-2:898906883758:DiscordGeneralAlerts"
}
