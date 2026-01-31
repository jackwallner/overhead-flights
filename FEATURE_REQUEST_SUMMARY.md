# Feature Request Integration - Implementation Summary

## What Was Implemented

Updated the overhead-flights feature request system to post submissions to `#jackbot-discoveries` via clawdbot.

## Architecture

```
User submits feature
        ↓
┌───────────────────┐
│  GitHub Pages     │  js/feature-request.js
│  (static site)    │  → POST to Cloudflare Worker
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Cloudflare Worker│  clawdbot-bridge-worker.js
│  (edge function)  │  → Post to Discord webhook
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Discord          │  #jackbot-discoveries
│  (jackbot-        │  (ID: 1465481924029186202)
│   discoveries)    │
└───────────────────┘
```

## Files Created/Modified

### Modified
- `js/feature-request.js` - Updated to use Cloudflare Worker bridge

### Created
| File | Purpose |
|------|---------|
| `clawdbot-bridge-worker.js` | Cloudflare Worker that receives requests and posts to Discord |
| `wrangler.toml` | Worker deployment config |
| `clawdbot-poll.js` | Alternative: Local poller that uses `clawdbot message send` |
| `post-via-clawdbot.sh` | Direct CLI tool to post feature requests via clawdbot |
| `test-feature-request.sh` | Test script for local queue |
| `FEATURE_REQUEST_SETUP.md` | Full deployment documentation |

## Quick Start

### Option 1: Deploy Cloudflare Worker (Recommended)

```bash
cd overhead-flights

# 1. Install wrangler
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Create Discord webhook in #jackbot-discoveries
#    (Channel Settings → Integrations → Webhooks)

# 4. Set webhook as secret
wrangler secret put DISCORD_WEBHOOK_URL
# Paste the webhook URL when prompted

# 5. Deploy
wrangler deploy
```

### Option 2: Direct CLI (Testing)

```bash
# Post a feature request directly via clawdbot
./post-via-clawdbot.sh "Add dark mode to the flight tracker"
```

## How It Works

1. User clicks "💡 Request Feature" in the overhead-flights web app
2. User enters password (`gohawks`) to unlock
3. User types feature request and submits
4. JavaScript sends POST to `https://clawdbot-bridge.jackwallner.workers.dev/feature-request`
5. Cloudflare Worker posts a rich embed to #jackbot-discoveries
6. Jackle sees the request and can implement it

## Embed Format

Feature requests appear in Discord as:

```
🔭 New Feature Request
[Feature description text]

Source: overhead-flights    Time (PT): Jan 30, 5:52 PM
Overhead Flights • Submit features from the app
```

## Security

- Password gate prevents spam (hardcoded as `gohawks`)
- Discord webhook URL stored as Cloudflare secret
- CORS enabled for GitHub Pages domain

## Next Steps

1. Deploy the Cloudflare Worker (see setup guide)
2. Test by submitting a feature from https://jackwallner.github.io/overhead-flights/
3. Verify it appears in #jackbot-discoveries
