#!/bin/bash
# Post a feature request directly to Discord using clawdbot CLI
# Usage: ./post-via-clawdbot.sh "Your feature request text"

FEATURE="${1:-Test feature request}"
CHANNEL_ID="1465481924029186202"  # #jackbot-discoveries

# Build the embed JSON
EMBED=$(cat <<EOF
{
  "title": "🔭 New Feature Request",
  "description": "$FEATURE",
  "color": 5205895,
  "fields": [
    {"name": "Source", "value": "overhead-flights", "inline": true},
    {"name": "Time (PT)", "value": "$(date '+%b %d, %I:%M %p')", "inline": true}
  ],
  "footer": {"text": "Overhead Flights • Via clawdbot CLI"}
}
EOF
)

# Build full message with embed
MESSAGE='{"embeds":['"$EMBED"']}'

echo "Posting to #jackbot-discoveries via clawdbot..."
clawdbot message send -t "$CHANNEL_ID" --channel discord -m "$MESSAGE"
