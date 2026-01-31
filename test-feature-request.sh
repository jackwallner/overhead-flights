#!/bin/bash
# Test the feature request flow locally

set -e

FEATURE="${1:-Test feature request from CLI}"
SOURCE="overhead-flights-test"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Test local file queue approach
QUEUE_FILE=".feature-queue.json"

# Create queue entry
ENTRY=$(cat <<EOF
{
  "id": "$(uuidgen 2>/dev/null || echo "test-$(date +%s)")",
  "feature": "$FEATURE",
  "source": "$SOURCE",
  "timestamp": "$TIMESTAMP",
  "status": "pending"
}
EOF
)

# Add to queue
if [ -f "$QUEUE_FILE" ]; then
    QUEUE=$(cat "$QUEUE_FILE")
    # Simple append (not proper JSON array manipulation, but works for testing)
    echo "$QUEUE" | sed 's/]$//' > "$QUEUE_FILE.tmp"
    echo ",$ENTRY]" >> "$QUEUE_FILE.tmp"
    mv "$QUEUE_FILE.tmp" "$QUEUE_FILE"
else
    echo "[$ENTRY]" > "$QUEUE_FILE"
fi

echo "✓ Feature request added to queue: $FEATURE"
echo ""
echo "To post via clawdbot, run:"
echo "  node clawdbot-poll.js"
