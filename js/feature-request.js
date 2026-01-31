
(function() {
    const CONFIG = {
        password: 'gohawks',
        repo: 'jackwallner/overhead-flights'
    };

    function init() {
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) {
            console.error('Feature Request: .header-actions not found');
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'feature-request-btn';
        btn.innerHTML = '💡 Request Feature';
        btn.title = 'Submit a feature request to Jackle';
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
                                    Tell Jackle what you want to add. I'll implement it and republish the site.
                                </p>
                                <textarea id="feature-text" placeholder="I want a dark mode toggle..."></textarea>
                                <button id="btn-submit-feature" class="btn btn-primary btn-block">Send to Jackle</button>
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
        btn.textContent = 'Opening GitHub...';
        status.className = 'feature-status';
        status.textContent = '';

        // Open GitHub issue creation with pre-filled content
        const title = encodeURIComponent(`[Feature Request] ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        const body = encodeURIComponent(`**Feature Request:**\n${text}\n\n**Submitted from:** overhead-flights web app\n**Time:** ${new Date().toLocaleString('en-US', {timeZone: 'America/Los_Angeles'})} PT`);
        
        const githubUrl = `https://github.com/${CONFIG.repo}/issues/new?labels=feature-request&title=${title}&body=${body}`;
        
        // Open in new tab
        window.open(githubUrl, '_blank');
        
        status.textContent = 'GitHub issue opened! Submit it there to notify Jackle.';
        status.className = 'feature-status success';
        
        setTimeout(closeFeatureModal, 3000);
        btn.disabled = false;
        btn.textContent = 'Send to Jackle';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
