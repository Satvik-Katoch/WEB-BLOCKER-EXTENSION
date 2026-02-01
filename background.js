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

// --- ANTI-CHEAT REDIRECTS ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const state = await chrome.storage.local.get(['isFocusing']);
    if (state.isFocusing && changeInfo.url) {
        const forbiddenPages = ['chrome://extensions', 'chrome://settings', 'chrome://history'];
        const isForbidden = forbiddenPages.some(page => changeInfo.url.startsWith(page));
        if (isForbidden) {
            chrome.tabs.update(tabId, { url: 'dashboard.html' });
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

    // Clear EVERY dynamic rule before setting new ones to prevent ID collisions
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
                condition: { 
                    // Using a more robust pattern for domains
                    urlFilter: site, 
                    isUrlFilterCaseSensitive: false,
                    resourceTypes: ['main_frame', 'sub_frame'] 
                }
            });
        });

        keywords.forEach(keyword => {
            addRules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: { 
                    urlFilter: `*${keyword}*`, 
                    isUrlFilterCaseSensitive: false,
                    resourceTypes: ['main_frame', 'sub_frame'] 
                }
            });
        });
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: removeRuleIds,
        addRules: addRules
    });
}

// CRITICAL: Ensure rules are restored or cleared when browser starts
async function checkTimer() {
    const state = await chrome.storage.local.get(['isFocusing', 'endTime']);
    
    if (state.isFocusing) {
        if (state.endTime < Date.now()) {
            // Time expired while browser was closed
            await stopFocus();
        } else {
            // Focus is still valid! Force re-apply rules to the engine
            await refreshBlockingRules(true);
            
            // Re-create the alarm for the remaining time
            const remainingMins = (state.endTime - Date.now()) / 60000;
            chrome.alarms.create('focusTimer', { delayInMinutes: Math.max(0.1, remainingMins) });
        }
    } else {
        // Ensure rules are definitely off
        await refreshBlockingRules(false);
    }
}

// Listen for both browser startup and extension load/update
chrome.runtime.onStartup.addListener(checkTimer);
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        await chrome.storage.local.set({ isFocusing: false, blockedSites: [], blockedKeywords: [] });
        chrome.tabs.create({ url: 'dashboard.html' });
    } else {
        // On update, check if we were in a focus session
        await checkTimer();
    }
});