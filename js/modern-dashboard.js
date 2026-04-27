// ============================================================
// modern-dashboard.js — Modern dashboard interactions
// ============================================================

// Tab Switching — wrapped in DOMContentLoaded so elements exist
document.addEventListener('DOMContentLoaded', () => {
  console.log('[modern-dashboard] Initializing tab switching...');
  
  const navItems = document.querySelectorAll('.nav-item, [data-tab]');
  console.log('[modern-dashboard] Found', navItems.length, 'nav items');
  
  navItems.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      
      console.log('[modern-dashboard] Tab clicked:', tab);
      
      if (!tab) {
        console.warn('[modern-dashboard] No tab data attribute found');
        return;
      }

      // Update nav
      document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
      document.querySelectorAll(`[data-tab="${tab}"]`).forEach(l => l.classList.add('active'));

      // Update content
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      const tabEl = document.getElementById(`tab-${tab}`);
      
      console.log('[modern-dashboard] Tab element:', tabEl ? 'Found' : 'NOT FOUND');
      
      if (tabEl) {
        tabEl.classList.add('active');
        console.log('[modern-dashboard] Tab activated:', `tab-${tab}`);
      } else {
        console.error('[modern-dashboard] Tab element not found:', `tab-${tab}`);
      }

      // Update header
      const titles = {
        overview: { title: 'Overview', subtitle: 'Welcome back! Here\'s your store overview' },
        listings: { title: 'My Listings', subtitle: 'Manage your product listings' },
        orders: { title: 'Orders', subtitle: 'Track and manage your orders' },
        add: { title: 'Add New Listing', subtitle: 'Create a new product listing' },
        earnings: { title: 'Earnings', subtitle: 'View your earnings and payouts' },
        fees: { title: 'Listing Fees', subtitle: 'Manage your listing fee payments' },
        messages: { title: 'Messages', subtitle: 'Respond to buyer inquiries' },
        profile: { title: 'Profile & Payment', subtitle: 'Manage your business information' }
      };

      const titleData = titles[tab] || { title: 'Dashboard', subtitle: '' };
      const pageTitle = document.getElementById('pageTitle');
      const pageSubtitle = document.getElementById('pageSubtitle');
      if (pageTitle) pageTitle.textContent = titleData.title;
      if (pageSubtitle) pageSubtitle.textContent = titleData.subtitle;

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Load tab data
      if (tab === 'listings') typeof loadSellerListings === 'function' && loadSellerListings();
      if (tab === 'orders')   typeof loadSellerOrders   === 'function' && loadSellerOrders();
      if (tab === 'earnings') typeof loadEarningsTab    === 'function' && loadEarningsTab();
      if (tab === 'fees')     typeof loadFeesTab        === 'function' && loadFeesTab();
      if (tab === 'profile')  typeof loadSellerProfile  === 'function' && loadSellerProfile();
      if (tab === 'messages') typeof loadSellerMessages === 'function' && loadSellerMessages();
      
      console.log('[modern-dashboard] Tab switch complete');
    });
  });
});

// GCash QR Code Upload
class QRCodeUploader {
  constructor() {
    this.qrImage = null;
    this.init();
  }

  init() {
    const dropzone = document.getElementById('qrDropzone');
    const input = document.getElementById('qrInput');
    const preview = document.getElementById('qrPreview');
    const removeBtn = document.getElementById('qrRemove');

    if (!dropzone || !input) return;

    // Click to upload
    dropzone.addEventListener('click', () => input.click());

    // File input change
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
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
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    // Remove button
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeQR();
      });
    }
  }

  handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    // Read and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.qrImage = {
        file: file,
        url: e.target.result
      };
      this.showPreview();
    };
    reader.readAsDataURL(file);
  }

  showPreview() {
    const dropzone = document.getElementById('qrDropzone');
    const preview = document.getElementById('qrPreview');
    const img = document.getElementById('qrImage');

    if (dropzone && preview && img) {
      dropzone.style.display = 'none';
      preview.style.display = 'block';
      img.src = this.qrImage.url;
    }
  }

  removeQR() {
    const dropzone = document.getElementById('qrDropzone');
    const preview = document.getElementById('qrPreview');
    const input = document.getElementById('qrInput');

    if (dropzone && preview) {
      dropzone.style.display = 'block';
      preview.style.display = 'none';
    }

    if (input) input.value = '';
    this.qrImage = null;
  }

  getQRImage() {
    return this.qrImage;
  }
}

// Initialize QR uploader
let qrUploader;
document.addEventListener('DOMContentLoaded', () => {
  qrUploader = new QRCodeUploader();
  
  // Character counter for description
  const descTextarea = document.getElementById('newDescription');
  const charCount = document.getElementById('descCharCount');
  if (descTextarea && charCount) {
    descTextarea.addEventListener('input', () => {
      const count = descTextarea.value.length;
      charCount.textContent = count;
      if (count > 500) {
        charCount.style.color = '#EF4444';
      } else {
        charCount.style.color = '';
      }
    });
  }
});

// Export for use in other scripts
window.qrUploader = qrUploader;
