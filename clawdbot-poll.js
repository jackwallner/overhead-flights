#!/usr/bin/env node
/**
 * Clawdbot Feature Request Poller
 * 
 * Alternative to the webhook approach - polls a queue and posts via clawdbot CLI.
 * Run this on Jack's local machine as a cron job or service.
 * 
 * Usage:
 *   node clawdbot-poll.js
 * 
 * Or set up as a cron job (every minute):
 *   * * * * * cd /Users/jackwallner/clawd/overhead-flights && node clawdbot-poll.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '.feature-queue.json');
const CHANNEL_ID = '1465481924029186202'; // #jackbot-discoveries

function loadQueue() {
    try {
        if (fs.existsSync(QUEUE_FILE)) {
            return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading queue:', err.message);
    }
    return [];
}

function saveQueue(queue) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function postToClawdbot(feature, source, timestamp) {
    const embed = {
        title: '🔭 New Feature Request',
        description: feature,
        color: 0x4fc3f7,
        fields: [
            { name: 'Source', value: source, inline: true },
            { name: 'Time', value: new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }), inline: true }
        ],
        footer: { text: 'Overhead Flights • Via clawdbot' }
    };

    const message = {
        content: '',
        embeds: [embed]
    };

    // Use clawdbot CLI to send the message
    const cmd = `clawdbot message send ${CHANNEL_ID} '${JSON.stringify(message)}'`;
    
    try {
        execSync(cmd, { stdio: 'inherit' });
        return true;
    } catch (err) {
        console.error('Failed to post via clawdbot:', err.message);
        return false;
    }
}

function main() {
    const queue = loadQueue();
    
    if (queue.length === 0) {
        console.log('No pending feature requests.');
        return;
    }

    console.log(`Processing ${queue.length} feature request(s)...`);

    const remaining = [];
    
    for (const request of queue) {
        console.log(`Processing: ${request.feature.substring(0, 50)}...`);
        
        if (postToClawdbot(request.feature, request.source, request.timestamp)) {
            console.log('✓ Posted successfully');
        } else {
            console.log('✗ Failed, will retry');
            remaining.push(request);
        }
    }

    saveQueue(remaining);
    console.log(`Done. ${remaining.length} request(s) remaining in queue.`);
}

main();
