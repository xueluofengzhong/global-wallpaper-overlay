// Global Wallpaper Overlay - Popup Logic

class WallpaperOverlayPopup {
  constructor() {
    this.currentSettings = {
      enabled: true,
      wallpaperData: null,
      mode: 'overlay',
      opacity: 0.7
    };

    this.elements = {};
    this.cropInstance = null;

    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.loadSettings();
    this.updateUI();
  }

  cacheElements() {
    this.elements = {
      enableToggle: document.getElementById('enableToggle'),
      wallpaperUpload: document.getElementById('wallpaperUpload'),
      uploadArea: document.getElementById('uploadArea'),
      modeOverlay: document.getElementById('modeOverlay'),
      modeBackground: document.getElementById('modeBackground'),
      opacitySlider: document.getElementById('opacitySlider'),
      opacityValue: document.getElementById('opacityValue'),
      sliderFill: document.getElementById('sliderFill'),
      previewGroup: document.getElementById('previewGroup'),
      previewImage: document.getElementById('previewImage'),
      removeWallpaper: document.getElementById('removeWallpaper'),
      openCropEditor: document.getElementById('openCropEditor'),
      applySettings: document.getElementById('applySettings'),
      statusBar: document.getElementById('statusBar'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      cropModal: document.getElementById('cropModal'),
      cropImage: document.getElementById('cropImage'),
      closeCropModal: document.getElementById('closeCropModal'),
      cropCancel: document.getElementById('cropCancel'),
      cropConfirm: document.getElementById('cropConfirm'),
      refreshAllTabs: document.getElementById('refreshAllTabs')
    };
  }

  bindEvents() {
    // Enable/Disable toggle
    this.elements.enableToggle.addEventListener('change', (e) => {
      this.currentSettings.enabled = e.target.checked;
      this.updateStatus();
      this.saveAndApply();
    });

    // Upload area click
    this.elements.uploadArea.addEventListener('click', () => {
      this.elements.wallpaperUpload.click();
    });

    // File input change
    this.elements.wallpaperUpload.addEventListener('change', (e) => {
      this.handleFileUpload(e.target.files[0]);
    });

    // Drag and drop
    this.elements.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.uploadArea.classList.add('drag-over');
    });

    this.elements.uploadArea.addEventListener('dragleave', () => {
      this.elements.uploadArea.classList.remove('drag-over');
    });

