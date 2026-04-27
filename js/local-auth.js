// ============================================================
// local-auth.js — Local Storage Authentication System
// No Supabase Auth - Pure localStorage based authentication
// Supabase is only used for database operations
// ============================================================

class LocalAuthManager {
  constructor() {
    this.currentUser = null;
    this.users = this.loadUsers();
    this.isInitialized = false;
    this.migrateInvalidUserIds(); // Fix any existing invalid IDs
    this.init();
  }

  init() {
    console.log('[local-auth] Initializing LocalAuthManager...');
    
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('rewear_current_user');
    console.log('[local-auth] Saved user in localStorage:', savedUser ? 'Found' : 'None');
    
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        console.log('[local-auth] Parsed current user:', this.currentUser);
        
        // Check if current user has invalid ID format
        if (this.currentUser.id && this.currentUser.id.startsWith('user_')) {
          console.log('[local-auth] Current user has invalid ID, logging out for re-authentication');
          this.clearAuthState();
          this.isInitialized = true;
          return;
        }
        
        this.syncUserSession(this.currentUser);
        console.log('[local-auth] User session synced successfully');
      } catch (error) {
        console.error('[local-auth] Failed to parse saved user:', error);
        this.clearAuthState();
      }
    }
    
    this.isInitialized = true;
    console.log('[local-auth] Initialization complete. Current user:', this.currentUser ? 'Logged in' : 'Not logged in');
  }

  // ---- USER STORAGE MANAGEMENT ----
  
  loadUsers() {
    const users = localStorage.getItem('rewear_users');
    const loadedUsers = users ? JSON.parse(users) : [];
    console.log('[local-auth] Loaded users from localStorage:', loadedUsers.length, 'users');
    console.log('[local-auth] User emails:', loadedUsers.map(u => u.email));
    return loadedUsers;
  }

  saveUsers() {
    localStorage.setItem('rewear_users', JSON.stringify(this.users));
  }

  findUserByEmail(email) {
    return this.users.find(user => user.email.toLowerCase() === email.toLowerCase());
  }

  generateUserId() {
    // Generate a proper UUID v4 format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Migration function to fix existing invalid user IDs
  migrateInvalidUserIds() {
    let needsSave = false;
    
    this.users.forEach(user => {
      // Check if user ID is in old format (starts with 'user_')
      if (user.id && user.id.startsWith('user_')) {
        console.log('[local-auth] Migrating invalid user ID:', user.id);
        user.id = this.generateUserId();
        needsSave = true;
      }
    });
    
    if (needsSave) {
      this.saveUsers();
      console.log('[local-auth] User ID migration completed');
    }
  }

  // ---- AUTHENTICATION METHODS ----

  async signUp(email, password, userData = {}) {
    try {
      // Clean email
      const cleanEmail = email.trim().toLowerCase();
      
      // Validate email format
      if (!validators.email(cleanEmail)) {
        throw new Error('Invalid email format');
      }

      // Check if user already exists
      if (this.findUserByEmail(cleanEmail)) {
        throw new Error('User already exists with this email');
      }

      // Validate password
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Create new user
      const newUser = {
        id: this.generateUserId(),
        email: cleanEmail,
        password: password, // In production, you'd hash this
        name: userData.name || '',
        accountType: userData.accountType || 'buyer',
        verified: true, // Auto-verify since no email confirmation
        createdAt: new Date().toISOString()
      };

      // Add to users array
      this.users.push(newUser);
      this.saveUsers();

      // Create user profile in Supabase (database only)
      await this.createUserProfile(newUser, userData);

      // Auto-login the user
      this.currentUser = { ...newUser };
      delete this.currentUser.password; // Don't store password in current user
      localStorage.setItem('rewear_current_user', JSON.stringify(this.currentUser));
      this.syncUserSession(this.currentUser);

      return { 
        data: { user: this.currentUser }, 
        error: null 
      };
    } catch (error) {
      console.error('[local-auth] Sign up failed:', error.message);
      return { 
        data: null, 
        error: { message: error.message }
      };
    }
  }

  async signIn(email, password, rememberMe = false) {
    try {
      console.log('[local-auth] signIn attempt:', { email, rememberMe });
      
      const cleanEmail = email.trim().toLowerCase();
      
      // Find user
      const user = this.findUserByEmail(cleanEmail);
      console.log('[local-auth] User found:', user ? 'Yes' : 'No');
      
      if (!user) {
        console.log('[local-auth] Available users:', this.users.map(u => ({ email: u.email, id: u.id })));
        throw new Error('Invalid email or password');
      }

      // Check password
      console.log('[local-auth] Checking password...');
      if (user.password !== password) {
        console.log('[local-auth] Password mismatch');
        throw new Error('Invalid email or password');
      }

      console.log('[local-auth] Login successful, setting up session...');

      // Login successful
      this.currentUser = { ...user };
      delete this.currentUser.password; // Don't store password in current user
      
      // Save to localStorage (always save for persistence)
      localStorage.setItem('rewear_current_user', JSON.stringify(this.currentUser));
      if (rememberMe) {
        localStorage.setItem('rewear_remember_me', 'true');
        console.log('[local-auth] Remember me enabled');
      } else {
        localStorage.removeItem('rewear_remember_me');
        console.log('[local-auth] Remember me disabled');
      }

      this.syncUserSession(this.currentUser);
      console.log('[local-auth] Session synced successfully');

      return { 
        data: { user: this.currentUser }, 
        error: null 
      };
    } catch (error) {
      console.error('[local-auth] Sign in failed:', error.message);
      return { 
        data: null, 
        error: { message: error.message }
      };
    }
  }

  async signOut() {
    try {
      this.currentUser = null;
      this.clearAuthState();
      
      // Emit auth state change event
      document.dispatchEvent(new CustomEvent('authStateChanged'));
      
      return { error: null };
    } catch (error) {
      console.error('[local-auth] Sign out failed:', error.message);
      return { error: { message: error.message } };
    }
  }

  async resetPassword(email) {
    try {
      const user = this.findUserByEmail(email);
      if (!user) {
        throw new Error('No user found with this email');
      }

      // In a real app, you'd send an email
      // For now, we'll just return success
      return { 
        data: { message: 'Password reset instructions sent to email' }, 
        error: null 
      };
    } catch (error) {
      return { 
        data: null, 
        error: { message: error.message }
      };
    }
  }

  async updatePassword(newPassword) {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in');
      }

      // Find user in storage and update password
      const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
      if (userIndex === -1) {
        throw new Error('User not found');
      }

      this.users[userIndex].password = newPassword;
      this.saveUsers();

      return { 
        data: { message: 'Password updated successfully' }, 
        error: null 
      };
    } catch (error) {
      return { 
        data: null, 
        error: { message: error.message }
      };
    }
  }

  // ---- USER PROFILE MANAGEMENT (Local Only) ----

  async createUserProfile(user, userData) {
    // Profile creation is handled locally - no Supabase database calls
    console.log('[local-auth] User profile created locally:', user.email);
  }

  async getUserProfile() {
    if (!this.currentUser) return null;

    return {
      user: this.currentUser,
      seller: this.currentUser.accountType === 'seller' ? this.currentUser : null,
      buyer: this.currentUser,
      accountType: this.currentUser.accountType || 'buyer'
    };
  }

  // ---- SESSION MANAGEMENT ----

  syncUserSession(user) {
    try {
      // Set session data for backward compatibility
      if (user.accountType === 'seller') {
        sessionStorage.setItem('rewear_seller_id', user.id);
        sessionStorage.setItem('rewear_user_type', 'seller');
      } else {
        sessionStorage.setItem('rewear_user_type', 'buyer');
      }

      // Set common user session data
      sessionStorage.setItem('rewear_user_id', user.id);
      sessionStorage.setItem('rewear_user_email', user.email);
      
      // Store user metadata
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name || '',
        accountType: user.accountType || 'buyer',
        isVerified: user.verified || true
      };
      
      sessionStorage.setItem('rewear_user_data', JSON.stringify(userData));
      
    } catch (error) {
      console.error('[local-auth] Session sync failed:', error.message);
    }
  }

  clearAuthState() {
    // Clear localStorage (but keep admin session)
    localStorage.removeItem('rewear_current_user');
    localStorage.removeItem('rewear_remember_me');
    
    // Clear sessionStorage
    sessionStorage.removeItem('rewear_current_user');
    sessionStorage.removeItem('rewear_seller_id');
    sessionStorage.removeItem('rewear_user_id');
    sessionStorage.removeItem('rewear_user_email');
    sessionStorage.removeItem('rewear_user_type');
    sessionStorage.removeItem('rewear_user_data');
    // NOTE: do NOT clear rewear_admin here — admin uses localStorage now
  }

  // ---- NAVIGATION & REDIRECTS ----

  setRedirectAfterLogin(url) {
    sessionStorage.setItem('rewear_redirect_after_login', url);
  }

  handleAuthRedirect() {
    // Emit auth state change event
    document.dispatchEvent(new CustomEvent('authStateChanged'));
    
    const redirect = sessionStorage.getItem('rewear_redirect_after_login');
    
    if (redirect) {
      sessionStorage.removeItem('rewear_redirect_after_login');
      window.location.href = redirect;
      return;
    }

    // Default redirects based on account type - redirect to shop for better UX
    const userType = sessionStorage.getItem('rewear_user_type');
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    if (userType === 'seller') {
      window.location.href = prefix + 'dashboard-seller.html';
    } else {
      window.location.href = prefix + 'shop.html'; // Changed from index.html to shop.html
    }
  }

  redirectToLogin(message = null) {
    if (message) {
      sessionStorage.setItem('rewear_login_message', message);
    }
    
    // Save current page for redirect after login
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('signup.html') &&
        !window.location.pathname.includes('forgot-password.html')) {
      this.setRedirectAfterLogin(window.location.href);
    }
    
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    window.location.href = prefix + 'login.html';
  }

  // ---- AUTH GUARDS ----

  requireAuth(requiredType = null) {
    if (!this.currentUser) {
      this.redirectToLogin('Please log in to access this page.');
      return false;
    }

    if (requiredType) {
      const userType = sessionStorage.getItem('rewear_user_type');
      if (userType !== requiredType) {
        this.redirectToLogin(`This page requires a ${requiredType} account.`);
        return false;
      }
    }

    return true;
  }

  requireSeller() {
    return this.requireAuth('seller');
  }

  requireVerifiedSeller() {
    if (!this.requireSeller()) return false;

    const userData = JSON.parse(sessionStorage.getItem('rewear_user_data') || '{}');
    if (!userData.isVerified) {
      showError('Account Not Verified', 'Your seller account is pending admin approval.');
      return false;
    }

    return true;
  }

  // ---- PAGE INITIALIZERS ----

  initLoginPage() {
    // Show any pending messages
    const message = sessionStorage.getItem('rewear_login_message');
    if (message) {
      sessionStorage.removeItem('rewear_login_message');
      showError('Authentication Required', message);
    }

    // Redirect if already logged in
    if (this.currentUser) {
      this.handleAuthRedirect();
      return;
    }

    // Initialize form handlers
    this.setupLoginForm();
    this.setupPasswordToggle();
  }

  initSignupPage() {
    // Redirect if already logged in
    if (this.currentUser) {
      this.handleAuthRedirect();
      return;
    }

    // Initialize form handlers
    this.setupSignupForm();
    this.setupPasswordToggle();
  }

  initForgotPasswordPage() {
    this.setupForgotPasswordForm();
  }

  initResetPasswordPage() {
    this.setupResetPasswordForm();
  }

  // ---- FORM HANDLERS ----

  setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Prevent duplicate event listeners
    if (form.dataset.listenerAttached === 'true') {
      return;
    }
    form.dataset.listenerAttached = 'true';

    let isSubmitting = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isSubmitting) return;

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const rememberMe = document.getElementById('rememberMe')?.checked || false;

      // Clear previous errors
      this.clearFormErrors();

      // Validation
      if (!validators.email(email)) {
        this.showFieldError('emailError', 'Please enter a valid email address');
        return;
      }

      if (!password) {
        this.showFieldError('passwordError', 'Password is required');
        return;
      }

      // Set submitting flag and show loading state
      isSubmitting = true;
      this.setFormLoading(true);

      try {
        const { data, error } = await this.signIn(email, password, rememberMe);

        if (error) {
          this.showFormError(error.message);
        } else {
          // Success - redirect will happen automatically
          this.handleAuthRedirect();
        }
      } catch (err) {
        console.error('[local-auth] Unexpected error during login:', err);
        this.showFormError('An unexpected error occurred. Please try again.');
      } finally {
        isSubmitting = false;
        this.setFormLoading(false);
      }
    });
  }

  setupSignupForm() {
    const form = document.getElementById('signupForm');
    if (!form) return;

    // Prevent duplicate event listeners
    if (form.dataset.listenerAttached === 'true') {
      return;
    }
    form.dataset.listenerAttached = 'true';

    let isSubmitting = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isSubmitting) return;

      const name = document.getElementById('signupName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const accountType = document.getElementById('accountType').value;
      const agreeTerms = document.getElementById('agreeTerms').checked;

      // Clear previous errors
      this.clearFormErrors();

      // Validation
      if (!name || name.length < 2) {
        this.showFieldError('nameError', 'Name must be at least 2 characters');
        return;
      }

      if (!validators.email(email)) {
        this.showFieldError('emailError', 'Please enter a valid email address');
        return;
      }

      if (!password || password.length < 6) {
        this.showFieldError('passwordError', 'Password must be at least 6 characters');
        return;
      }

      if (password !== confirmPassword) {
        this.showFieldError('confirmPasswordError', 'Passwords do not match');
        return;
      }

      if (!accountType) {
        this.showFieldError('accountTypeError', 'Please select an account type');
        return;
      }

      if (!agreeTerms) {
        this.showFormError('Please agree to the Terms of Service and Privacy Policy');
        return;
      }

      // Set submitting flag and show loading state
      isSubmitting = true;
      this.setFormLoading(true);

      try {
        const { data, error } = await this.signUp(email, password, {
          name,
          accountType
        });

        if (error) {
          this.showFormError(error.message);
        } else {
          // Success - redirect immediately
          this.handleAuthRedirect();
        }
      } catch (err) {
        console.error('[local-auth] Unexpected error during signup:', err);
        this.showFormError('An unexpected error occurred. Please try again.');
      } finally {
        isSubmitting = false;
        this.setFormLoading(false);
      }
    });
  }

  setupForgotPasswordForm() {
    const form = document.getElementById('forgotPasswordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('resetEmail').value.trim();

      // Clear previous errors
      this.clearFormErrors();

      // Validation
      if (!validators.email(email)) {
        this.showFieldError('emailError', 'Please enter a valid email address');
        return;
      }

      // Show loading state
      this.setFormLoading(true);

      // Send reset email
      const { data, error } = await this.resetPassword(email);

      this.setFormLoading(false);

      if (error) {
        this.showFormError(error.message);
      } else {
        this.showFormSuccess('Password reset instructions sent! (Note: This is a demo - check console for details)');
        console.log('Password reset requested for:', email);
      }
    });
  }

  setupResetPasswordForm() {
    const form = document.getElementById('resetPasswordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;

      // Clear previous errors
      this.clearFormErrors();

      // Validation
      if (!password || password.length < 6) {
        this.showFieldError('passwordError', 'Password must be at least 6 characters');
        return;
      }

      if (password !== confirmPassword) {
        this.showFieldError('confirmPasswordError', 'Passwords do not match');
        return;
      }

      // Show loading state
      this.setFormLoading(true);

      // Update password
      const { data, error } = await this.updatePassword(password);

      this.setFormLoading(false);

      if (error) {
        this.showFormError(error.message);
      } else {
        this.showFormSuccess('Password updated successfully! Redirecting...');
        setTimeout(() => {
          this.handleAuthRedirect();
        }, 2000);
      }
    });
  }

  setupPasswordToggle() {
    // Handle password visibility toggles
    document.querySelectorAll('.password-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const input = toggle.parentElement.querySelector('input[type="password"], input[type="text"]');
        const icon = toggle.querySelector('.password-toggle-icon');
        
        if (input.type === 'password') {
          input.type = 'text';
          icon.textContent = '🙈';
        } else {
          input.type = 'password';
          icon.textContent = '👁';
        }
      });
    });
  }

  // ---- UI HELPERS ----

  clearFormErrors() {
    document.querySelectorAll('.form-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
    document.querySelectorAll('.form-success').forEach(el => {
      el.classList.add('hidden');
    });
  }

  showFieldError(fieldId, message) {
    const errorEl = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  showFormError(message) {
    const errorEl = document.getElementById('formError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  showFormSuccess(message) {
    const successEl = document.getElementById('formSuccess');
    if (successEl) {
      const messageEl = successEl.querySelector('p');
      if (messageEl) messageEl.textContent = message;
      successEl.classList.remove('hidden');
    }
  }

  setFormLoading(loading) {
    const submitBtn = document.querySelector('.auth-submit');
    if (!submitBtn) return;

    const textEl = submitBtn.querySelector('.btn-text');
    const spinnerEl = submitBtn.querySelector('.btn-spinner');

    if (loading) {
      submitBtn.disabled = true;
      submitBtn.style.pointerEvents = 'none';
      submitBtn.style.opacity = '0.6';
      textEl?.classList.add('hidden');
      spinnerEl?.classList.remove('hidden');
    } else {
      submitBtn.disabled = false;
      submitBtn.style.pointerEvents = 'auto';
      submitBtn.style.opacity = '1';
      textEl?.classList.remove('hidden');
      spinnerEl?.classList.add('hidden');
    }
  }

  // ---- UTILITY METHODS ----

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getUserType() {
    return sessionStorage.getItem('rewear_user_type') || 'buyer';
  }

  isSeller() {
    return this.getUserType() === 'seller';
  }

  isVerifiedSeller() {
    const userData = JSON.parse(sessionStorage.getItem('rewear_user_data') || '{}');
    return this.isSeller() && userData.isVerified;
  }

  // ---- ADMIN METHODS ----

  getAllUsers() {
    return this.users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      accountType: user.accountType,
      verified: user.verified,
      createdAt: user.createdAt
    }));
  }

  deleteUser(userId) {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.users.splice(userIndex, 1);
      this.saveUsers();
      return true;
    }
    return false;
  }
}

// ---- GLOBAL INSTANCE ----
const localAuthManager = new LocalAuthManager();
window.authManager = localAuthManager;

// ---- AUTH GUARDS FOR PROTECTED PAGES ----
function requireAuth(requiredType = null) {
  return window.authManager.requireAuth(requiredType);
}

function requireSeller() {
  return window.authManager.requireSeller();
}

function requireVerifiedSeller() {
  return window.authManager.requireVerifiedSeller();
}

// ---- LOGOUT FUNCTIONALITY ----
async function logout() {
  const { error } = await window.authManager.signOut();
  if (error) {
    showError('Logout Failed', error.message);
  } else {
    // Redirect to login page after successful logout
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    window.location.href = prefix + 'login.html';
  }
}

// Add logout event listeners to any logout buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', logout);
  });
});

console.log('[local-auth] Local Authentication Manager loaded');