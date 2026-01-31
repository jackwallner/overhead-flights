# Feature Request Integration Setup

This document explains how the overhead-flights feature request system works and how to set it up.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
│  User submits   │────▶│  Cloudflare Worker       │────▶│  #jackbot-discoveries    │
│  feature request│     │  (clawdbot-bridge)       │     │  (Discord channel)       │
└─────────────────┘     └──────────────────────────┘     └──────────────────────────┘
```

## Components

### 1. Frontend (`js/feature-request.js`)
- Collects feature request from authenticated users
- Sends POST request to Cloudflare Worker
- Handles success/error states

### 2. Cloudflare Worker (`clawdbot-bridge-worker.js`)
- Receives feature requests from the web app
- Posts formatted embed to Discord via webhook
- Handles CORS for cross-origin requests

### 3. Discord Channel
- `#jackbot-discoveries` (ID: 1465481924029186202)
- Receives feature requests as rich embeds

## Deployment Steps

### 1. Create Discord Webhook

1. In Discord, go to #jackbot-discoveries channel settings
2. Integrations → Webhooks → New Webhook
3. Name it "Feature Request Bot" 
4. Copy the webhook URL

### 2. Deploy Cloudflare Worker

```bash
cd overhead-flights

# Install wrangler if needed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set the webhook URL as a secret
wrangler secret put DISCORD_WEBHOOK_URL
# (paste the webhook URL when prompted)

# Deploy the worker
wrangler deploy
```

### 3. Verify Setup

1. Visit https://jackwallner.github.io/overhead-flights/
2. Click "💡 Request Feature"
3. Enter password: `gohawks`
4. Submit a test feature request
5. Check #jackbot-discoveries for the embed

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for #jackbot-discoveries | Yes |

## Security Notes

- The password (`gohawks`) is hardcoded in the frontend - this is acceptable since it's just a basic gate
- The Discord webhook URL is stored as a Cloudflare secret, not in code
- CORS is configured to allow requests from any origin (the site is public)

## Troubleshooting

### Worker not responding
```bash
wrangler tail  # View worker logs
```

### Discord webhook failing
- Verify the webhook URL is set correctly: `wrangler secret list`
- Check Discord channel permissions

### CORS errors in browser
- Ensure the worker is deployed and the URL in `feature-request.js` matches
