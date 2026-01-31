const UI = {
  timeDisplay: document.getElementById('timeRemaining'),
  focusInput: document.getElementById('focusTime'),
  emergencyPass: document.getElementById('emergencyPass'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  stopPassInput: document.getElementById('stopPassInput'),
  siteInput: document.getElementById('siteInput'),
  keywordInput: document.getElementById('keywordInput'),
  addSiteBtn: document.getElementById('addSite'),
  addKeywordBtn: document.getElementById('addKeyword'),
  siteList: document.getElementById('siteList'),
  keywordList: document.getElementById('keywordList'),
  setupControls: document.getElementById('setupControls'),
  activeControls: document.getElementById('activeControls'),
  statusLabel: document.getElementById('statusLabel'),
  setupError: document.getElementById('setupError'),
  stopError: document.getElementById('stopError'),
  sessionIndicator: document.getElementById('sessionIndicator'),
  siteLockMsg: document.getElementById('siteLockMsg'),
  keywordLockMsg: document.getElementById('keywordLockMsg')
};

let isCurrentlyFocusing = false;

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  loadData();
  updateUIState();
  setInterval(updateUIState, 1000);
});

function setupEventListeners() {
  UI.addSiteBtn.addEventListener('click', () => {
      if (isCurrentlyFocusing) return;
      addToList('siteInput', 'blockedSites');
  });
  
  UI.addKeywordBtn.addEventListener('click', () => {
      if (isCurrentlyFocusing) return;
      addToList('keywordInput', 'blockedKeywords');
  });

  [UI.siteInput, UI.keywordInput].forEach(el => {
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !isCurrentlyFocusing) {
        const target = el.id === 'siteInput' ? 'blockedSites' : 'blockedKeywords';
        addToList(el.id, target);
      }
    });
  });

  UI.startBtn.addEventListener('click', async () => {
    const mins = parseInt(UI.focusInput.value);
    const pass = UI.emergencyPass.value.trim();

    if (!mins || mins <= 0 || !pass) {
      UI.setupError.style.display = 'block';
      return;
    }

    UI.setupError.style.display = 'none';
    UI.emergencyPass.value = ''; 
    
    await chrome.storage.local.set({ unlockPhrase: pass });
    chrome.runtime.sendMessage({ action: 'start_focus', minutes: mins });
  });

  UI.stopBtn.addEventListener('click', async () => {
    const inputPass = UI.stopPassInput.value.trim();
    const data = await chrome.storage.local.get(['unlockPhrase']);
    
    if (inputPass === data.unlockPhrase) {
      UI.stopError.style.display = 'none';
      UI.stopPassInput.value = '';
      chrome.runtime.sendMessage({ action: 'stop_focus' });
    } else {
      UI.stopError.style.display = 'block';
      UI.stopPassInput.animate([
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' }
      ], { duration: 100, iterations: 3 });
    }
  });
}

async function loadData() {
  const data = await chrome.storage.local.get(['blockedSites', 'blockedKeywords']);
  renderList(UI.siteList, data.blockedSites || [], 'blockedSites');
  renderList(UI.keywordList, data.blockedKeywords || [], 'blockedKeywords');
}

function renderList(container, items, storageKey) {
  container.innerHTML = '';
  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `list-item ${isCurrentlyFocusing ? 'locked-item' : ''}`;
    div.innerHTML = `<span>${item}</span><span class="remove-x" data-idx="${index}">×</span>`;
    
    div.querySelector('.remove-x').addEventListener('click', async () => {
      if (isCurrentlyFocusing) return; // Strict block
      const data = await chrome.storage.local.get([storageKey]);
      const list = data[storageKey] || [];
      list.splice(index, 1);
      await chrome.storage.local.set({ [storageKey]: list });
      loadData();
    });
    
    container.appendChild(div);
  });
}

async function addToList(inputId, storageKey) {
  if (isCurrentlyFocusing) return;
  const inputEl = document.getElementById(inputId);
  const val = inputEl.value.trim().toLowerCase();
  if (!val) return;

  const data = await chrome.storage.local.get([storageKey]);
  const list = data[storageKey] || [];
  
  if (!list.includes(val)) {
    list.push(val);
    await chrome.storage.local.set({ [storageKey]: list });
    inputEl.value = '';
    loadData();
  }
}

async function updateUIState() {
  const state = await chrome.storage.local.get(['isFocusing', 'endTime']);
  const wasFocusing = isCurrentlyFocusing;
  isCurrentlyFocusing = !!state.isFocusing;

  // If focus state changed, re-render the lists to show/hide remove buttons
  if (wasFocusing !== isCurrentlyFocusing) {
      loadData();
  }
  
  if (isCurrentlyFocusing) {
    const remaining = Math.max(0, state.endTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    
    UI.timeDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    UI.setupControls.classList.add('hidden');
    UI.activeControls.classList.remove('hidden');
    
    UI.statusLabel.innerText = "FOCUS ACTIVE";
    UI.statusLabel.style.background = "#10b981";
    UI.statusLabel.style.color = "white";
    UI.statusLabel.classList.add('pulse');
    
    UI.sessionIndicator.innerText = "TIME TO WORK";

    // Disable Editing
    UI.addSiteBtn.disabled = true;
    UI.addKeywordBtn.disabled = true;
    UI.siteInput.disabled = true;
    UI.keywordInput.disabled = true;
    UI.siteLockMsg.classList.remove('hidden');
    UI.keywordLockMsg.classList.remove('hidden');

    if (remaining <= 0) {
       chrome.runtime.sendMessage({ action: 'check_status' });
    }
  } else {
    UI.timeDisplay.innerText = "00:00";
    UI.setupControls.classList.remove('hidden');
    UI.activeControls.classList.add('hidden');
    
    UI.statusLabel.innerText = "STANDBY";
    UI.statusLabel.style.background = "#e2e8f0";
    UI.statusLabel.style.color = "#475569";
    UI.statusLabel.classList.remove('pulse');
    
    UI.sessionIndicator.innerText = "READY TO FOCUS";
    UI.stopError.style.display = 'none';

    // Enable Editing
    UI.addSiteBtn.disabled = false;
    UI.addKeywordBtn.disabled = false;
    UI.siteInput.disabled = false;
    UI.keywordInput.disabled = false;
    UI.siteLockMsg.classList.add('hidden');
    UI.keywordLockMsg.classList.add('hidden');
  }
}