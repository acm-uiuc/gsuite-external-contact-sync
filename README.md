# Entra ID to Google Workspace External Contact Sync

## Purpose

This Lambda function syncs members from our Entra ID (Azure AD) tenant to Google Workspace as external domain shared contacts. 

### Why This Exists

In the `acm.illinois.edu` Google Workspace tenant, we cannot use people chips or autocomplete for `@illinois.edu` email addresses because they're in a separate identity system (GSuite for UIUC). This creates friction when trying to email or mention Illinois users.

**This sync solves that problem** by:
- Automatically pulling all active users from the University of Illinois Entra ID tenant
- Creating them as external contacts in Google Workspace's domain shared contacts
- Making Illinois email addresses searchable and autocomplete-able in Gmail, Calendar, Drive, etc.
- Providing a seamless experience where ACM members can easily find and contact other Illinois users

Users will now see Illinois emails appear in autocomplete suggestions and people chips work correctly across all Google Workspace apps.

## Architecture

- **Source**: ACM @ UIUC Entra ID tenant
- **Destination**: Google Workspace Domain Shared Contacts for `acm.illinois.edu`
- **Sync Frequency**: Configurable via EventBridge schedule (default: every hour)
- **Fields Synced**: First name, last name, display name, email (primary)

## Configuration

Configuration is stored in AWS Secrets Manager under the secret `gsuite-dirsync-config`:

## How It Works

1. **Fetch**: Retrieves all enabled users from Entra ID using certificate authentication
2. **Parse**: Extracts name and email fields, intelligently parsing various display name formats
3. **Compare**: Fetches existing domain shared contacts from Google Workspace
4. **Sync**: Creates, updates, or deletes contacts as needed
5. **Log**: Reports statistics on synced contacts

## Contact Format

Contacts are created with:
- **Primary email**: The user's mail field from Entra ID
- **Name fields**: Given name, family name, and display name
- **Smart parsing**: Automatically parses display names like "First Last", "Last, First", etc. when individual name fields are missing

## Deployment

The Lambda is deployed via Terraform. Set the Makefile.

## Monitoring

View logs in CloudWatch Logs:
- Log group: `/aws/lambda/gsuite-dirsync-engine`
- Structured JSON logging via Pino
- Contains detailed sync statistics and any errors

## Development

Run locally:
```bash
yarn -D
make local
```
---

For detailed setup instructions, see the setup documentation.