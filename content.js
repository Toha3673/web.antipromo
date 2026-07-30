(function () {
  'use strict';

  let enabled = true;
  let blockedCount = 0;

  function loadState() {
    try {
      chrome.storage.local.get(
        ['antipromo_enabled', 'antipromo_stats'],
        (result) => {
          enabled = result.antipromo_enabled !== false;
          const stats = result.antipromo_stats || {blocked: 0, pages: 0};
          blockedCount = stats.blocked || 0;
        }
      );
    } catch (e) {}
  }

  function saveStats(additionalBlocked) {
    blockedCount += additionalBlocked;
    try {
      chrome.storage.local.get(['antipromo_stats'], (result) => {
        const stats = result.antipromo_stats || {blocked: 0, pages: 0};
        stats.blocked = blockedCount;
        if (additionalBlocked > 0) {
          stats.pages = (stats.pages || 0) + 1;
        }
        chrome.storage.local.set({antipromo_stats: stats});
      });
    } catch (e) {}
  }

  function hasPromoLabel(element) {
    const ownText = element.textContent.toLowerCase().trim();
    if (ownText === 'промо' || ownText === 'promo') {
      return true;
    }

    const children = element.querySelectorAll('span, div, p, label, a');
    for (const child of children) {
      const text = child.textContent.toLowerCase().trim();
      if (text === 'промо' || text === 'promo') {
        return true;
      }
    }

    return false;
  }

  function removePromoBlocks() {
    if (!enabled) return 0;

    let removed = 0;

    const items = document.querySelectorAll(
      'li.serp-item, ' +
      'li[data-cid], ' +
      'div[data-cid], ' +
      'div.serp-item'
    );

    for (const item of items) {
      if (item.hasAttribute('data-antipromo-removed')) continue;
      if (!item.parentNode) continue;

      if (hasPromoLabel(item)) {
        item.setAttribute('data-antipromo-removed', 'true');
        item.remove();
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🔍 АнтиПромо: удалено ${removed} рекламных блоков`);
      saveStats(removed);

      try {
        chrome.runtime.sendMessage({
          type: 'antipromo_stats_updated',
          blocked: blockedCount,
        });
      } catch (e) {}
    }

    return removed;
  }

  function setupMutationObserver() {
    let timeout = null;

    const observer = new MutationObserver(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        removePromoBlocks();
        timeout = null;
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  function setupMessageListener() {
    try {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'antipromo_toggle') {
          enabled = message.enabled;
          if (enabled) {
            removePromoBlocks();
          }
        }
      });
    } catch (e) {}
  }

  function init() {
    loadState();
    setupMessageListener();

    const run = () => {
      setTimeout(() => {
        const count = removePromoBlocks();
        if (count > 0 || document.querySelector('[data-cid]')) {
          setupMutationObserver();
        } else {
          setTimeout(run, 1000);
        }
      }, 300);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }

    window.addEventListener('load', () => {
      setTimeout(removePromoBlocks, 500);
    });
    setTimeout(removePromoBlocks, 300);
    setTimeout(removePromoBlocks, 500);
  }

  if (
    window.location.hostname.includes('yandex') ||
    window.location.hostname === 'ya.ru'
  ) {
    setTimeout(init, 100);
  }
})();