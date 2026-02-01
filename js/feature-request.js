
(function() {
    const CONFIG = {
        // Discord webhook for #jackbot-discoveries
        discordWebhook: 'https://discord.com/api/webhooks/1467631595245535406/sUgNUZ97f3TgAGRfg1MUbbHXUTLJfz2TKhLAq3wp_hCQ9wyYnYdegImuwnCrUIYqeof5',
        // LocalStorage key for failed submissions
        storageKey: 'pendingFeatureRequests'
    };

    function init() {
        // If we're on the main index page, just handle the header button
        if (document.getElementById('main-app')) {
            const headerActions = document.querySelector('.header-actions');
            if (headerActions) {
                let btn = headerActions.querySelector('.feature-request-btn');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.className = 'btn feature-request-btn';
                    btn.innerHTML = '💡 Request Feature';
                    btn.onclick = () => window.location.href = 'feature-request.html';
                    headerActions.insertBefore(btn, headerActions.firstChild);
                } else {
                    btn.onclick = () => window.location.href = 'feature-request.html';
                }
            }
            return;
        }

        // If we're on the feature-request.html page, handle the form
        const formView = document.getElementById('form-view');
        if (!formView) return;

        const submitBtn = document.getElementById('submit-btn');
        const statusMsg = document.getElementById('submit-status');

        submitBtn.onclick = async () => {
            const title = document.getElementById('req-title').value.trim();
            const desc = document.getElementById('req-desc').value.trim();
            const priority = document.getElementById('req-priority').value;

            if (!title || !desc) {
                statusMsg.textContent = 'Please fill in all fields';
                statusMsg.classList.remove('hidden');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            statusMsg.classList.add('hidden');

            const timestamp = new Date().toLocaleString('en-US', { 
                timeZone: 'America/Los_Angeles',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });

            const requestData = {
                title,
                description: desc,
                priority,
                timestamp,
                submittedAt: new Date().toISOString()
            };

            try {
                // Try to post to Discord
                const result = await postToDiscord(requestData);
                
                if (result.success) {
                    // Show success
                    showSuccess();
                    // Clear form
                    document.getElementById('req-title').value = '';
                    document.getElementById('req-desc').value = '';
                } else {
                    throw new Error(result.error || 'Failed to send');
                }
            } catch (err) {
                console.error('Submission failed:', err);
                
                // Save to localStorage for recovery
                savePendingRequest(requestData);
                
                // Show user the error but reassure them
                statusMsg.innerHTML = `
                    <div style="color: #f59e0b; margin-bottom: 8px;">
                        ⚠️ Couldn't send immediately, but your request is saved!
                    </div>
                    <div style="font-size: 13px; color: #64748b;">
                        Error: ${err.message}<br>
                        Please screenshot this page and share it with Jack.
                    </div>
                `;
                statusMsg.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Try Again';
            }
        };

        // Check for any pending requests on load (admin recovery)
        checkPendingRequests();
    }

    async function postToDiscord(data) {
        const colors = {
            'High': 0xef4444,    // Red
            'Medium': 0xf59e0b,  // Orange  
            'Low': 0x3b82f6      // Blue
        };

        const embed = {
            title: '🔭 New Feature Request',
            description: `**${data.title}**`,
            color: colors[data.priority] || 0x6b7280,
            fields: [
                { 
                    name: 'Description', 
                    value: data.description.length > 1000 
                        ? data.description.substring(0, 997) + '...' 
                        : data.description,
                    inline: false 
                },
                { name: 'Priority', value: data.priority, inline: true },
                { name: 'Time (PT)', value: data.timestamp, inline: true }
            ],
            footer: { text: 'Overhead Flights' },
            timestamp: new Date().toISOString()
        };

        const response = await fetch(CONFIG.discordWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Discord API ${response.status}: ${errorText}`);
        }

        return { success: true };
    }

    function savePendingRequest(data) {
        try {
            const pending = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]');
            pending.push(data);
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(pending));
            console.log('Request saved to localStorage:', data);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    function checkPendingRequests() {
        try {
            const pending = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]');
            if (pending.length > 0) {
                console.log(`${pending.length} pending feature requests in localStorage:`, pending);
            }
        } catch (e) {
            console.error('Failed to check localStorage:', e);
        }
    }

    function showSuccess() {
        const formView = document.getElementById('form-view');
        const successView = document.getElementById('success-view');
        
        if (formView && successView) {
            formView.classList.add('hidden');
            successView.classList.remove('hidden');
        }
    }

    // Expose recovery function for admin use
    window.recoverPendingRequests = function() {
        try {
            const pending = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]');
            if (pending.length === 0) {
                console.log('No pending requests to recover');
                return [];
            }
            console.log('Pending requests:', pending);
            return pending;
        } catch (e) {
            console.error('Failed to recover:', e);
            return [];
        }
    };

    // Expose clear function
    window.clearPendingRequests = function() {
        try {
            localStorage.removeItem(CONFIG.storageKey);
            console.log('Pending requests cleared');
        } catch (e) {
            console.error('Failed to clear:', e);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
