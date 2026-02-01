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

// --- ENHANCED URL MONITORING ---
// This acts as a fail-safe if the network blocker (DNR) is bypassed by a Service Worker
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only check if the URL actually changed
    if (!changeInfo.url) return;

    const state = await chrome.storage.local.get(['isFocusing', 'blockedSites', 'blockedKeywords']);
    
    if (state.isFocusing) {
        const url = changeInfo.url.toLowerCase();
        
        // 1. Anti-Cheat: Internal Chrome Pages
        const forbiddenInternal = ['chrome://extensions', 'chrome://settings', 'chrome://history'];
        if (forbiddenInternal.some(page => url.startsWith(page))) {
            chrome.tabs.update(tabId, { url: 'dashboard.html' });
            return;
        }

        // 2. Site Blocklist Fail-Safe
        const sites = state.blockedSites || [];
        // Check if the current URL contains any of the blocked domains
        const isSiteBlocked = sites.some(site => url.includes(site.toLowerCase()));
        
        if (isSiteBlocked) {
            console.log("Fail-safe redirect triggered for site:", url);
            chrome.tabs.update(tabId, { url: 'dashboard.html' });
            return;
        }

        // 3. Keyword Blocklist Fail-Safe
        const keywords = state.blockedKeywords || [];
        const isKeywordBlocked = keywords.some(keyword => url.includes(keyword.toLowerCase()));

        if (isKeywordBlocked) {
            console.log("Fail-safe redirect triggered for keyword:", url);
            chrome.tabs.update(tabId, { url: 'dashboard.html' });
            return;
        }
    }
});

async function startFocus(minutes) {
    const endTime = Date.now() + (minutes * 60 * 1000);
    await chrome.storage.local.set({ isFocusing: true, endTime: endTime });
    
    // Ensure the alarm is created
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

    // Clear EVERY dynamic rule before setting new ones
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);

    let addRules = [];
    if (active) {
        let ruleId = 1;
        
        // Combined network filter logic
        const allFilters = [
            ...sites.map(s => ({ filter: `*${s}*` })),
            ...keywords.map(k => ({ filter: `*${k}*` }))
        ];

        allFilters.forEach(item => {
            addRules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: { 
                    urlFilter: item.filter, 
                    isUrlFilterCaseSensitive: false,
                    // Catching every possible resource type
                    resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'stylesheet', 'object', 'ping', 'csp_report', 'media', 'websocket', 'other'] 
                }
            });
        });
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: removeRuleIds,
        addRules: addRules
    });
}

// Ensure rules are restored or cleared when browser starts
async function checkTimer() {
    const state = await chrome.storage.local.get(['isFocusing', 'endTime']);
    
    if (state.isFocusing) {
        if (state.endTime < Date.now()) {
            await stopFocus();
        } else {
            // Re-apply rules and re-arm alarm
            await refreshBlockingRules(true);
            const remainingMins = (state.endTime - Date.now()) / 60000;
            chrome.alarms.create('focusTimer', { delayInMinutes: Math.max(0.1, remainingMins) });
        }
    } else {
        await refreshBlockingRules(false);
    }
}

chrome.runtime.onStartup.addListener(checkTimer);
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        await chrome.storage.local.set({ isFocusing: false, blockedSites: [], blockedKeywords: [] });
        chrome.tabs.create({ url: 'dashboard.html' });
    } else {
        await checkTimer();
    }
});