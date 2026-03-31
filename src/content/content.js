// Global Wallpaper Overlay - Content Script (Enhanced)
// Injects wallpaper overlay into all web pages including iframes and Shadow DOMs

(function() {
  'use strict';

  const OVERLAY_ID = 'global-wallpaper-overlay-extension';
  const STYLE_ID = 'global-wallpaper-overlay-styles';

  // Store wallpaper data globally for iframe access
  let wallpaperSettings = null;

  // Main initialization function
  async function init() {
    try {
      console.log('Global Wallpaper Overlay: Initializing...');

      const settings = await chrome.storage.local.get({
        enabled: true,
        wallpaperData: null,
        mode: 'overlay',
        opacity: 0.7
      });

      console.log('Global Wallpaper Overlay: Loaded settings:', settings);
      wallpaperSettings = settings;

      if (settings.enabled && settings.wallpaperData) {
        console.log('Global Wallpaper Overlay: Applying wallpaper on init');
        applyWallpaper(settings);
      } else {
        console.log('Global Wallpaper Overlay: No wallpaper to apply on init (enabled:', settings.enabled, 'wallpaperData:', !!settings.wallpaperData, ')');
      }

      // Set up storage listener for real-time updates
      chrome.storage.onChanged.addListener((changes, namespace) => {
        console.log('Global Wallpaper Overlay: Storage changed:', Object.keys(changes), 'namespace:', namespace);
        if (namespace === 'local') {
          // Check if only opacity changed (performance optimization)
          const changedKeys = Object.keys(changes);
          const onlyOpacityChanged = changedKeys.length === 1 && changedKeys[0] === 'opacity';

          if (onlyOpacityChanged && wallpaperSettings && wallpaperSettings.enabled && wallpaperSettings.wallpaperData) {
            // Fast path: only update opacity without rebuilding
            const newOpacity = changes.opacity.newValue;
            console.log('Global Wallpaper Overlay: Fast opacity update to', newOpacity);
            wallpaperSettings.opacity = newOpacity;
            const overlay = document.getElementById(OVERLAY_ID);
            if (overlay) {
              overlay.style.setProperty('opacity', String(newOpacity), 'important');
            }
            return;
          }

          // Full update for other changes
          if (changes.enabled || changes.wallpaperData || changes.mode || changes.opacity) {
            chrome.storage.local.get({
              enabled: true,
              wallpaperData: null,
              mode: 'overlay',
              opacity: 0.7
            }, (newSettings) => {
              console.log('Global Wallpaper Overlay: Got fresh settings from storage:', {
                enabled: newSettings.enabled,
                hasWallpaperData: !!newSettings.wallpaperData,
                mode: newSettings.mode,
                opacity: newSettings.opacity
              });
              wallpaperSettings = newSettings;
              if (newSettings.enabled && newSettings.wallpaperData) {
                console.log('Global Wallpaper Overlay: Applying wallpaper from storage change');
                applyWallpaper(newSettings);
              } else {
                console.log('Global Wallpaper Overlay: Removing overlay from storage change');
                removeOverlay();
              }
            });
          }
        }
      });

      console.log('Global Wallpaper Overlay: Init complete, listening for changes');
    } catch (error) {
      console.error('Global Wallpaper Overlay: Failed to initialize', error);
    }
  }

  // Apply wallpaper based on settings
  function applyWallpaper(settings) {
    const { wallpaperData, mode, opacity } = settings;

    console.log('Global Wallpaper Overlay: applyWallpaper called with:', { mode, opacity, hasWallpaperData: !!wallpaperData });

    if (!wallpaperData) {
      console.log('Global Wallpaper Overlay: No wallpaper data, removing overlay');
      removeOverlay();
      return;
    }

    // Remove existing overlay first
    removeOverlay();

    // Create overlay element
    const overlayElement = document.createElement('div');
    overlayElement.id = OVERLAY_ID;

    // Escape wallpaper data for safe use in CSS
    const escapedWallpaperData = wallpaperData.replace(/['"\\]/g, '\\$&');

    // Set comprehensive styles for maximum compatibility
    // Use individual properties instead of shorthand to avoid override issues
    // Set styles directly without !important in property names - use setProperty instead
    overlayElement.style.setProperty('position', 'fixed', 'important');
    overlayElement.style.setProperty('top', '0', 'important');
    overlayElement.style.setProperty('left', '0', 'important');
    overlayElement.style.setProperty('width', '100vw', 'important');
    overlayElement.style.setProperty('height', '100vh', 'important');
    overlayElement.style.setProperty('margin', '0', 'important');
    overlayElement.style.setProperty('padding', '0', 'important');
    overlayElement.style.setProperty('border', 'none', 'important');
    overlayElement.style.setProperty('display', 'block', 'important');
    overlayElement.style.setProperty('background-image', `url('${escapedWallpaperData}')`, 'important');
    overlayElement.style.setProperty('background-position', 'center center', 'important');
    overlayElement.style.setProperty('background-size', 'cover', 'important');
    overlayElement.style.setProperty('background-repeat', 'no-repeat', 'important');
    overlayElement.style.setProperty('background-attachment', 'fixed', 'important');
    overlayElement.style.setProperty('opacity', mode === 'overlay' ? String(opacity) : '1', 'important');
    overlayElement.style.setProperty('pointer-events', 'none', 'important');
    overlayElement.style.setProperty('box-sizing', 'border-box', 'important');
    overlayElement.style.setProperty('z-index', mode === 'overlay' ? '2147483647' : '-1', 'important');
    overlayElement.style.setProperty('max-width', 'none', 'important');
    overlayElement.style.setProperty('max-height', 'none', 'important');
    overlayElement.style.setProperty('min-width', '100vw', 'important');
    overlayElement.style.setProperty('min-height', '100vh', 'important');

    // Set mode-specific class
    overlayElement.className = mode === 'overlay' ? 'mode-overlay' : 'mode-background';

    // Insert as very first child of body/html
    let inserted = false;
    if (document.body) {
      console.log('Global Wallpaper Overlay: document.body exists, inserting overlay');
      // Insert at the very beginning of body
      if (document.body.firstChild) {
        document.body.insertBefore(overlayElement, document.body.firstChild);
        inserted = true;
        console.log('Global Wallpaper Overlay: Inserted before body.firstChild');
      } else {
        document.body.appendChild(overlayElement);
        inserted = true;
        console.log('Global Wallpaper Overlay: Appended to body (empty)');
      }
    } else if (document.documentElement) {
      document.documentElement.insertBefore(overlayElement, document.documentElement.firstChild);
      inserted = true;
      console.log('Global Wallpaper Overlay: Inserted into documentElement');
    }

    if (!inserted) {
      console.error('Global Wallpaper Overlay: FAILED TO INSERT OVERLAY - no body or documentElement!');
    }

    // Also inject high-priority CSS rules
    injectHighPriorityStyles(settings);

    // Handle Shadow DOMs
    observeShadowDOMs();

    // Verify the overlay was actually inserted
    const insertedOverlay = document.getElementById(OVERLAY_ID);
    console.log('Global Wallpaper Overlay: Verification - overlay exists in DOM:', !!insertedOverlay);

    if (insertedOverlay) {
      console.log('Global Wallpaper Overlay: Wallpaper applied successfully!');
      // Set up protection observer to prevent website CSS from overriding
      protectOverlayStyles(insertedOverlay, settings);
    }
  }

  // Global observers to avoid duplicates
  let styleProtectionObserver = null;
  let domProtectionObserver = null;

  // Protect overlay styles from being overridden by website CSS
  function protectOverlayStyles(overlay, settings) {
    const { wallpaperData, mode, opacity } = settings;

    // Disconnect existing observers to avoid duplicates
    if (styleProtectionObserver) {
      styleProtectionObserver.disconnect();
    }
    if (domProtectionObserver) {
      domProtectionObserver.disconnect();
    }

    // Store the correct opacity for quick updates
    const correctOpacity = mode === 'overlay' ? String(opacity) : '1';

    // Observer to detect and fix style changes (throttled)
    let styleFixTimeout = null;
    styleProtectionObserver = new MutationObserver((mutations) => {
      if (styleFixTimeout) return; // Throttle to avoid excessive updates

      styleFixTimeout = setTimeout(() => {
        styleFixTimeout = null;

        // Check if overlay still exists and needs fixing
        const currentOverlay = document.getElementById(OVERLAY_ID);
        if (!currentOverlay) return;

        const computed = window.getComputedStyle(currentOverlay);
        if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
          console.log('Global Wallpaper Overlay: Detected style override, restoring...');
          // Only restore critical styles
          currentOverlay.style.setProperty('display', 'block', 'important');
          currentOverlay.style.setProperty('visibility', 'visible', 'important');
          currentOverlay.style.setProperty('opacity', correctOpacity, 'important');
        }
      }, 100); // 100ms throttle
    });

    styleProtectionObserver.observe(overlay, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Also protect against being removed from DOM (throttled)
    let domFixTimeout = null;
    domProtectionObserver = new MutationObserver((mutations) => {
      if (domFixTimeout) return;

      domFixTimeout = setTimeout(() => {
        domFixTimeout = null;

        // Check if overlay was removed
        if (!document.getElementById(OVERLAY_ID)) {
          console.log('Global Wallpaper Overlay: Overlay was removed, re-inserting...');
          // Re-apply wallpaper completely
          if (wallpaperSettings && wallpaperSettings.enabled && wallpaperSettings.wallpaperData) {
            applyWallpaper(wallpaperSettings);
          }
        }
      }, 100);
    });

    if (document.body) {
      domProtectionObserver.observe(document.body, { childList: true, subtree: false });
    }
  }

  // Inject high-priority CSS for maximum compatibility
  function injectHighPriorityStyles(settings) {
    const { wallpaperData, mode, opacity } = settings;

    // Remove existing style element
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) {
      existingStyle.parentNode.removeChild(existingStyle);
    }

    // Escape wallpaper data for safe use in CSS
    // Data URLs can contain quotes, so we need to escape them
    const escapedWallpaperData = wallpaperData.replace(/['"\\]/g, '\\$&');

    // Determine opacity - only apply opacity in overlay mode
    const effectiveOpacity = mode === 'overlay' ? opacity : '1';

    // Create style element with maximum priority rules
    const styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    styleElement.textContent = `
      /* Global Wallpaper Overlay - High Priority Styles */

      /* Reset and base styles for overlay */
      html > body#${OVERLAY_ID},
      html > #${OVERLAY_ID},
      body#${OVERLAY_ID} {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        display: block !important;
        /* Use individual properties for maximum compatibility */
        background-image: url('${escapedWallpaperData}') !important;
        background-position: center center !important;
        background-size: cover !important;
        background-repeat: no-repeat !important;
        background-attachment: fixed !important;
        opacity: ${effectiveOpacity} !important;
        pointer-events: none !important;
        z-index: ${mode === 'overlay' ? '2147483647' : '-1'} !important;
      }

      /* Ensure overlay is always on top in overlay mode */
      html body .${OVERLAY_ID},
      #${OVERLAY_ID} {
        z-index: 2147483647 !important;
      }

      /* Override for background mode - push behind everything */
      html body.mode-background#${OVERLAY_ID},
      html.mode-background > #${OVERLAY_ID} {
        z-index: -1 !important;
        opacity: 1 !important;
      }

      /* Prevent pointer events on overlay */
      *#${OVERLAY_ID} * {
        pointer-events: none !important;
      }

      /* Ensure body doesn't have negative margin affecting overlay */
      body {
        position: relative !important;
        min-height: 100vh !important;
      }

      /* Some sites use transforms that break fixed positioning */
      body > *:not(#${OVERLAY_ID}) {
        position: relative;
      }
    `;

    // Insert at the end of head for highest priority
    if (document.head) {
      document.head.appendChild(styleElement);
    } else if (document.documentElement) {
      document.documentElement.appendChild(styleElement);
    }
  }

  // Observe and handle Shadow DOMs
  function observeShadowDOMs() {
    // Find all elements that might have Shadow DOMs
    const walkShadowDom = (node) => {
      if (node.shadowRoot) {
        // Apply wallpaper styles to shadow root
        applyToShadowRoot(node.shadowRoot);
      }

      // Recursively check children
      if (node.children) {
        for (const child of node.children) {
          walkShadowDom(child);
        }
      }
    };

    // Also observe new elements being added
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            walkShadowDom(node);
          }
        }
      }
    });

    // Start observing
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Initial scan
    walkShadowDom(document.body || document.documentElement);
  }

  // Apply wallpaper to a shadow root
  function applyToShadowRoot(shadowRoot) {
    if (!wallpaperSettings || !wallpaperSettings.enabled || !wallpaperSettings.wallpaperData) {
      return;
    }

    // Check if overlay already exists in shadow root
    if (shadowRoot.getElementById(OVERLAY_ID)) {
      return;
    }

    const overlayElement = document.createElement('div');
    overlayElement.id = OVERLAY_ID;
    overlayElement.className = wallpaperSettings.mode === 'overlay' ? 'mode-overlay' : 'mode-background';

    // Escape wallpaper data for safe use in CSS
    const escapedWallpaperData = wallpaperSettings.wallpaperData.replace(/['"\\]/g, '\\$&');

    // Use setProperty for proper !important flag support
    overlayElement.style.setProperty('position', 'fixed', 'important');
    overlayElement.style.setProperty('top', '0', 'important');
    overlayElement.style.setProperty('left', '0', 'important');
    overlayElement.style.setProperty('width', '100vw', 'important');
    overlayElement.style.setProperty('height', '100vh', 'important');
    overlayElement.style.setProperty('margin', '0', 'important');
    overlayElement.style.setProperty('padding', '0', 'important');
    overlayElement.style.setProperty('border', 'none', 'important');
    overlayElement.style.setProperty('display', 'block', 'important');
    overlayElement.style.setProperty('background-image', `url('${escapedWallpaperData}')`, 'important');
    overlayElement.style.setProperty('background-position', 'center center', 'important');
    overlayElement.style.setProperty('background-size', 'cover', 'important');
    overlayElement.style.setProperty('background-repeat', 'no-repeat', 'important');
    overlayElement.style.setProperty('background-attachment', 'fixed', 'important');
    overlayElement.style.setProperty('opacity', String(wallpaperSettings.opacity), 'important');
    overlayElement.style.setProperty('pointer-events', 'none', 'important');
    overlayElement.style.setProperty('z-index', wallpaperSettings.mode === 'overlay' ? '2147483647' : '-1', 'important');

    // Insert at beginning of shadow root
    shadowRoot.insertBefore(overlayElement, shadowRoot.firstChild);
  }

  // Remove overlay completely
  function removeOverlay() {
    // Remove from main document
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    // Remove style element
    const styleElement = document.getElementById(STYLE_ID);
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }

    // Remove from all Shadow DOMs
    const walkAndRemove = (node) => {
      if (node.shadowRoot) {
        const shadowOverlay = node.shadowRoot.getElementById(OVERLAY_ID);
        if (shadowOverlay && shadowOverlay.parentNode) {
          shadowOverlay.parentNode.removeChild(shadowOverlay);
        }
      }
      if (node.children) {
        for (const child of node.children) {
          walkAndRemove(child);
        }
      }
    };

    walkAndRemove(document.body || document.documentElement);
  }

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Global Wallpaper Overlay: Message received:', message.action, message.settings ? '(with settings)' : '(no settings)');

    switch (message.action) {
      case 'updateWallpaper':
        wallpaperSettings = message.settings;
        if (message.settings.enabled && message.settings.wallpaperData) {
          console.log('Global Wallpaper Overlay: Applying wallpaper from message');
          applyWallpaper(message.settings);
        } else {
          console.log('Global Wallpaper Overlay: Removing overlay from message');
          removeOverlay();
        }
        sendResponse({ success: true });
        break;

      case 'removeWallpaper':
        removeOverlay();
        sendResponse({ success: true });
        break;

      case 'updateOpacity':
        wallpaperSettings = { ...wallpaperSettings, opacity: message.opacity };
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
          overlay.style.setProperty('opacity', String(message.opacity), 'important');
        }
        sendResponse({ success: true });
        break;

      case 'updateMode':
        wallpaperSettings = { ...wallpaperSettings, mode: message.mode };
        const modeOverlay = document.getElementById(OVERLAY_ID);
        if (modeOverlay) {
          modeOverlay.style.setProperty('z-index', message.mode === 'overlay' ? '2147483647' : '-1', 'important');
          modeOverlay.className = message.mode === 'overlay' ? 'mode-overlay' : 'mode-background';
        }
        sendResponse({ success: true });
        break;

      case 'getState':
        sendResponse({
          hasOverlay: !!document.getElementById(OVERLAY_ID),
          overlayId: OVERLAY_ID
        });
        break;

      case 'refreshWallpaper':
        // Force refresh wallpaper from storage
        chrome.storage.local.get({
          enabled: true,
          wallpaperData: null,
          mode: 'overlay',
          opacity: 0.7
        }, (settings) => {
          wallpaperSettings = settings;
          if (settings.enabled && settings.wallpaperData) {
            applyWallpaper(settings);
          } else {
            removeOverlay();
          }
        });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true;
  });

  // Handle page load events
  function onPageLoad() {
    // Small delay to ensure DOM is fully ready
    setTimeout(() => {
      if (wallpaperSettings && wallpaperSettings.enabled && wallpaperSettings.wallpaperData) {
        applyWallpaper(wallpaperSettings);
      }
    }, 100);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageLoad);
  } else {
    onPageLoad();
  }

  // Also initialize main logic
  init();

  // Reinitialize on page navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Reapply wallpaper after navigation
      setTimeout(() => {
        if (wallpaperSettings && wallpaperSettings.enabled && wallpaperSettings.wallpaperData) {
          applyWallpaper(wallpaperSettings);
        }
      }, 500);
    }
  }).observe(document, { subtree: true, childList: true });

  // Handle full page navigation (for multi-frame sites)
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (wallpaperSettings && wallpaperSettings.enabled && wallpaperSettings.wallpaperData) {
        applyWallpaper(wallpaperSettings);
      }
    }, 200);
  });

})();
