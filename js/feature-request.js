
(function() {
    const CONFIG = {
        // Discord webhook for #jackbot-discoveries
        webhookUrl: 'https://discord.com/api/webhooks/1466251414132097209/9Oom_K9RubslhIUn1lPiYmq9FG15UI_aFsPHB6gzyCQrxenfamdywRu_l2FB2OkRVL8q'
    };

    // Conversation steps
    const CONVERSATION = [
        {
            id: 'feature',
            question: 'What feature would you like to see?',
            placeholder: 'I want a dark mode toggle...',
            type: 'text'
        },
        {
            id: 'problem',
            question: 'What problem does this solve for you?',
            placeholder: 'It hurts my eyes at night when checking flights...',
            type: 'text'
        },
        {
            id: 'priority',
            question: 'How important is this to you?',
            placeholder: '',
            type: 'choice',
            options: ['Nice to have', 'Would be helpful', 'Really need this', 'Critical']
        },
        {
            id: 'contact',
            question: 'How can we reach you if we have questions? (optional)',
            placeholder: 'Discord username, email, or leave blank for anonymous',
            type: 'text',
            optional: true
        }
    ];

    let currentStep = 0;
    let answers = {};

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
                <div class="modal animate-in" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>💡 Feature Request</h2>
                        <button id="close-feature-modal" class="btn" style="padding: 4px 8px;">✕</button>
                    </div>
                    <div class="modal-body">
                        <div id="feature-conversation">
                            <div id="jackle-avatar" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #4fc3f7, #3b82f6); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">🤖</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 14px;">Jackle</div>
                                    <div style="font-size: 12px; color: var(--text-muted);">Overhead Flights Assistant</div>
                                </div>
                            </div>
                            
                            <div id="chat-history" style="max-height: 200px; overflow-y: auto; margin-bottom: 16px; padding: 12px; background: var(--bg-page); border-radius: var(--radius-sm);"></div>
                            
                            <div id="current-question">
                                <p id="question-text" style="font-size: 15px; margin-bottom: 12px; color: var(--text-primary);"></p>
                                <div id="input-area">
                                    <textarea id="feature-input" placeholder="" style="width: 100%; min-height: 80px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: 14px; resize: vertical;"></textarea>
                                    <div id="choice-area" style="display: none; gap: 8px; flex-wrap: wrap; margin-top: 8px;"></div>
                                </div>
                                <div style="display: flex; gap: 8px; margin-top: 12px;">
                                    <button id="btn-submit-answer" class="btn btn-primary">Send</button>
                                    <button id="btn-skip-optional" class="btn" style="display: none;">Skip</button>
                                    <span id="step-indicator" style="margin-left: auto; font-size: 12px; color: var(--text-muted); align-self: center;"></span>
                                </div>
                            </div>
                            
                            <div id="feature-status-msg" class="feature-status" style="margin-top: 12px;"></div>
                        </div>
                        
                        <div id="feature-summary" class="hidden">
                            <h3 style="margin-bottom: 16px;">📋 Summary</h3>
                            <div id="summary-content" style="background: var(--bg-page); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 14px; line-height: 1.6;"></div>
                            <div style="display: flex; gap: 8px;">
                                <button id="btn-send-request" class="btn btn-primary" style="flex: 1;">Send to Development Team</button>
                                <button id="btn-start-over" class="btn">Start Over</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('close-feature-modal').onclick = closeFeatureModal;
        document.getElementById('btn-submit-answer').onclick = handleAnswer;
        document.getElementById('btn-skip-optional').onclick = () => {
            answers[CONVERSATION[currentStep].id] = 'Skipped (optional)';
            nextStep();
        };
        document.getElementById('btn-send-request').onclick = submitRequest;
        document.getElementById('btn-start-over').onclick = resetConversation;
        
        document.getElementById('feature-input').onkeyup = (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAnswer(); 
            }
        };
    }

    function openFeatureModal() {
        document.getElementById('feature-modal').classList.remove('hidden');
        resetConversation();
    }

    function closeFeatureModal() {
        document.getElementById('feature-modal').classList.add('hidden');
    }

    function resetConversation() {
        currentStep = 0;
        answers = {};
        document.getElementById('chat-history').innerHTML = '';
        document.getElementById('feature-conversation').classList.remove('hidden');
        document.getElementById('feature-summary').classList.add('hidden');
        document.getElementById('feature-status-msg').className = 'feature-status';
        document.getElementById('feature-status-msg').textContent = '';
        renderStep();
    }

    function renderStep() {
        const step = CONVERSATION[currentStep];
        const questionEl = document.getElementById('question-text');
        const inputEl = document.getElementById('feature-input');
        const choiceArea = document.getElementById('choice-area');
        const skipBtn = document.getElementById('btn-skip-optional');
        const stepIndicator = document.getElementById('step-indicator');
        
        questionEl.textContent = step.question;
        inputEl.value = answers[step.id] || '';
        inputEl.placeholder = step.placeholder;
        stepIndicator.textContent = `Step ${currentStep + 1} of ${CONVERSATION.length}`;
        
        if (step.type === 'choice') {
            inputEl.style.display = 'none';
            choiceArea.style.display = 'flex';
            choiceArea.innerHTML = step.options.map(opt => 
                `<button class="btn choice-btn ${answers[step.id] === opt ? 'btn-primary' : ''}" data-value="${opt}">${opt}</button>`
            ).join('');
            
            choiceArea.querySelectorAll('.choice-btn').forEach(btn => {
                btn.onclick = () => {
                    answers[step.id] = btn.dataset.value;
                    choiceArea.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('btn-primary'));
                    btn.classList.add('btn-primary');
                };
            });
        } else {
            inputEl.style.display = 'block';
            choiceArea.style.display = 'none';
            inputEl.focus();
        }
        
        skipBtn.style.display = step.optional ? 'inline-flex' : 'none';
    }

    function addToChat(sender, message) {
        const chatHistory = document.getElementById('chat-history');
        const isJackle = sender === 'Jackle';
        const bubble = document.createElement('div');
        bubble.style.cssText = `margin-bottom: 8px; display: flex; ${isJackle ? '' : 'flex-direction: row-reverse;'}`;
        
        bubble.innerHTML = `
            <div style="max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.4; ${isJackle ? 'background: var(--bg-card); border: 1px solid var(--border);' : 'background: var(--accent); color: white; margin-left: auto;'}">
                <div style="font-weight: 600; font-size: 11px; margin-bottom: 2px; ${isJackle ? 'color: var(--accent);' : 'color: rgba(255,255,255,0.8);'}">${sender}</div>
                <div>${message}</div>
            </div>
        `;
        
        chatHistory.appendChild(bubble);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function handleAnswer() {
        const step = CONVERSATION[currentStep];
        let answer;
        
        if (step.type === 'choice') {
            answer = answers[step.id];
            if (!answer) {
                showStatus('Please select an option', 'error');
                return;
            }
        } else {
            answer = document.getElementById('feature-input').value.trim();
            if (!answer && !step.optional) {
                showStatus('Please enter a response', 'error');
                return;
            }
            if (!answer && step.optional) {
                answer = 'Not provided';
            }
        }
        
        answers[step.id] = answer;
        addToChat('Jackle', step.question);
        addToChat('You', answer);
        
        nextStep();
    }

    function nextStep() {
        currentStep++;
        
        if (currentStep >= CONVERSATION.length) {
            showSummary();
        } else {
            renderStep();
        }
    }

    function showSummary() {
        document.getElementById('feature-conversation').classList.add('hidden');
        document.getElementById('feature-summary').classList.remove('hidden');
        
        const summaryContent = document.getElementById('summary-content');
        summaryContent.innerHTML = `
            <p><strong>🎯 Feature:</strong> ${answers.feature}</p>
            <p style="margin-top: 8px;"><strong>❓ Problem:</strong> ${answers.problem}</p>
            <p style="margin-top: 8px;"><strong>📊 Priority:</strong> ${answers.priority}</p>
            <p style="margin-top: 8px;"><strong>📧 Contact:</strong> ${answers.contact || 'Anonymous'}</p>
        `;
    }

    async function submitRequest() {
        const btn = document.getElementById('btn-send-request');
        btn.disabled = true;
        btn.textContent = 'Sending...';
        
        try {
            const response = await fetch(CONFIG.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: '🔭 New Feature Request',
                        description: answers.feature,
                        color: 0x4fc3f7,
                        fields: [
                            { name: 'Problem', value: answers.problem.substring(0, 1024) || 'Not specified', inline: false },
                            { name: 'Priority', value: answers.priority, inline: true },
                            { name: 'Contact', value: answers.contact || 'Anonymous', inline: true },
                            { name: 'Source', value: 'overhead-flights', inline: true },
                            { name: 'Time (PT)', value: new Date().toLocaleString('en-US', { 
                                timeZone: 'America/Los_Angeles',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            }), inline: true }
                        ],
                        footer: { text: 'Reply in thread to ask follow-up questions' }
                    }]
                })
            });

            if (response.ok) {
                showStatus('Request sent! The development team will review it. ✈️', 'success');
                setTimeout(closeFeatureModal, 3000);
            } else {
                throw new Error('Discord webhook failed');
            }
        } catch (err) {
            console.error('Feature request failed:', err);
            showStatus('Error sending request. Please try again.', 'error');
            btn.disabled = false;
            btn.textContent = 'Send to Development Team';
        }
    }

    function showStatus(message, type) {
        const status = document.getElementById('feature-status-msg');
        status.textContent = message;
        status.className = `feature-status ${type}`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
