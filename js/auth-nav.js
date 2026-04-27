// ============================================================
// auth-nav.js — Universal Navigation Auth State Handler
// Used on all pages to update navigation based on auth state
// ============================================================

function initAuthNavigation() {
  const updateNavigation = () => {
    // Ensure authManager is available
    if (!window.authManager) {
      setTimeout(updateNavigation, 100);
      return;
    }

    const authNav = document.getElementById('authNav');
    const userNav = document.getElementById('userNav');
    const userGreeting = document.getElementById('userGreeting');
    const dashboardBtn = document.getElementById('userDashboardBtn');
    
    if (window.authManager.isAuthenticated()) {
      const user = window.authManager.getCurrentUser();
      const userType = window.authManager.getUserType();
      
      // Show user navigation
      if (authNav) authNav.classList.add('hidden');
      if (userNav) userNav.classList.remove('hidden');
      
      // Update greeting
      if (userGreeting) {
        userGreeting.textContent = `Hi, ${user.name || user.email.split('@')[0]}!`;
      }
      
      // Set dashboard link
      if (dashboardBtn) {
        dashboardBtn.onclick = () => {
          const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
          if (userType === 'seller') {
            window.location.href = prefix + 'dashboard-seller.html';
          } else {
            window.location.href = prefix + 'dashboard-buyer.html';
          }
        };
      }
    } else {
      // Show auth navigation
      if (authNav) authNav.classList.remove('hidden');
      if (userNav) userNav.classList.add('hidden');
    }
  };

  // Initialize immediately and on auth state changes
  updateNavigation();
  
  // Listen for auth state changes (custom event)
  document.addEventListener('authStateChanged', updateNavigation);
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', initAuthNavigation);

// Also initialize immediately if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthNavigation);
} else {
  initAuthNavigation();
}