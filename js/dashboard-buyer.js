// ============================================================
// dashboard-buyer.js — Buyer dashboard logic
// Used on: dashboard-buyer.html
// ============================================================

// ---- TAB SWITCHING ----
document.querySelectorAll('.dash-nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll('.dash-nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    link.classList.add('active');
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
    const titleEl = document.getElementById('dashPageTitle');
    if (titleEl) titleEl.textContent = link.textContent.trim();
    
    if (tab === 'orders') loadBuyerOrders();
    if (tab === 'addresses') loadBuyerAddresses();
  });
});

// ---- OVERVIEW STATS ----
async function loadOverviewStats() {
  const currentUser = authManager.getCurrentUser();
  if (!currentUser) return;

  try {
    console.log('[buyer] Loading stats for user:', currentUser.email);

    // Use buyer_email to match orders since buyer_user_id doesn't exist
    const { count: totalOrders } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_email', currentUser.email);

    const { count: pendingOrders } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_email', currentUser.email)
      .eq('status', 'pending');

    const { count: deliveredOrders } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_email', currentUser.email)
      .eq('status', 'delivered');

    // Calculate total spent
    const { data: orders } = await db
      .from('orders')
      .select('total_price')
      .eq('buyer_email', currentUser.email);

    const totalSpent = (orders || []).reduce((sum, order) => sum + parseFloat(order.total_price || 0), 0);

    console.log('[buyer] Stats loaded:', { totalOrders, pendingOrders, deliveredOrders, totalSpent });

    // Update stats
    const el = id => document.getElementById(id);
    if (el('statTotalOrders')) el('statTotalOrders').textContent = totalOrders ?? 0;
    if (el('statPendingOrders')) el('statPendingOrders').textContent = pendingOrders ?? 0;
    if (el('statDeliveredOrders')) el('statDeliveredOrders').textContent = deliveredOrders ?? 0;
    if (el('statTotalSpent')) el('statTotalSpent').textContent = formatPHP(totalSpent);

    // Load recent orders
    const { data: recentOrders } = await db
      .from('orders')
      .select('*, products(name, image_url)')
      .eq('buyer_email', currentUser.email)
      .order('created_at', { ascending: false })
      .limit(5);

    const list = document.getElementById('recentOrdersList');
    if (list) {
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      list.innerHTML = recentOrders?.length
        ? recentOrders.map(o => orderRowHTML(o)).join('')
        : `<p class="dash-empty">No orders yet. <a href="${prefix}shop.html">Start shopping!</a></p>`;
    }

  } catch (error) {
    console.error('[buyer] loadOverviewStats:', error.message);
    console.error('[buyer] Full error:', error);
  }
}

// ---- ORDERS TAB ----
function orderRowHTML(o) {
  const productName = o.products?.name || 'Product';
  const productImage = o.products?.image_url || '';
  const trackingData = JSON.parse(localStorage.getItem(`rewear_tracking_${o.id}`) || '{}');
  const hasTracking = trackingData.tracking_number || trackingData.courier_name;
  
  return `
    <div class="dash-order-row" data-order-id="${o.id}">
      <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1;">
        ${productImage ? `<img src="${productImage}" alt="${productName}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 6px; flex-shrink:0;">` : ''}
        <div style="flex:1;">
          <p class="dash-order-name">${productName}</p>
          <p class="dash-order-meta">Size: ${o.size_selected || '—'} · ${formatPHP(o.total_price || 0)}</p>
          <p class="dash-order-meta">${formatDate(o.created_at)}</p>
          ${hasTracking ? `
          <div style="margin-top:6px;padding:8px;background:#f0f9f0;border-radius:6px;font-size:13px;">
            <strong>📦 Tracking Info</strong><br>
            ${trackingData.courier_name ? `Courier: ${trackingData.courier_name}<br>` : ''}
            ${trackingData.tracking_number ? `Tracking #: ${trackingData.tracking_number}` : ''}
          </div>` : ''}
          ${o.status === 'delivered' ? `
          <button onclick="confirmReceipt('${o.id}')" 
                  style="margin-top:8px;padding:8px 16px;background:#27ae60;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            ✓ Confirm Receipt
          </button>` : ''}
          ${o.status === 'received' ? `
          <p style="margin-top:6px;color:#27ae60;font-weight:600;font-size:13px;">✓ Receipt Confirmed</p>` : ''}
        </div>
      </div>
      <span class="dash-order-status status-${o.status}">${o.status.replace(/_/g, ' ')}</span>
    </div>`;
}

