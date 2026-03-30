// Global Wallpaper Overlay - Background Service Worker

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      enabled: true,
      wallpaperData: null,
      mode: 'overlay',
      opacity: 0.7
    });
  }
});

// Listen for storage changes and broadcast to all tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Get current full settings
    chrome.storage.local.get({
      enabled: true,
      wallpaperData: null,
      mode: 'overlay',
      opacity: 0.7
    }, (settings) => {
      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            action: settings.enabled ? 'updateWallpaper' : 'removeWallpaper',
            settings: settings
          }).catch(() => {
            // Ignore errors for tabs without content script
          });
        }
      });
    });
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getSettings':
      chrome.storage.local.get({
        enabled: true,
        wallpaperData: null,
        mode: 'overlay',
        opacity: 0.7
      }, (settings) => {
        sendResponse(settings);
      });
      return true; // Keep channel open for async response

    case 'saveSettings':
      chrome.storage.local.set(message.settings, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'broadcastToAllTabs':
      chrome.tabs.query({}, (tabs) => {
        let successCount = 0;
        let failCount = 0;

        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, message.payload)
            .then(() => successCount++)
            .catch(() => failCount++);
        }

        sendResponse({
          success: true,
          successCount,
          failCount,
          totalTabs: tabs.length
        });
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Optional: Handle browser action click (if no popup)
// chrome.action.onClicked.addListener((tab) => {
//   // Toggle overlay on current tab
//   chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlay' });
// });