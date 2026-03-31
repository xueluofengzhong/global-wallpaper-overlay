// Global Wallpaper Overlay - Background Service Worker

console.log('Background: Service Worker started');

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Background: Extension installed or updated:', details.reason);
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      enabled: true,
      wallpaperData: null,
      mode: 'overlay',
      opacity: 0.7
    });
    console.log('Background: Default settings initialized');
  }
});

// Listen for storage changes and broadcast to all tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Only respond to relevant changes
    if (changes.enabled || changes.wallpaperData || changes.mode || changes.opacity) {
      console.log('Background: Storage changed:', Object.keys(changes));

      // Get current full settings
      chrome.storage.local.get({
        enabled: true,
        wallpaperData: null,
        mode: 'overlay',
        opacity: 0.7
      }, (settings) => {
        console.log('Background: Broadcasting to all tabs, settings:', {
          enabled: settings.enabled,
          hasWallpaperData: !!settings.wallpaperData,
          wallpaperDataLength: settings.wallpaperData ? settings.wallpaperData.length : 0,
          mode: settings.mode
        });

        // Broadcast to all tabs
        chrome.tabs.query({}, (tabs) => {
          console.log(`Background: Found ${tabs.length} tabs to notify`);
          let successCount = 0;
          let failCount = 0;

          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              action: settings.enabled && settings.wallpaperData ? 'updateWallpaper' : 'removeWallpaper',
              settings: settings
            }).then(() => {
              successCount++;
              console.log(`Background: Successfully sent to tab ${tab.id}`);
            }).catch((err) => {
              failCount++;
              console.warn(`Background: Failed to send to tab ${tab.id}:`, err.message);
            });
          }

          console.log(`Background: Broadcast complete. Success: ${successCount}, Failed: ${failCount}`);
        });
      });
    }
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background: Message received:', message.action, 'from:', sender.tab ? 'tab ' + sender.tab.id : sender.url || 'unknown');

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
        console.log('Background: Settings saved via saveSettings action');
        sendResponse({ success: true });
      });
      return true;

    case 'broadcastToAllTabs':
      chrome.tabs.query({}, (tabs) => {
        console.log(`Background: broadcastToAllTabs - found ${tabs.length} tabs`);
        let successCount = 0;
        let failCount = 0;

        const proms = tabs.map(tab => {
          return chrome.tabs.sendMessage(tab.id, message.payload)
            .then(() => {
              successCount++;
              console.log(`Background: Sent to tab ${tab.id}`);
            })
            .catch((err) => {
              failCount++;
              console.warn(`Background: Failed tab ${tab.id}:`, err.message);
            });
        });

        Promise.all(proms).then(() => {
          console.log(`Background: All messages sent. Success: ${successCount}, Failed: ${failCount}`);
          sendResponse({
            success: true,
            successCount,
            failCount,
            totalTabs: tabs.length
          });
        });
      });
      return true;

    default:
      console.warn('Background: Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Keep service worker alive briefly to handle initialization
chrome.runtime.onStartup.addListener(() => {
  console.log('Background: Browser started, initializing...');
});