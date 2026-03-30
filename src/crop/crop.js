// Global Wallpaper Overlay - Crop Editor Logic

class CropEditor {
  constructor() {
    this.cropper = null;
    this.imageElement = document.getElementById('cropImage');
    this.previewBox = document.getElementById('previewBox');
    this.originalImage = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadImage();
    this.initCropper();
  }

  bindEvents() {
    // Aspect ratio buttons
    document.querySelectorAll('.aspect-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setAspectRatio(e.target.dataset.ratio);
        document.querySelectorAll('.aspect-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Rotation buttons
    document.getElementById('rotateLeft').addEventListener('click', () => {
      this.rotate(-90);
    });

    document.getElementById('rotateRight').addEventListener('click', () => {
      this.rotate(90);
    });

    // Zoom buttons
    document.getElementById('zoomIn').addEventListener('click', () => {
      this.zoom(0.1);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
      this.zoom(-0.1);
    });

    document.getElementById('zoomReset').addEventListener('click', () => {
      this.resetZoom();
    });

    // Footer buttons
    document.getElementById('cancelCrop').addEventListener('click', () => {
      this.cancel();
    });

    document.getElementById('confirmCrop').addEventListener('click', () => {
      this.confirmCrop();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancel();
      } else if (e.key === 'Enter') {
        this.confirmCrop();
      }
    });
  }

  async loadImage() {
    try {
      // Get image data from URL parameters or storage
      const urlParams = new URLSearchParams(window.location.search);
      const imageData = urlParams.get('image');

      if (imageData) {
        this.originalImage = decodeURIComponent(imageData);
        this.imageElement.src = this.originalImage;
      } else {
        // Try to load from storage
        const result = await chrome.storage.local.get('wallpaperData');
        if (result.wallpaperData) {
          this.originalImage = result.wallpaperData;
          this.imageElement.src = this.originalImage;
        } else {
          this.showError('未找到图片，请先上传图片');
        }
      }
    } catch (error) {
      console.error('Failed to load image:', error);
      this.showError('加载图片失败');
    }
  }

  initCropper() {
    if (!this.imageElement.src) return;

    this.imageElement.onload = () => {
      this.cropper = new Cropper(this.imageElement, {
        aspectRatio: NaN, // Free aspect ratio by default
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
        preview: this.previewBox,
        ready: () => {
          this.updatePreview();
        },
        crop: (event) => {
          this.updatePreview();
        }
      });
    };
  }

  setAspectRatio(ratio) {
    if (!this.cropper) return;

    let aspectRatio;
    switch (ratio) {
      case 'free':
        aspectRatio = NaN;
        break;
      case '16:9':
        aspectRatio = 16 / 9;
        break;
      case '4:3':
        aspectRatio = 4 / 3;
        break;
      case '1:1':
        aspectRatio = 1;
        break;
      case 'original':
        const img = this.cropper.getImageData();
        aspectRatio = img.naturalWidth / img.naturalHeight;
        break;
      default:
        aspectRatio = NaN;
    }

    this.cropper.setAspectRatio(aspectRatio);
  }

  rotate(degrees) {
    if (!this.cropper) return;
    this.cropper.rotate(degrees);
  }

  zoom(ratio) {
    if (!this.cropper) return;
    this.cropper.zoom(ratio);
  }

  resetZoom() {
    if (!this.cropper) return;
    this.cropper.reset();
  }

  updatePreview() {
    if (!this.cropper) return;

    // Get cropped canvas for preview
    const canvas = this.cropper.getCroppedCanvas({
      maxWidth: 400,
      maxHeight: 300,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });

    if (canvas) {
      this.previewBox.innerHTML = '';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'cover';
      this.previewBox.appendChild(canvas);
    }
  }

  confirmCrop() {
    if (!this.cropper) {
      this.showError('裁剪器未初始化');
      return;
    }

    try {
      // Get cropped canvas with high quality
      const canvas = this.cropper.getCroppedCanvas({
        maxWidth: 4096,
        maxHeight: 4096,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      if (!canvas) {
        this.showError('获取裁剪图片失败');
        return;
      }

      // Convert to data URL
      const croppedDataUrl = canvas.toDataURL('image/png');

      // Save to storage
      chrome.storage.local.set({ wallpaperData: croppedDataUrl }, () => {
        // Notify popup about the change
        chrome.runtime.sendMessage({
          action: 'wallpaperUpdated',
          wallpaperData: croppedDataUrl
        }).catch(() => {
          // Popup might not be open
        });

        // Close the crop editor
        window.close();
      });

    } catch (error) {
      console.error('Crop failed:', error);
      this.showError('裁剪失败: ' + error.message);
    }
  }

  cancel() {
    // Close without saving
    window.close();
  }

  showError(message) {
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;

    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#f87171',
      color: 'white',
      padding: '16px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      animation: 'slideIn 0.3s ease'
    });

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize crop editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CropEditor();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;
document.head.appendChild(style);