    this.elements.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.uploadArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        this.handleFileUpload(file);
      }
    });

    // Mode selection
    this.elements.modeOverlay.addEventListener('click', () => {
      this.setMode('overlay');
    });

    this.elements.modeBackground.addEventListener('click', () => {
      this.setMode('background');
    });

    // Opacity slider - use debounced save for performance
    let opacityTimeout;
    this.elements.opacitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.currentSettings.opacity = value / 100;
      this.elements.opacityValue.textContent = `${value}%`;
      this.elements.sliderFill.style.width = `${value}%`;

      // Debounce the save to avoid too many storage writes
      clearTimeout(opacityTimeout);
      opacityTimeout = setTimeout(() => {
        this.saveAndApply();
      }, 100); // 100ms debounce
    });

    // Remove wallpaper
    this.elements.removeWallpaper.addEventListener('click', () => {
      this.removeWallpaper();
    });

    // Open crop editor
    this.elements.openCropEditor.addEventListener('click', () => {
      if (this.currentSettings.wallpaperData) {
        this.openCropModal();
      } else {
        this.showStatus('请先上传图片', 'warning');
      }
    });

    // Apply settings
    this.elements.applySettings.addEventListener('click', () => {
      this.saveAndApply();
      this.showStatus('设置已应用', 'success');
    });

    // Crop modal controls
    this.elements.closeCropModal.addEventListener('click', () => {
      this.closeCropModal();
    });

    this.elements.cropCancel.addEventListener('click', () => {
      this.closeCropModal();
    });

    this.elements.cropConfirm.addEventListener('click', () => {
      this.applyCrop();
    });

    // Refresh all tabs button
    this.elements.refreshAllTabs.addEventListener('click', () => {
      this.refreshAllTabs();
    });

    // Close modal on backdrop click
    this.elements.cropModal.addEventListener('click', (e) => {
      if (e.target === this.elements.cropModal) {
        this.closeCropModal();
      }
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get({
        enabled: true,
        wallpaperData: null,
        mode: 'overlay',
        opacity: 0.7
      });

      this.currentSettings = result;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  updateUI() {
    // Update toggle
    this.elements.enableToggle.checked = this.currentSettings.enabled;

    // Update mode buttons
    this.setMode(this.currentSettings.mode, false);

    // Update opacity slider
    const opacityPercent = Math.round(this.currentSettings.opacity * 100);
    this.elements.opacitySlider.value = opacityPercent;
    this.elements.opacityValue.textContent = `${opacityPercent}%`;
    this.elements.sliderFill.style.width = `${opacityPercent}%`;

    // Update preview
    if (this.currentSettings.wallpaperData) {
      this.showPreview(this.currentSettings.wallpaperData);
    }

    // Update status
    this.updateStatus();
  }

  updateStatus() {
    const { enabled, wallpaperData } = this.currentSettings;

    if (!enabled) {
      this.elements.statusDot.className = 'status-dot inactive';
      this.elements.statusText.textContent = '遮罩已禁用';
    } else if (!wallpaperData) {
      this.elements.statusDot.className = 'status-dot inactive';
      this.elements.statusText.textContent = '未上传壁纸';
    } else {
      this.elements.statusDot.className = 'status-dot';
      this.elements.statusText.textContent = '遮罩已启用';
    }
  }

  async handleFileUpload(file) {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.showStatus('请选择图片文件', 'error');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showStatus('图片文件过大，请选择小于10MB的图片', 'error');
      return;
    }

    try {
      this.showStatus('正在处理图片...', 'info');

      // Read file as data URL
      const dataUrl = await this.readFileAsDataURL(file);

      // Store wallpaper data
      this.currentSettings.wallpaperData = dataUrl;

      // Show preview
      this.showPreview(dataUrl);

      // Save and apply
      await this.saveAndApply();

      this.showStatus('壁纸上传成功', 'success');
    } catch (error) {
      console.error('Failed to process image:', error);
      this.showStatus('图片处理失败', 'error');
    }
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  showPreview(dataUrl) {
    this.elements.previewImage.src = dataUrl;
    this.elements.previewGroup.style.display = 'block';
    this.elements.uploadArea.style.display = 'none';
  }

  hidePreview() {
    this.elements.previewGroup.style.display = 'none';
    this.elements.uploadArea.style.display = 'block';
  }

  setMode(mode, save = true) {
    this.currentSettings.mode = mode;

    // Update button styles
    this.elements.modeOverlay.classList.toggle('active', mode === 'overlay');
    this.elements.modeBackground.classList.toggle('active', mode === 'background');

    if (save) {
      this.saveAndApply();
    }
  }

  async removeWallpaper() {
    this.currentSettings.wallpaperData = null;
    this.hidePreview();
    this.elements.wallpaperUpload.value = '';
    await this.saveAndApply();
    this.showStatus('壁纸已移除', 'info');
  }

  async refreshAllTabs() {
    try {
      this.showStatus('正在刷新所有标签页...', 'info');

      // Query all tabs and send refresh message
      const tabs = await chrome.tabs.query({});
      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;

      for (const tab of tabs) {
        // Skip chrome:// and chrome-extension:// URLs
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
          skipCount++;
          continue;
        }

        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'refreshWallpaper'
          });
          successCount++;
        } catch (error) {
          // Tab might not have content script loaded yet
          failCount++;
        }
      }

      const message = `已刷新 ${successCount} 个标签页` +
        (skipCount > 0 ? `, 跳过 ${skipCount} 个系统页面` : '') +
        (failCount > 0 ? `, ${failCount} 个未加载` : '');

      this.showStatus(message, 'success');
    } catch (error) {
      console.error('Failed to refresh tabs:', error);
      this.showStatus('刷新失败', 'error');
    }
  }

  async saveAndApply() {
    try {
      // Save to storage FIRST - this is the most important step
      await chrome.storage.local.set(this.currentSettings);
      console.log('Popup: Settings saved to storage, wallpaperData length:', this.currentSettings.wallpaperData ? this.currentSettings.wallpaperData.length : 0);

      // Storage listener in content script should handle this, but let's also try direct messaging

      // Method 1: Send directly to active tab's content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let directMessageSuccess = false;

      if (tab && tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'updateWallpaper',
            settings: this.currentSettings
          });
          console.log('Popup: Direct message to content script succeeded');
          directMessageSuccess = true;
        } catch (err) {
          console.warn('Popup: Direct message failed:', err.message, '- will rely on storage listener');
        }
      }

      // Method 2: Also notify background to broadcast
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'broadcastToAllTabs',
          payload: {
            action: 'updateWallpaper',
            settings: this.currentSettings
          }
        });
        console.log('Popup: Background broadcast result:', response);
      } catch (err) {
        console.warn('Popup: Background broadcast failed:', err.message);
      }

      // Show appropriate status
      if (!directMessageSuccess) {
        this.showStatus('壁纸已保存，正在同步到页面...', 'info');
      }

      this.updateStatus();
    } catch (error) {
      console.error('Popup: Failed to save settings:', error);
      this.showStatus('保存设置失败: ' + error.message, 'error');
    }
  }

  openCropModal() {
    if (!this.currentSettings.wallpaperData) return;

    this.elements.cropImage.src = this.currentSettings.wallpaperData;
    this.elements.cropModal.style.display = 'flex';

    // Initialize cropper after image loads
    this.elements.cropImage.onload = () => {
      this.initCropper();
    };
  }

  closeCropModal() {
    this.elements.cropModal.style.display = 'none';
    if (this.cropInstance) {
      this.cropInstance.destroy();
      this.cropInstance = null;
    }
  }

  initCropper() {
    // Check if Cropper is available
    if (typeof Cropper === 'undefined') {
      console.warn('Cropper.js not loaded, using simple crop');
      this.initSimpleCrop();
      return;
    }

    this.cropInstance = new Cropper(this.elements.cropImage, {
      aspectRatio: NaN, // Free aspect ratio
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  }

  initSimpleCrop() {
    // Simple fallback if Cropper.js is not available
    const img = this.elements.cropImage;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '300px';
  }

  applyCrop() {
    if (this.cropInstance) {
      // Get cropped canvas
      const canvas = this.cropInstance.getCroppedCanvas({
        maxWidth: 4096,
        maxHeight: 4096,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      // Convert to data URL
      const croppedDataUrl = canvas.toDataURL('image/png');

      // Update settings
      this.currentSettings.wallpaperData = croppedDataUrl;

      // Update preview
      this.showPreview(croppedDataUrl);

      // Save and apply
      this.saveAndApply();

      this.showStatus('裁剪成功', 'success');
    }

    this.closeCropModal();
  }

  showStatus(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Style toast
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      color: 'white',
      zIndex: '10000',
      animation: 'fadeInUp 0.3s ease',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
    });

    // Set background color based on type
    const colors = {
      success: '#4ade80',
      error: '#f87171',
      warning: '#fbbf24',
      info: '#60a5fa'
    };
    toast.style.background = colors[type] || colors.info;

    // Add to DOM
    document.body.appendChild(toast);

    // Remove after delay
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new WallpaperOverlayPopup();
});

// Add CSS for toast animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);