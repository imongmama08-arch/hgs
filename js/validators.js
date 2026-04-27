// ============================================================
// validators.js — Input validation utilities
// Loaded on all pages that need validation
// ============================================================

const validators = {
  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  email: (email) => {
    if (!email || typeof email !== 'string') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  },

  /**
   * Validate price (must be positive and reasonable)
   * @param {number} price
   * @returns {boolean}
   */
  price: (price) => {
    const num = parseFloat(price);
    return !isNaN(num) && num > 0 && num < 1000000;
  },

  /**
   * Validate Philippine phone number
   * @param {string} phone
   * @returns {boolean}
   */
  phone: (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    // Accepts: +639xxxxxxxxx, 09xxxxxxxxx, 9xxxxxxxxx
    const regex = /^(\+63|0)?9[0-9]{9}$/;
    return regex.test(phone.replace(/[\s-]/g, ''));
  },

  /**
   * Validate listing fee tier
   * @param {string} tier
   * @returns {boolean}
   */
  tier: (tier) => {
    return ['basic', 'standard', 'premium'].includes(tier);
  },

  /**
   * Validate Cloudinary image URL
   * @param {string} url
   * @returns {boolean}
   */
  imageUrl: (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && 
             (parsed.hostname.includes('cloudinary.com') || 
              parsed.hostname.includes('res.cloudinary.com'));
    } catch {
      return false;
    }
  },

  /**
   * Validate product name (non-empty, reasonable length)
   * @param {string} name
   * @returns {boolean}
   */
  productName: (name) => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 3 && trimmed.length <= 200;
  },

  /**
   * Validate business name
   * @param {string} name
   * @returns {boolean}
   */
  businessName: (name) => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  },

  /**
   * Validate category
   * @param {string} category
   * @returns {boolean}
   */
  category: (category) => {
    const validCategories = ['shirts', 'pants', 'jackets', 'shoes', 'accessories', 'dresses', 'bags'];
    return validCategories.includes(category);
  },

  /**
   * Validate size array
   * @param {Array} sizes
   * @returns {boolean}
   */
  sizes: (sizes) => {
    if (!Array.isArray(sizes) || sizes.length === 0) return false;
    const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return sizes.every(size => validSizes.includes(size));
  },

  /**
   * Sanitize HTML to prevent XSS
   * @param {string} html
   * @returns {string}
   */
  sanitizeHtml: (html) => {
    if (!html || typeof html !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },

  /**
   * Validate and sanitize description
   * @param {string} description
   * @returns {string|null}
   */
  description: (description) => {
    if (!description || typeof description !== 'string') return null;
    const sanitized = validators.sanitizeHtml(description);
    return sanitized.length <= 2000 ? sanitized : null;
  },

  /**
   * Validate quantity
   * @param {number} quantity
   * @returns {boolean}
   */
  quantity: (quantity) => {
    const num = parseInt(quantity, 10);
    return !isNaN(num) && num >= 0 && num <= 10000;
  },

  /**
   * Validate UUID format
   * @param {string} uuid
   * @returns {boolean}
   */
  uuid: (uuid) => {
    if (!uuid || typeof uuid !== 'string') return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }
};

// Validation error messages
const validationMessages = {
  email: 'Please enter a valid email address',
  price: 'Price must be between ₱1 and ₱999,999',
  phone: 'Please enter a valid Philippine phone number (e.g., 09171234567)',
  tier: 'Invalid listing tier selected',
  imageUrl: 'Please provide a valid Cloudinary image URL',
  productName: 'Product name must be between 3 and 200 characters',
  businessName: 'Business name must be between 2 and 100 characters',
  category: 'Please select a valid category',
  sizes: 'Please select at least one valid size',
  description: 'Description must be 2000 characters or less',
  quantity: 'Quantity must be between 0 and 10,000',
  uuid: 'Invalid ID format'
};

/**
 * Validate an object against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Schema definition { field: 'validatorName' }
 * @returns {{ valid: boolean, errors: Object }}
 */
function validateObject(data, schema) {
  const errors = {};
  let valid = true;

  for (const [field, validatorName] of Object.entries(schema)) {
    const validator = validators[validatorName];
    if (!validator) {
      console.error(`[validators] Unknown validator: ${validatorName}`);
      continue;
    }

    if (!validator(data[field])) {
      errors[field] = validationMessages[validatorName] || `Invalid ${field}`;
      valid = false;
    }
  }

  return { valid, errors };
}

/**
 * Show validation errors in UI
 * @param {Object} errors - Errors object from validateObject
 */
function showValidationErrors(errors) {
  const errorMessages = Object.values(errors).join('\n');
  showError('Validation Error', errorMessages);
}
