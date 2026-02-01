
(function() {
    const CONFIG = {
        // Access code to unlock the form
        accessCode: 'gohawks',
        // GitHub repo details
        repo: 'jackwallner/overhead-flights'
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
        const lockedView = document.getElementById('locked-view');
        if (!lockedView) return;

        const formView = document.getElementById('form-view');
        const successView = document.getElementById('success-view');
        const passInput = document.getElementById('password-input');
        const passError = document.getElementById('password-error');
        const unlockBtn = document.getElementById('unlock-btn');

        unlockBtn.onclick = () => {
            if (passInput.value.toLowerCase() === CONFIG.accessCode) {
                lockedView.classList.add('hidden');
                formView.classList.remove('hidden');
            } else {
                passError.classList.remove('hidden');
                passInput.value = '';
            }
        };

        passInput.onkeydown = (e) => {
            if (e.key === 'Enter') unlockBtn.click();
        };

        const submitBtn = document.getElementById('submit-btn');
        const statusMsg = document.getElementById('submit-status');

        submitBtn.onclick = () => {
            const title = document.getElementById('req-title').value.trim();
            const desc = document.getElementById('req-desc').value.trim();
            const priority = document.getElementById('req-priority').value;

            if (!title || !desc) {
                statusMsg.textContent = 'Please fill in all fields';
                statusMsg.classList.remove('hidden');
                return;
            }

            // Build the GitHub issue URL with pre-filled content
            const issueBody = buildIssueBody(title, desc, priority);
            const githubUrl = `https://github.com/${CONFIG.repo}/issues/new?` + 
                `title=${encodeURIComponent(`[Feature Request] ${title}`)}&` +
                `body=${encodeURIComponent(issueBody)}&` +
                `labels=${encodeURIComponent('feature-request')}`;

            // Open GitHub issue creation in new tab
            window.open(githubUrl, '_blank');

            // Show success state
            formView.classList.add('hidden');
            successView.classList.remove('hidden');
        };
    }

    function buildIssueBody(title, description, priority) {
        const timestamp = new Date().toLocaleString('en-US', { 
            timeZone: 'America/Los_Angeles',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        return `## Feature Request

**Description:**
${description}

**Priority:** ${priority}
**Submitted:** ${timestamp} PT
**Source:** overhead-flights web app

---
*This issue was created from the [Overhead Flights feature request form](https://jackwallner.github.io/overhead-flights/feature-request.html).*
`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
