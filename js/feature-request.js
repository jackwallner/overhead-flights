
(function() {
    const CONFIG = {
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
        const formView = document.getElementById('form-view');
        if (!formView) return;

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

            submitBtn.disabled = true;
            submitBtn.textContent = 'Opening GitHub...';
            statusMsg.classList.add('hidden');

            // Build the issue body
            const issueBody = buildIssueBody(title, desc, priority);
            
            // Build GitHub issue URL with template
            const params = new URLSearchParams({
                title: `[Feature Request] ${title}`,
                body: issueBody
            });

            const githubUrl = `https://github.com/${CONFIG.repo}/issues/new?${params.toString()}`;

            // Redirect to GitHub (same window, won't be blocked)
            window.location.href = githubUrl;
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
*Submitted via [Overhead Flights feature request form](https://jackwallner.github.io/overhead-flights/feature-request.html)*
`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
