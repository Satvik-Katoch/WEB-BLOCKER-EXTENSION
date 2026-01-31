// Open Dashboard when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'dashboard.html' });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start_focus') {
        startFocus(request.minutes);
    } else if (request.action === 'stop_focus') {
        stopFocus();
    } else if (request.action === 'check_status') {
        checkTimer();
    }
});

// --- ANTI-CHEAT LOGIC ---
// This listens for any tab updates and redirects if you try to access extensions
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const state = await chrome.storage.local.get(['isFocusing']);
    
    // Check if we are in Focus Mode and the user is trying to access settings/extensions
    if (state.isFocusing && changeInfo.url) {
        const forbiddenPages = [
            'chrome://extensions',
            'chrome://settings',
            'chrome://history' // no-more history deletions during focus mode :)
        ];

        const isForbidden = forbiddenPages.some(page => changeInfo.url.startsWith(page));

        if (isForbidden) {
            // Redirect them back to the dashboard!
            chrome.tabs.update(tabId, { url: 'dashboard.html' });
        }
    }
});

async function startFocus(minutes) {
    const endTime = Date.now() + (minutes * 60 * 1000);
    await chrome.storage.local.set({ isFocusing: true, endTime: endTime });
    chrome.alarms.create('focusTimer', { delayInMinutes: minutes });
    await refreshBlockingRules(true);
}

async function stopFocus() {
    await chrome.storage.local.set({ isFocusing: false, endTime: 0, unlockPhrase: '' });
    chrome.alarms.clear('focusTimer');
    await refreshBlockingRules(false);
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'focusTimer') {
        stopFocus();
    }
});

async function refreshBlockingRules(active) {
    const data = await chrome.storage.local.get(['blockedSites', 'blockedKeywords']);
    const sites = data.blockedSites || [];
    const keywords = data.blockedKeywords || [];
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);

    let addRules = [];
    if (active) {
        let ruleId = 1;
        sites.forEach(site => {
            addRules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: { urlFilter: `*${site}*`, resourceTypes: ['main_frame'] }
            });
        });
        keywords.forEach(keyword => {
            addRules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: { urlFilter: `*${keyword}*`, resourceTypes: ['main_frame'] }
            });
        });
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: removeRuleIds,
        addRules: addRules
    });
}

async function checkTimer() {
    const state = await chrome.storage.local.get(['isFocusing', 'endTime']);
    if (state.isFocusing && state.endTime < Date.now()) {
        await stopFocus();
    }
}

chrome.runtime.onStartup.addListener(checkTimer);
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ isFocusing: false, blockedSites: [], blockedKeywords: [] });
    chrome.tabs.create({ url: 'dashboard.html' });
});