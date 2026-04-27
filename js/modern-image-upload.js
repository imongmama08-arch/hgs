// ============================================================
// modern-image-upload.js — Modern drag & drop image upload
// ============================================================

class ModernImageUpload {
  constructor() {
    this.images = [];
    this.maxImages = 5;
    this.maxSize = 5 * 1024 * 1024; // 5MB
    this.init();
  }

  init() {
    const dropzone = document.getElementById('imageDropzone');
    const input = document.getElementById('imageInput');
    const previewGrid = document.getElementById('imagePreviewGrid');

    if (!dropzone || !input || !previewGrid) return;

    // Click to upload
    dropzone.addEventListener('click', () => input.click());

    // File input change
    input.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });

    // Character counter for description
    const descTextarea = document.getElementById('newDescription');
    const charCount = document.getElementById('descCharCount');
    if (descTextarea && charCount) {
      descTextarea.addEventListener('input', () => {
        const count = descTextarea.value.length;
        charCount.textContent = count;
        if (count > 500) {
          charCount.style.color = '#ef4444';
        } else {
          charCount.style.color = '';
        }
      });
    }
  }

  handleFiles(files) {
    const fileArray = Array.from(files);
    
    // Check if adding these files would exceed max
    if (this.images.length + fileArray.length > this.maxImages) {
      this.showError(`You can only upload up to ${this.maxImages} images`);
      return;
    }

    fileArray.forEach(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.showError(`${file.name} is not an image file`);
        return;
      }

      // Validate file size
      if (file.size > this.maxSize) {
        this.showError(`${file.name} is too large. Max size is 5MB`);
        return;
      }

      // Read and preview image
      const reader = new FileReader();
      reader.onload = (e) => {
        this.addImage({
          file: file,
          url: e.target.result,
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    });
  }

  addImage(imageData) {
    this.images.push(imageData);
    this.renderPreviews();
  }

  removeImage(index) {
    this.images.splice(index, 1);
    this.renderPreviews();
  }

  renderPreviews() {
    const previewGrid = document.getElementById('imagePreviewGrid');
    if (!previewGrid) return;

    previewGrid.innerHTML = '';

    this.images.forEach((image, index) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item';
      if (index === 0) item.classList.add('cover');

      item.innerHTML = `
        <img src="${image.url}" alt="${image.name}">
        ${index === 0 ? '<div class="image-preview-badge">Cover</div>' : ''}
        <button type="button" class="image-preview-remove" data-index="${index}">×</button>
      `;

      // Add remove handler
      const removeBtn = item.querySelector('.image-preview-remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeImage(index);
      });

      previewGrid.appendChild(item);
    });
  }

  showError(message) {
    // You can integrate with your existing error notification system
    alert(message);
  }

  async uploadImages() {
    // This method will upload images to your storage
    // For now, we'll return the data URLs
    // In production, you'd upload to Cloudinary, Supabase Storage, etc.
    
    if (this.images.length === 0) {
      throw new Error('Please upload at least one image');
    }

    // Return array of image URLs
    // In production, replace this with actual upload logic
    return this.images.map(img => img.url);
  }

  getImages() {
    return this.images;
  }

  // Validate that image URL is web-accessible (not a local file path)
  static isValidWebUrl(url) {
    if (!url) return false;
    
    // Check if it's a data URL (base64)
    if (url.startsWith('data:image/')) return true;
    
    // Check if it's a web URL (http/https)
    if (url.startsWith('http://') || url.startsWith('https://')) return true;
    
    // Check if it's a relative path (starts with / or ./)
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return true;
    
    // Reject local file paths
    if (url.startsWith('file://') || url.includes(':\\') || url.includes('C:/') || url.includes('Users/')) {
      console.warn('[ImageUpload] Invalid local file path detected:', url);
      return false;
    }
    
    return true;
  }

  reset() {
    this.images = [];
    this.renderPreviews();
    const input = document.getElementById('imageInput');
    if (input) input.value = '';
  }
}

// Initialize on page load
let imageUploader;
document.addEventListener('DOMContentLoaded', () => {
  imageUploader = new ModernImageUpload();
  window.imageUploader = imageUploader; // ensure global is set after DOM ready
});

// Export class for use in other scripts
window.ModernImageUpload = ModernImageUpload;