async function confirmReceipt(orderId) {
  if (!confirm('Confirm that you have received this order?')) return;
  
  try {
    const { error } = await db
      .from('orders')
      .update({ status: 'received' })
      .eq('id', orderId);
      
    if (error) throw error;
    
    showSuccess('Receipt Confirmed!', 'Thank you for confirming your order receipt.', 'Got it');
    loadBuyerOrders();
    loadOverviewStats();
  } catch (error) {
    showError('Error', 'Could not confirm receipt. Please try again.');
    console.error('[buyer] confirmReceipt:', error);
  }
}

async function loadBuyerOrders() {
  const currentUser = authManager.getCurrentUser();
  if (!currentUser) return;

  const list = document.getElementById('buyerOrdersList');
  if (!list) return;
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
  let query = db
    .from('orders')
    .select('*, products(name, image_url)')
    .eq('buyer_email', currentUser.email)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  try {
    const { data, error } = await query;
    if (error) throw error;

    console.log('[buyer] Orders loaded:', data?.length || 0, 'orders');

    list.innerHTML = data?.length 
      ? data.map(o => orderRowHTML(o)).join('') 
      : '<p class="dash-empty">No orders found.</p>';
  } catch (error) {
    list.innerHTML = '<p class="dash-empty">Could not load orders.</p>';
    console.error('[buyer] loadBuyerOrders:', error.message);
    console.error('[buyer] Full error:', error);
  }
}

document.getElementById('orderStatusFilter')?.addEventListener('change', loadBuyerOrders);

// ---- PROFILE MANAGEMENT ----
async function loadBuyerProfile() {
  const currentUser = authManager.getCurrentUser();
  if (!currentUser) return;

  try {
    console.log('[buyer] Loading profile for user:', currentUser.email);

    // Populate form fields with current user data
    const nameField = document.getElementById('buyerName');
    const emailField = document.getElementById('buyerEmail');
    const phoneField = document.getElementById('buyerPhone');

    if (nameField) nameField.value = currentUser.name || '';
    if (emailField) emailField.value = currentUser.email || '';
    if (phoneField) phoneField.value = ''; // Phone not stored in local auth

    console.log('[buyer] Profile loaded successfully');

  } catch (error) {
    console.error('[buyer] loadBuyerProfile:', error.message);
  }
}

// ---- PROFILE FORM ----
document.getElementById('buyerProfileForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  
  const currentUser = authManager.getCurrentUser();
  if (!currentUser) return;

  const payload = {
    name: document.getElementById('buyerName').value.trim(),
    phone: document.getElementById('buyerPhone').value.trim()
  };

  // Validation
  if (!payload.name || payload.name.length < 2) {
    showError('Validation Error', 'Name must be at least 2 characters');
    return;
  }

  if (payload.phone && !validators.phone(payload.phone)) {
    showError('Validation Error', validationMessages.phone);
    return;
  }

  showLoadingModal('Saving…', 'Updating your profile.');

  try {
    // Update local auth user data
    const users = JSON.parse(localStorage.getItem('rewear_users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex !== -1) {
      users[userIndex].name = payload.name;
      localStorage.setItem('rewear_users', JSON.stringify(users));
      
      // Update current user session
      currentUser.name = payload.name;
      localStorage.setItem('rewear_current_user', JSON.stringify(currentUser));
    }

    hideLoadingModal();
    showSuccess('Profile Updated!', 'Your profile has been saved successfully.', 'Got it');

    console.log('[buyer] Profile updated successfully');

  } catch (error) {
    hideLoadingModal();
    showError('Save Failed', error.message);
    console.error('[buyer] saveProfile:', error.message);
  }
});

// ---- ADDRESSES MANAGEMENT ----
async function loadBuyerAddresses() {
  const currentUser = authManager.getCurrentUser();
  if (!currentUser) return;

  const list = document.getElementById('addressesList');
  if (!list) return;

  list.innerHTML = '<p class="dash-empty">Address management coming soon...</p>';

  // Note: Address functionality is not implemented in the current database schema
  console.log('[buyer] Address management not implemented yet');
}

// ---- ADDRESS ACTIONS ----
async function editAddress(addressId) {
  // TODO: Implement address editing modal
  showError('Coming Soon', 'Address editing will be available soon.');
}

async function deleteAddress(addressId) {
  if (!confirm('Are you sure you want to delete this address?')) return;

  showLoadingModal('Deleting…', 'Removing address.');

  try {
    const { error } = await db
      .from('buyer_addresses')
      .delete()
      .eq('id', addressId);

    if (error) throw error;

    hideLoadingModal();
    showSuccess('Address Deleted', 'The address has been removed.', 'Got it');
    loadBuyerAddresses();

  } catch (error) {
    hideLoadingModal();
    showError('Delete Failed', error.message);
    console.error('[buyer] deleteAddress:', error.message);
  }
}

document.getElementById('addAddressBtn')?.addEventListener('click', () => {
  // TODO: Implement add address modal
  showError('Coming Soon', 'Adding addresses will be available soon.');
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadOverviewStats();
});