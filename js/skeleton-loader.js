// ============================================================
// skeleton-loader.js — Skeleton loading utilities
// ============================================================

/**
 * Skeleton Loader Utility
 * Creates skeleton loading states for various components
 */

const SkeletonLoader = {
  
  /**
   * Create skeleton product card
   */
  productCard() {
    return `
      <div class="skeleton-product-card">
        <div class="skeleton skeleton-product-image"></div>
        <div class="skeleton skeleton-product-title"></div>
        <div class="skeleton skeleton-product-price"></div>
        <div class="skeleton-product-sizes">
          <div class="skeleton skeleton-size-chip"></div>
          <div class="skeleton skeleton-size-chip"></div>
          <div class="skeleton skeleton-size-chip"></div>
        </div>
      </div>
    `;
  },

  /**
   * Create skeleton product grid
   */
  productGrid(count = 8) {
    const cards = Array(count).fill(this.productCard()).join('');
    return `<div class="skeleton-grid">${cards}</div>`;
  },

  /**
   * Create skeleton stat card (for dashboard)
   */
  statCard() {
    return `
      <div class="skeleton-stat-card">
        <div class="skeleton skeleton-stat-icon"></div>
        <div class="skeleton-stat-content">
          <div class="skeleton skeleton-stat-label"></div>
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-change"></div>
        </div>
      </div>
    `;
  },

  /**
   * Create skeleton dashboard stats
   */
  dashboardStats(count = 4) {
    const cards = Array(count).fill(this.statCard()).join('');
    return `<div class="skeleton-dashboard-grid">${cards}</div>`;
  },

  /**
   * Create skeleton list item (for orders, listings)
   */
  listItem() {
    return `
      <div class="skeleton-list-item">
        <div class="skeleton skeleton-list-image"></div>
        <div class="skeleton-list-content">
          <div class="skeleton skeleton-list-title"></div>
          <div class="skeleton skeleton-list-subtitle"></div>
        </div>
      </div>
    `;
  },

  /**
   * Create skeleton list
   */
  list(count = 5) {
    return Array(count).fill(this.listItem()).join('');
  },

  /**
   * Create loading spinner overlay
   */
  spinner() {
    return `
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
    `;
  },

  /**
   * Show skeleton in element
   */
  show(element, type = 'productGrid', count) {
    if (!element) return;
    
    const skeletonHTML = {
      productCard: this.productCard(),
      productGrid: this.productGrid(count),
      statCard: this.statCard(),
      dashboardStats: this.dashboardStats(count),
      listItem: this.listItem(),
      list: this.list(count),
      spinner: this.spinner()
    }[type];

    element.innerHTML = skeletonHTML || '';
  },

  /**
   * Hide skeleton and show content
   */
  hide(element, content) {
    if (!element) return;
    element.innerHTML = content || '';
  },

  /**
   * Show loading overlay on element
   */
  showOverlay(element) {
    if (!element) return;
    element.style.position = 'relative';
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    element.appendChild(overlay);
  },

  /**
   * Hide loading overlay
   */
  hideOverlay(element) {
    if (!element) return;
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
  }
};

// Export for use in other scripts
window.SkeletonLoader = SkeletonLoader;
