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
  sessionIndicator: document.getElementById('sessionIndicator')
};

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  loadData();
  updateUIState();
  // Sync the timer every second
  setInterval(updateUIState, 1000);
});

function setupEventListeners() {
  // Add Website Button
  UI.addSiteBtn.addEventListener('click', () => addToList('siteInput', 'blockedSites'));
  
  // Add Keyword Button
  UI.addKeywordBtn.addEventListener('click', () => addToList('keywordInput', 'blockedKeywords'));

  // Allow "Enter" key for inputs
  [UI.siteInput, UI.keywordInput].forEach(el => {
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const target = el.id === 'siteInput' ? 'blockedSites' : 'blockedKeywords';
        addToList(el.id, target);
      }
    });
  });

  // Start Focus Button
  UI.startBtn.addEventListener('click', async () => {
    const mins = parseInt(UI.focusInput.value);
    const pass = UI.emergencyPass.value.trim();

    if (!mins || mins <= 0 || !pass) {
      UI.setupError.style.display = 'block';
      return;
    }

    UI.setupError.style.display = 'none';
    // Clear setup fields
    UI.emergencyPass.value = ''; 
    
    await chrome.storage.local.set({ unlockPhrase: pass });
    chrome.runtime.sendMessage({ action: 'start_focus', minutes: mins });
  });

  // Emergency Stop Button
  UI.stopBtn.addEventListener('click', async () => {
    const inputPass = UI.stopPassInput.value.trim();
    const data = await chrome.storage.local.get(['unlockPhrase']);
    
    if (inputPass === data.unlockPhrase) {
      UI.stopError.style.display = 'none';
      UI.stopPassInput.value = '';
      chrome.runtime.sendMessage({ action: 'stop_focus' });
    } else {
      UI.stopError.style.display = 'block';
      // Visual feedback for error
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
    div.className = 'list-item';
    div.innerHTML = `<span>${item}</span><span class="remove-x" data-idx="${index}">×</span>`;
    
    div.querySelector('.remove-x').addEventListener('click', async () => {
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
  
  if (state.isFocusing) {
    const remaining = Math.max(0, state.endTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    
    UI.timeDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // UI Transitions
    UI.setupControls.classList.add('hidden');
    UI.activeControls.classList.remove('hidden');
    
    // Status Badge Logic
    UI.statusLabel.innerText = "FOCUS ACTIVE";
    UI.statusLabel.style.background = "#10b981";
    UI.statusLabel.style.color = "white";
    UI.statusLabel.classList.add('pulse');
    
    UI.sessionIndicator.innerText = "TIME TO WORK";

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
  }
}