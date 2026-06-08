function initCameraCards() {
    document.querySelectorAll('.camera-card').forEach(card => {
        const view = card.querySelector('.camera-view');
        const edit = card.querySelector('.camera-edit');

        card.querySelector('.btn-edit')?.addEventListener('click', () => {
            view.classList.add('hidden');
            edit.classList.remove('hidden');
        });

        card.querySelector('.btn-cancel')?.addEventListener('click', () => {
            edit.classList.add('hidden');
            view.classList.remove('hidden');
        });

        card.querySelector('.btn-copy-url')?.addEventListener('click', async (e) => {
            const url = e.currentTarget.dataset.url;
            const feedback = card.querySelector('.copy-feedback');
            try {
                await navigator.clipboard.writeText(url);
                if (feedback) {
                    feedback.textContent = 'Copied!';
                    setTimeout(() => { feedback.textContent = ''; }, 2000);
                }
            } catch {
                if (feedback) feedback.textContent = 'Copy failed';
            }
        });
    });
}

function initAddCameraToggle() {
    const toggle = document.getElementById('toggle-add-camera');
    const panel = document.getElementById('add-camera-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !isHidden);
        toggle.textContent = isHidden ? '− Cancel' : '+ Add Camera';
    });
}

function initLogs() {
    const logContainer = document.getElementById('log-container');
    const troubleshooting = document.getElementById('troubleshooting-section');
    if (!logContainer) return;

    let isScrolledToBottom = true;
    let pollTimer = null;

    logContainer.addEventListener('scroll', () => {
        isScrolledToBottom = Math.abs(
            logContainer.scrollHeight - logContainer.clientHeight - logContainer.scrollTop
        ) < 10;
    });

    async function fetchLogs() {
        try {
            const response = await fetch('/api/logs');
            const logs = await response.json();

            if (logs.length > 0) {
                logContainer.innerHTML = logs.map(log =>
                    `<div style="margin-bottom: 4px; border-bottom: 1px solid #222; padding-bottom: 2px;">${log}</div>`
                ).join('');

                if (isScrolledToBottom) {
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    }

    function startPolling() {
        if (pollTimer) return;
        fetchLogs();
        pollTimer = setInterval(fetchLogs, 2000);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    if (troubleshooting) {
        troubleshooting.addEventListener('toggle', () => {
            if (troubleshooting.open) {
                startPolling();
            } else {
                stopPolling();
            }
        });

        if (troubleshooting.open) {
            startPolling();
        }
    } else {
        startPolling();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCameraCards();
    initAddCameraToggle();
    initLogs();
});
