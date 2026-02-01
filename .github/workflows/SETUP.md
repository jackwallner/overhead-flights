# Discord Webhook Setup

## Webhook Created ✅

A Discord webhook has been created for **#jackbot-discoveries**.

### Webhook URL (add this as GitHub secret)
```
https://discord.com/api/webhooks/1467631595245535406/sUgNUZ97f3TgAGRfg1MUbbHXUTLJfz2TKhLAq3wp_hCQ9wyYnYdegImuwnCrUIYqeof5
```

### Setup Steps

1. Go to https://github.com/jackwallner/overhead-flights/settings/secrets/actions
2. Click **New repository secret**
3. Name: `DISCORD_WEBHOOK_URL`
4. Value: Paste the webhook URL above
5. Click **Add secret**

### What Happens Next

When someone creates a GitHub issue with the `feature-request` label:
1. GitHub Action triggers automatically
2. Rich embed posted to #jackbot-discoveries
3. Includes title, priority, description preview, and link

### Test It

1. Visit https://jackwallner.github.io/overhead-flights/feature-request.html
2. Enter password: `gohawks`
3. Submit a test feature request
4. Click "Create issue" on GitHub
5. Check #jackbot-discoveries for the notification
