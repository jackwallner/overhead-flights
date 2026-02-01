# Setup GitHub → Discord Webhook

This guide configures automatic Discord notifications when new feature requests (GitHub issues) are created.

## Quick Setup (2 minutes)

### Step 1: Create Discord Webhook

1. In Discord, go to **#jackbot-discoveries** channel
2. Click **Settings** (gear icon) → **Integrations** → **Webhooks** → **New Webhook**
3. Name it "GitHub Issues" 
4. Copy the webhook URL (looks like: `https://discord.com/api/webhooks/...`)

### Step 2: Add to GitHub Secrets

1. Go to https://github.com/jackwallner/overhead-flights/settings/secrets/actions
2. Click **New repository secret**
3. Name: `DISCORD_WEBHOOK_URL`
4. Value: Paste the Discord webhook URL from Step 1
5. Click **Add secret**

### Step 3: Create GitHub Action

Create file `.github/workflows/notify-discord.yml` in your repo:

```yaml
name: Notify Discord on New Issues

on:
  issues:
    types: [opened]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Send to Discord
        uses: actions/github-script@v7
        with:
          script: |
            const issue = context.payload.issue;
            const labels = issue.labels.map(l => l.name).join(', ') || 'none';
            
            // Only notify for feature requests
            if (!labels.includes('feature-request')) {
              console.log('Not a feature request, skipping Discord notification');
              return;
            }
            
            const embed = {
              title: `🔭 New Feature Request: ${issue.title}`,
              url: issue.html_url,
              color: 0x3b82f6,
              description: issue.body.substring(0, 500) + (issue.body.length > 500 ? '...' : ''),
              fields: [
                { name: 'Priority', value: issue.body.match(/\*\*Priority:\*\* (.*)/)?.[1] || 'Unknown', inline: true },
                { name: 'Issue #', value: `#${issue.number}`, inline: true }
              ],
              footer: { text: 'Overhead Flights • Feature Request' },
              timestamp: new Date().toISOString()
            };
            
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ embeds: [embed] })
            });
        env:
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
```

### Step 4: Commit the workflow

```bash
git add .github/workflows/notify-discord.yml
git commit -m "Add Discord notifications for new feature requests"
git push
```

## How It Works

```
User creates GitHub Issue
        ↓
GitHub Action triggers
        ↓
Posts embed to #jackbot-discoveries
        ↓
You see notification in Discord
```

## Testing

1. Go to https://jackwallner.github.io/overhead-flights/feature-request.html
2. Submit a test feature request
3. GitHub issue opens in new tab
4. Click "Create issue"
5. Check #jackbot-discoveries for the notification

## Troubleshooting

**No Discord notification?**
- Check GitHub Actions tab for errors: https://github.com/jackwallner/overhead-flights/actions
- Verify the `DISCORD_WEBHOOK_URL` secret is set correctly
- Ensure the issue has the `feature-request` label

**Want to notify on all issues (not just feature requests)?**
Remove this line from the workflow:
```javascript
if (!labels.includes('feature-request')) return;
```
