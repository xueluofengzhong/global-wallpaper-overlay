// Global Wallpaper Overlay - Content Script
// Injects wallpaper overlay into all web pages

(function() {
  'use strict';

  const OVERLAY_ID = 'global-wallpaper-overlay-extension';
  const STYLE_ID = 'global-wallpaper-overlay-style';

  let overlayElement = null;
  let styleElement = null;

  // Main initialization function
  async function init() {
    try {
      const settings = await chrome.storage.local.get({
        enabled: true,
        wallpaperData: null,
        mode: 'overlay',
        opacity: 0.7
      });

      if (settings.enabled && settings.wallpaperData) {
        applyWallpaper(settings);
      }
    } catch (error) {
      console.error('Global Wallpaper Overlay: Failed to initialize', error);
    }
  }

  // Apply wallpaper based on settings
  function applyWallpaper(settings) {
    const { wallpaperData, mode, opacity } = settings;

    if (!wallpaperData) {
      removeOverlay();
      return;
    }

    // Remove existing overlay
    removeOverlay();

    // Create overlay element
    overlayElement = document.createElement('div');
    overlayElement.id = OVERLAY_ID;

    // Set styles based on mode
    if (mode === 'overlay') {
      // Overlay mode: floating above page content
      Object.assign(overlayElement.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundImage: `url("${wallpaperData}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: opacity.toString(),
        pointerEvents: 'none',
        zIndex: '2147483647', // Maximum z-index
        display: 'block'
      });
    } else if (mode === 'background') {
      // Background mode: set as page background
      Object.assign(overlayElement.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundImage: `url("${wallpaperData}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: opacity.toString(),
        pointerEvents: 'none',
        zIndex: '-1', // Behind page content
        display: 'block'
      });
    }

    // Insert as first child of body
    if (document.body) {
      document.body.insertBefore(overlayElement, document.body.firstChild);
    } else {
      // Wait for body to be available
      const observer = new MutationObserver((mutations, obs) => {
        if (document.body) {
          document.body.insertBefore(overlayElement, document.body.firstChild);
          obs.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }
  }

  // Update overlay without recreating
  function updateOverlay(settings) {
    const { wallpaperData, mode, opacity } = settings;

    if (!overlayElement) {
      applyWallpaper(settings);
      return;
    }

    // Update background image
    overlayElement.style.backgroundImage = wallpaperData ? `url("${wallpaperData}")` : 'none';

    // Update opacity
    overlayElement.style.opacity = opacity.toString();

    // Update z-index based on mode
    overlayElement.style.zIndex = mode === 'overlay' ? '2147483647' : '-1';
  }

  // Remove overlay completely
  function removeOverlay() {
    if (overlayElement && overlayElement.parentNode) {
      overlayElement.parentNode.removeChild(overlayElement);
      overlayElement = null;
    }

    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
      styleElement = null;
    }
  }

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'updateWallpaper':
        applyWallpaper(message.settings);
        sendResponse({ success: true });
        break;

      case 'removeWallpaper':
        removeOverlay();
        sendResponse({ success: true });
        break;

      case 'updateOpacity':
        if (overlayElement) {
          overlayElement.style.opacity = message.opacity.toString();
        }
        sendResponse({ success: true });
        break;

      case 'updateMode':
        if (overlayElement) {
          overlayElement.style.zIndex = message.mode === 'overlay' ? '2147483647' : '-1';
        }
        sendResponse({ success: true });
        break;

      case 'getState':
        sendResponse({
          hasOverlay: !!overlayElement,
          overlayId: OVERLAY_ID
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep message channel open for async responses
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also reinitialize on page navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Small delay to allow page to settle
      setTimeout(init, 500);
    }
  }).observe(document, { subtree: true, childList: true });

})();