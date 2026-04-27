// ============================================================
// auth.js — Supabase Online Authentication
// Replaces local-auth.js — uses real Supabase Auth
// ============================================================

class AuthManager {
  constructor() {
    this.currentUser  = null;
    this.currentSession = null;
    this._initialized = false;
    this._initPromise = this._init();
  }

  // ---- INIT ----
  async _init() {
    try {
      // Get current session from Supabase
      const { data: { session }, error } = await db.auth.getSession();
      if (session) {
        this.currentSession = session;
        this.currentUser    = this._buildUser(session.user);
        this._syncSession(this.currentUser);

        // Handle Google OAuth callback — new user needs account type set
        await this._handleOAuthCallback(session);
      }
    } catch (e) {
      console.error('[auth] init error:', e.message);
    }

    // Listen for auth state changes (login, logout, token refresh)
    db.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        this.currentSession = session;
        this.currentUser    = this._buildUser(session.user);
        this._syncSession(this.currentUser);

        // On new Google sign-in, handle account type
        if (event === 'SIGNED_IN') {
          await this._handleOAuthCallback(session);
        }
      } else {
        this.currentSession = null;
        this.currentUser    = null;
        this._clearSession();
      }
      document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { event, session } }));
    });

    this._initialized = true;
  }

  // Handle Google OAuth new user setup
  async _handleOAuthCallback(session) {
    const user = session?.user;
    if (!user) return;

    // Only for OAuth (Google) users
    const isOAuth = user.app_metadata?.provider === 'google';
    if (!isOAuth) return;

    // Get account type from sessionStorage (set before Google redirect)
    const accountType = sessionStorage.getItem('google_account_type') || 'buyer';
    sessionStorage.removeItem('google_account_type');

    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || user.email.split('@')[0];

    // Update user metadata with account type
    try {
      await db.auth.updateUser({
        data: { name, accountType }
      });
    } catch (e) {
      console.warn('[auth] could not update user metadata:', e.message);
    }

    // Ensure buyer profile exists
    await db.from('buyers').upsert({
      id:    user.id,
      name,
      email: user.email
    }, { onConflict: 'id' });

    // If seller, ensure seller record exists
    if (accountType === 'seller') {
      await db.from('sellers').upsert({
        id:            user.id,
        user_id:       user.id,
        business_name: name,
        email:         user.email,
        verified:      false
      }, { onConflict: 'id' });
    }

    // Redirect to correct dashboard
    const isOnAuthPage = window.location.pathname.includes('login.html') ||
                         window.location.pathname.includes('signup.html');
    if (isOnAuthPage) {
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      window.location.href = prefix + (accountType === 'seller' ? 'dashboard-seller.html' : 'shop.html');
    }
  }

  // Build a clean user object from Supabase user
  _buildUser(supabaseUser) {
    if (!supabaseUser) return null;
    const meta = supabaseUser.user_metadata || {};
    return {
      id:          supabaseUser.id,
      email:       supabaseUser.email,
      name:        meta.name        || meta.full_name || '',
      accountType: meta.accountType || meta.account_type || 'buyer',
      verified:    supabaseUser.email_confirmed_at ? true : false,
      createdAt:   supabaseUser.created_at
    };
  }

  // Sync to sessionStorage for backward compatibility with existing pages
  _syncSession(user) {
    if (!user) return;
    sessionStorage.setItem('rewear_user_id',    user.id);
    sessionStorage.setItem('rewear_user_email', user.email);
    sessionStorage.setItem('rewear_user_type',  user.accountType);
    sessionStorage.setItem('rewear_user_data',  JSON.stringify(user));
    if (user.accountType === 'seller') {
      sessionStorage.setItem('rewear_seller_id', user.id);
    }
  }

  _clearSession() {
    sessionStorage.removeItem('rewear_user_id');
    sessionStorage.removeItem('rewear_user_email');
    sessionStorage.removeItem('rewear_user_type');
    sessionStorage.removeItem('rewear_user_data');
    sessionStorage.removeItem('rewear_seller_id');
  }

  // ---- SIGN UP ----
  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            name:        userData.name        || '',
            accountType: userData.accountType || 'buyer'
          }
        }
      });

      if (error) throw error;

      // If seller, create a sellers table record
      if (userData.accountType === 'seller' && data.user) {
        await db.from('sellers').upsert({
          id:            data.user.id,
          user_id:       data.user.id,
          business_name: userData.name || email.split('@')[0],
          email:         email,
          verified:      false
        }, { onConflict: 'id' });
      }

      return { data, error: null };
    } catch (error) {
      console.error('[auth] signUp:', error.message);
      return { data: null, error };
    }
  }

  // ---- SIGN IN ----
  async signIn(email, password) {
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[auth] signIn:', error.message);
      return { data: null, error };
    }
  }

  // ---- SIGN OUT ----
  async signOut() {
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      localStorage.removeItem('rewear_admin');
      return { error: null };
    } catch (error) {
      console.error('[auth] signOut:', error.message);
      return { error };
    }
  }

  // ---- RESET PASSWORD ----
  async resetPassword(email) {
    try {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/pages/reset-password.html'
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  // ---- UPDATE PASSWORD ----
  async updatePassword(newPassword) {
    try {
      const { error } = await db.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  // ---- GETTERS ----
  getCurrentUser()    { return this.currentUser; }
  isAuthenticated()   { return !!this.currentUser; }
  getUserType()       { return this.currentUser?.accountType || sessionStorage.getItem('rewear_user_type') || 'buyer'; }
  isSeller()          { return this.getUserType() === 'seller'; }
  isVerifiedSeller()  { return this.isSeller() && this.currentUser?.verified; }

  // ---- REDIRECTS ----
  handleAuthRedirect() {
    const redirect = sessionStorage.getItem('rewear_redirect_after_login');
    if (redirect) {
      sessionStorage.removeItem('rewear_redirect_after_login');
      window.location.href = redirect;
      return;
    }
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    if (this.getUserType() === 'seller') {
      window.location.href = prefix + 'dashboard-seller.html';
    } else {
      window.location.href = prefix + 'shop.html';
    }
  }

  redirectToLogin(message = null) {
    if (message) sessionStorage.setItem('rewear_login_message', message);
    if (!window.location.pathname.includes('login.html') &&
        !window.location.pathname.includes('signup.html')) {
      sessionStorage.setItem('rewear_redirect_after_login', window.location.href);
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
    if (requiredType && this.getUserType() !== requiredType) {
      this.redirectToLogin(`This page requires a ${requiredType} account.`);
      return false;
    }
    return true;
  }

  requireSeller()         { return this.requireAuth('seller'); }
  requireVerifiedSeller() { return this.requireAuth('seller'); }

  // ---- PAGE INITIALIZERS ----
  initLoginPage() {
    const message = sessionStorage.getItem('rewear_login_message');
    if (message) {
      sessionStorage.removeItem('rewear_login_message');
      const el = document.getElementById('formError');
      if (el) { el.textContent = message; el.classList.add('visible'); }
    }

    // Already logged in — redirect away
    if (this.currentUser) { this.handleAuthRedirect(); return; }

    this._setupLoginForm();
    this._setupPasswordToggle();
  }

  initSignupPage() {
    if (this.currentUser) { this.handleAuthRedirect(); return; }
    this._setupSignupForm();
    this._setupPasswordToggle();
  }

  initForgotPasswordPage()  { this._setupForgotPasswordForm(); }
  initResetPasswordPage()   { this._setupResetPasswordForm(); }

  // ---- FORM HANDLERS ----
  _setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form || form.dataset.listenerAttached) return;
    form.dataset.listenerAttached = 'true';

    let busy = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;

      const email    = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      this._clearErrors();

      if (!email)    { this._fieldError('emailError',    'Email is required');    return; }
      if (!password) { this._fieldError('passwordError', 'Password is required'); return; }

      busy = true;
      this._setLoading(true);

      const { data, error } = await this.signIn(email, password);

      busy = false;
      this._setLoading(false);

      if (error) {
        // Friendly error messages
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('wrong')) {
          this._formError('Incorrect email or password. Please try again.');
        } else if (msg.includes('email not confirmed')) {
          this._formError('Please verify your email first. Check your inbox for a confirmation link.');
        } else {
          this._formError(error.message);
        }
      } else {
        this.handleAuthRedirect();
      }
    });
  }

  _setupSignupForm() {
    const form = document.getElementById('signupForm');
    if (!form || form.dataset.listenerAttached) return;
    form.dataset.listenerAttached = 'true';

    let busy = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;

      const name            = document.getElementById('signupName').value.trim();
      const email           = document.getElementById('signupEmail').value.trim();
      const password        = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const accountType     = document.getElementById('accountType').value;
      const agreeTerms      = document.getElementById('agreeTerms').checked;

      this._clearErrors();

      if (!name || name.length < 2)   { this._fieldError('nameError',            'Name must be at least 2 characters'); return; }
      if (!email)                      { this._fieldError('emailError',           'Email is required'); return; }
      if (!password || password.length < 8) { this._fieldError('passwordError',  'Password must be at least 8 characters'); return; }
      if (password !== confirmPassword){ this._fieldError('confirmPasswordError', 'Passwords do not match'); return; }
      if (!accountType)                { this._fieldError('accountTypeError',     'Please select an account type'); return; }
      if (!agreeTerms)                 { this._formError('Please agree to the Terms of Service'); return; }

      busy = true;
      this._setLoading(true);

      const { data, error } = await this.signUp(email, password, { name, accountType });

      busy = false;
      this._setLoading(false);

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('already registered') || msg.includes('already exists')) {
          this._formError('An account with this email already exists. Try logging in.');
        } else {
          this._formError(error.message);
        }
      } else {
        // Show success — Supabase sends a confirmation email
        this._showSuccess('Account created! Check your email for a confirmation link, then log in.');
        form.reset();
      }
    });
  }

  _setupForgotPasswordForm() {
    const form = document.getElementById('forgotPasswordForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('resetEmail').value.trim();
      this._clearErrors();
      if (!email) { this._fieldError('emailError', 'Email is required'); return; }
      this._setLoading(true);
      const { error } = await this.resetPassword(email);
      this._setLoading(false);
      if (error) {
        this._formError(error.message);
      } else {
        this._showSuccess('Password reset email sent! Check your inbox.');
      }
    });
  }

  _setupResetPasswordForm() {
    const form = document.getElementById('resetPasswordForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const password        = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;
      this._clearErrors();
      if (!password || password.length < 8) { this._fieldError('passwordError', 'Password must be at least 8 characters'); return; }
      if (password !== confirmPassword)      { this._fieldError('confirmPasswordError', 'Passwords do not match'); return; }
      this._setLoading(true);
      const { error } = await this.updatePassword(password);
      this._setLoading(false);
      if (error) {
        this._formError(error.message);
      } else {
        this._showSuccess('Password updated! Redirecting to login...');
        setTimeout(() => {
          const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
          window.location.href = prefix + 'login.html';
        }, 2000);
      }
    });
  }

  _setupPasswordToggle() {
    document.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const input = btn.parentElement.querySelector('input');
        const icon  = btn.querySelector('.password-toggle-icon');
        if (input.type === 'password') { input.type = 'text';     if (icon) icon.textContent = '🙈'; }
        else                           { input.type = 'password'; if (icon) icon.textContent = '👁'; }
      });
    });
  }

  // ---- UI HELPERS ----
  _clearErrors() {
    document.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; el.classList.remove('visible'); });
    document.querySelectorAll('.form-success').forEach(el => el.classList.add('hidden'));
  }

  _fieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('visible'); }
  }

  _formError(msg) {
    const el = document.getElementById('formError');
    if (el) { el.textContent = msg; el.classList.add('visible'); }
  }

  _showSuccess(msg) {
    const el = document.getElementById('formSuccess');
    if (el) {
      const p = el.querySelector('p');
      if (p) p.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  _setLoading(loading) {
    const btn = document.querySelector('.auth-submit');
    if (!btn) return;
    const text    = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.7' : '1';
    text?.classList.toggle('hidden', loading);
    spinner?.classList.toggle('hidden', !loading);
  }

  // ---- BACKWARD COMPAT (used by old pages) ----
  getAllUsers()       { return []; } // not applicable with Supabase Auth
  deleteUser()       { return false; }
  setRedirectAfterLogin(url) { sessionStorage.setItem('rewear_redirect_after_login', url); }
}

// ---- GLOBAL INSTANCE ----
// Wait for Supabase db to be ready before creating AuthManager
function _initAuthManager() {
  if (typeof db !== 'undefined') {
    window.authManager = new AuthManager();
  } else {
    setTimeout(_initAuthManager, 50);
  }
}
_initAuthManager();

// ---- GLOBAL HELPERS (backward compat) ----
function requireAuth(requiredType = null) {
  return window.authManager?.requireAuth(requiredType) ?? false;
}
function requireSeller()         { return window.authManager?.requireSeller()         ?? false; }
function requireVerifiedSeller() { return window.authManager?.requireVerifiedSeller() ?? false; }

async function logout() {
  const { error } = await window.authManager?.signOut();
  if (error) { if (typeof showError === 'function') showError('Logout Failed', error.message); return; }
  const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
  window.location.href = prefix + 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', logout);
  });
});

console.log('[auth] Supabase Auth Manager loaded');
