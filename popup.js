(function () {
  'use strict';

  const STORAGE_KEY = 'antipromo_stats';

  async function loadStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] || { blocked: 0, pages: 0 });
      });
    });
  }

  async function updateUI() {
    const stats = await loadStats();

    document.getElementById('blockedCount').textContent = stats.blocked || 0;
    document.getElementById('pagesCount').textContent = stats.pages || 0;

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (
      tab &&
      tab.url &&
      (tab.url.includes('yandex') || tab.url.includes('ya.ru'))
    ) {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Работает на этой странице';
    } else {
      statusDot.className = 'status-dot off';
      statusText.textContent = 'Не активен';
    }
  }

  function setupToggle() {
    const toggle = document.getElementById('enabledToggle');

    chrome.storage.local.get(['antipromo_enabled'], (result) => {
      const enabled = result.antipromo_enabled !== false;
      toggle.checked = enabled;
    });

    toggle.addEventListener('change', () => {
      const enabled = toggle.checked;
      chrome.storage.local.set({ antipromo_enabled: enabled });

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'antipromo_toggle',
            enabled,
          });
        }
      });
    });
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'antipromo_stats_updated') {
        updateUI();
      }
    });
  }

  async function init() {
    await updateUI();
    setupToggle();
    setupMessageListener();
  }

  document.addEventListener('DOMContentLoaded', init);
})();