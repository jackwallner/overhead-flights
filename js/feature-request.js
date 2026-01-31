
(function() {
    const CONFIG = {
        password: 'gohawks',
        // Discord webhook for #jackbot-discoveries
        webhookUrl: 'https://discord.com/api/webhooks/1466251414132097209/9Oom_K9RubslhIUn1lPiYmq9FG15UI_aFsPHB6gzyCQrxenfamdywRu_l2FB2OkRVL8q'
    };

    function init() {
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) {
            console.error('Feature Request: .header-actions not found');
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'feature-request-btn';
        btn.innerHTML = '💡 Feature Request';
        btn.title = 'Submit a feature request';
        btn.onclick = openFeatureModal;
        
        headerActions.insertBefore(btn, headerActions.firstChild);
        console.log('Feature Request button injected');

        const modalHtml = `
            <div id="feature-modal" class="modal-overlay hidden">
                <div class="modal animate-in">
                    <div class="modal-header">
                        <h2>💡 Request a Feature</h2>
                        <button id="close-feature-modal" class="btn" style="padding: 4px 8px;">✕</button>
                    </div>
                    <div class="modal-body">
                        <div id="feature-auth-section">
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" id="feature-password" placeholder="Enter password...">
                            </div>
                            <button id="btn-feature-auth" class="btn btn-primary btn-block">Unlock</button>
                        </div>
                        <div id="feature-input-section" class="hidden">
                            <div class="feature-form">
                                <p style="font-size: 14px; color: var(--text-secondary);">
                                    Submit your feature request. The development team will review and consider it for a future update.
                                </p>
                                <textarea id="feature-text" placeholder="I want a dark mode toggle..."></textarea>
                                <button id="btn-submit-feature" class="btn btn-primary btn-block">Submit Request</button>
                                <div id="feature-status-msg" class="feature-status"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('close-feature-modal').onclick = closeFeatureModal;
        document.getElementById('btn-feature-auth').onclick = handleAuth;
        document.getElementById('btn-submit-feature').onclick = handleSubmit;
        document.getElementById('feature-password').onkeyup = (e) => { if(e.key === 'Enter') handleAuth(); };
    }

    function openFeatureModal() {
        document.getElementById('feature-modal').classList.remove('hidden');
        document.getElementById('feature-password').focus();
    }

    function closeFeatureModal() {
        document.getElementById('feature-modal').classList.add('hidden');
        resetModal();
    }

    function resetModal() {
        document.getElementById('feature-auth-section').classList.remove('hidden');
        document.getElementById('feature-input-section').classList.add('hidden');
        document.getElementById('feature-password').value = '';
        document.getElementById('feature-text').value = '';
        const status = document.getElementById('feature-status-msg');
        status.className = 'feature-status';
        status.textContent = '';
    }

    function handleAuth() {
        const pass = document.getElementById('feature-password').value;
        if (pass.toLowerCase() === CONFIG.password) {
            document.getElementById('feature-auth-section').classList.add('hidden');
            document.getElementById('feature-input-section').classList.remove('hidden');
            document.getElementById('feature-text').focus();
        } else {
            alert('Wrong password, mate.');
        }
    }

    async function handleSubmit() {
        const text = document.getElementById('feature-text').value.trim();
        if (!text) return;

        const btn = document.getElementById('btn-submit-feature');
        const status = document.getElementById('feature-status-msg');
        
        btn.disabled = true;
        btn.textContent = 'Sending...';
        status.className = 'feature-status';
        status.textContent = '';

        try {
            // Post directly to Discord webhook
            const response = await fetch(CONFIG.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: '🔭 New Feature Request',
                        description: text.length > 4000 ? text.substring(0, 4000) + '...' : text,
                        color: 0x4fc3f7,
                        fields: [
                            { name: 'Source', value: 'overhead-flights', inline: true },
                            { name: 'Time (PT)', value: new Date().toLocaleString('en-US', { 
                                timeZone: 'America/Los_Angeles',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            }), inline: true }
                        ],
                        footer: { text: 'Overhead Flights • Submit features from the app' }
                    }]
                })
            });

            if (response.ok) {
                status.textContent = 'Request sent! Jackle will check it out.';
                status.className = 'feature-status success';
                setTimeout(closeFeatureModal, 2000);
            } else {
                throw new Error('Discord webhook failed');
            }
        } catch (err) {
            console.error('Feature request failed:', err);
            status.textContent = 'Error sending request. Jackle might be sleeping.';
            status.className = 'feature-status error';
            btn.disabled = false;
            btn.textContent = 'Send to Jackle';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
