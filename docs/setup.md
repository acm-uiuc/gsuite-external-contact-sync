
## Setup

### 1. Entra ID Certificate Authentication

Generate a certificate for authenticating with Entra ID:

```bash
# Generate certificate and private key
openssl req -x509 -newkey rsa:2048 -keyout private-key.pem -out certificate.pem -days 7350 -nodes -subj "/CN=DirSync"

# Combine them
cat private-key.pem certificate.pem > combined.pem

# Base64 encode for storage
base64 -i combined.pem -o combined-base64.txt
```

**Upload to Azure:**
1. Go to Azure Portal → App Registrations
2. Select your app registration
3. Navigate to **Certificates & secrets** → **Certificates**
4. Upload `certificate.pem`

**Upload to AWS Secrets Manager:**
- Store the contents of `combined-base64.txt` as the `entraClientCertificate` field in your secret

### 2. Azure App Registration Setup

1. Create an app registration in Azure Portal
2. Grant API permissions:
   - **Microsoft Graph** → `User.Read.All` (Application permission)
3. Grant admin consent for the tenant
4. Note the **Tenant ID** and **Application (client) ID**

### 3. Google Workspace Setup

#### Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Contacts API**
4. Create a service account
5. Download the service account JSON key

#### Enable Domain-Wide Delegation
1. In the service account details, enable **Domain-wide delegation**
2. Note the **Client ID** (numeric)

#### Authorize in Google Workspace
1. Go to [admin.google.com](https://admin.google.com)
2. Navigate to **Security** → **Access and data control** → **API controls**
3. Click **Manage Domain Wide Delegation**
4. Add new:
   - **Client ID**: The numeric client ID from your service account
   - **OAuth Scopes**: `https://www.google.com/m8/feeds`
5. Click **Authorize**

#### Set Delegated User
The `googleDelegatedUser` must be a **Super Admin** in your Google Workspace domain.

## Troubleshooting

### "Not Authorized to access this resource/api"
- Verify the delegated user is a Super Admin
- Check domain-wide delegation is properly configured
- Ensure the Client ID and scopes are correct

### "Failed to fetch contacts: Forbidden"
- Verify the scope `https://www.google.com/m8/feeds` is authorized
- Check that domain-wide delegation is enabled for the service account
- Wait 5-10 minutes after authorization for changes to propagate

### Contacts not appearing
- Domain Shared Contacts sync can take a few minutes to propagate
- Verify contacts are being created (check CloudWatch logs)
- Try signing out and back in to Google Workspace