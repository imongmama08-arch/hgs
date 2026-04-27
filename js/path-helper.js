// ============================================================
// path-helper.js — Path resolution helper
// Automatically detects if we're in root or pages folder
// and provides correct paths for navigation
// ============================================================

const PathHelper = {
  /**
   * Detect if current page is in pages folder or root
   * @returns {boolean} true if in pages folder
   */
  isInPagesFolder() {
    const path = window.location.pathname;
    return path.includes('/pages/');
  },

  /**
   * Get the correct path prefix based on current location
   * @returns {string} '../' if in pages folder, '' if in root
   */
  getPrefix() {
    return this.isInPagesFolder() ? '../' : '';
  },

  /**
   * Get correct path to a page
   * @param {string} page - Page filename (e.g., 'shop.html')
   * @returns {string} Correct relative path
   */
  toPage(page) {
    if (this.isInPagesFolder()) {
      // We're in pages folder, link to another page in same folder
      return page;
    } else {
      // We're in root, link to pages folder
      return `pages/${page}`;
    }
  },

  /**
   * Get correct path to root index.html
   * @returns {string} Correct relative path to index.html
   */
  toRoot() {
    return this.isInPagesFolder() ? '../index.html' : 'index.html';
  },

  /**
   * Get correct path to CSS file
   * @param {string} file - CSS filename
   * @returns {string} Correct relative path
   */
  toCss(file) {
    return `${this.getPrefix()}css/${file}`;
  },

  /**
   * Get correct path to JS file
   * @param {string} file - JS filename
   * @returns {string} Correct relative path
   */
  toJs(file) {
    return `${this.getPrefix()}js/${file}`;
  },

  /**
   * Get correct path to API file
   * @param {string} file - API filename
   * @returns {string} Correct relative path
   */
  toApi(file) {
    return `${this.getPrefix()}api/${file}`;
  },

  /**
   * Get correct path to asset
   * @param {string} path - Asset path (e.g., 'images/logo.png')
   * @returns {string} Correct relative path
   */
  toAsset(path) {
    return `${this.getPrefix()}assets/${path}`;
  },

  /**
   * Navigate to a page with correct path
   * @param {string} page - Page filename
   */
  navigateTo(page) {
    // Special handling for index.html
    if (page === 'index.html') {
      window.location.href = this.toRoot();
    } else {
      window.location.href = this.toPage(page);
    }
  },

  /**
   * Get current page name
   * @returns {string} Current page filename
   */
  getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1);
  }
};

// Make it globally available
window.PathHelper = PathHelper;
