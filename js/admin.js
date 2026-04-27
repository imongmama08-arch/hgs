// ============================================================
// admin.js — Admin dashboard logic
// Used on: admin.html
// PIN: 1234 (change in Supabase admin_sessions table)
// ============================================================

// Feature flag: set to true after running sql/06_missing_tables.sql
// Until then, admin panel uses sellers table fallback
let _sellerApplicationsExists = false;  // Change to true after SQL migration
async function checkSellerApplicationsTable() {
  // Skip check if explicitly disabled
  if (_sellerApplicationsExists === false) return false;
  
  if (_sellerApplicationsExists !== null) return _sellerApplicationsExists;
  
  // Try a minimal query and check for specific error codes
  const { data, error } = await db.from('seller_applications').select('id').limit(0);
  
  // Table exists if no error, or if error is NOT "relation does not exist" / 404
  _sellerApplicationsExists = !error || (error.code !== 'PGRST116' && !error.message?.includes('does not exist'));
  
  return _sellerApplicationsExists;
}

// ---- PIN GATE ----
const CORRECT_PIN = '1234'; // simple client check — real hash check via Supabase
const adminGate      = document.getElementById('adminGate');
const adminDashboard = document.getElementById('adminDashboard');
const pinDigits      = document.querySelectorAll('.pin-digit');
const pinError       = document.getElementById('pinError');
const pinSubmitBtn   = document.getElementById('pinSubmitBtn');

// Auto-advance PIN digits
pinDigits.forEach((input, i) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '');
    if (input.value && i < pinDigits.length - 1) pinDigits[i + 1].focus();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !input.value && i > 0) pinDigits[i - 1].focus();
  });
});

function getPin() { return [...pinDigits].map(d => d.value).join(''); }

function unlockAdmin() {
  adminGate.classList.add('hidden');
  adminDashboard.classList.remove('hidden');
  sessionStorage.setItem('rewear_admin', '1');
  loadOverviewStats();
  startClock();
}

// Check if already logged in this session
if (sessionStorage.getItem('rewear_admin') === '1') unlockAdmin();

pinSubmitBtn.addEventListener('click', checkPin);
document.addEventListener('keydown', e => { if (e.key === 'Enter') checkPin(); });

function checkPin() {
  const pin = getPin();
  if (pin === CORRECT_PIN) {
    unlockAdmin();
  } else {
    pinError.classList.remove('hidden');
    pinDigits.forEach(d => { d.value = ''; d.classList.add('pin-error-shake'); });
    setTimeout(() => pinDigits.forEach(d => d.classList.remove('pin-error-shake')), 500);
    pinDigits[0].focus();
  }
}

document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
  sessionStorage.removeItem('rewear_admin');
  adminDashboard.classList.add('hidden');
  adminGate.classList.remove('hidden');
  pinDigits.forEach(d => d.value = '');
  pinDigits[0].focus();
});

// ---- CLOCK ----
function startClock() {
  const el = document.getElementById('adminClock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString(); };
  tick(); setInterval(tick, 1000);
}

// ---- TAB SWITCHING ----
document.querySelectorAll('.dash-nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll('.dash-nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    link.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    document.getElementById('dashPageTitle').textContent = link.textContent.trim();
    if (tab === 'sellers')      loadSellers();
    if (tab === 'fees')         loadListingFees();
    if (tab === 'payments')     loadPaymentVerifications();
    if (tab === 'listings')     loadListings();
    if (tab === 'transactions') loadTransactions();
    if (tab === 'orders')       loadOrders();
    if (tab === 'users')        loadUsers();
    if (tab === 'messaging')    loadAdminMessaging();
    if (tab === 'reports')      initReports();
  });
});

// ---- UTILITY FUNCTIONS ----

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Compute the commission rate for a transaction.
 * @param {number} gross_amount - The full sale price paid by the buyer (PHP).
 * @param {string} seller_tier  - The seller's listing fee tier: 'basic' | 'standard' | 'premium'.
 * @returns {number} Commission rate as a decimal, e.g. 0.10 for 10%.
 */
function computeCommissionRate(gross_amount, seller_tier) {
  const base_rate = seller_tier === 'premium' ? 0.08 : 0.10;

  if (gross_amount > 1000) {
    return Math.min(base_rate, 0.06);
  } else if (gross_amount > 500) {
    return Math.min(base_rate, 0.08);
  } else {
    return base_rate;
  }
}

// ---- OVERVIEW STATS ----

async function loadOverviewStats() {
  const hasAppTable = await checkSellerApplicationsTable();

  // Run queries individually so one failure doesn't block the rest
  const [
    pendingListingsRes,
    totalOrdersRes,
    pendingFeesRes,
    pendingPayoutsRes
  ] = await Promise.all([
    db.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('orders').select('*', { count: 'exact', head: true }),
    db.from('listing_fees').select('*', { count: 'exact', head: true }).eq('status', 'proof_submitted'),
    db.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  ]);

  // Pending sellers count
  let pendingSellers = 0;
  if (hasAppTable) {
    const { count } = await db.from('seller_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    pendingSellers = count ?? 0;
  } else {
    const { data: allSellers } = await db.from('sellers').select('verified, rejection_reason');
    pendingSellers = (allSellers || []).filter(s => !s.verified && !s.rejection_reason).length;
  }
  // Count pending payments client-side — only select columns that definitely exist
  const { data: allOrders } = await db.from('orders').select('id, status, buyer_name, total_price');
  const pendingPayments = (allOrders || []).filter(o => o.status === 'pending').length;

  const el = id => document.getElementById(id);
  if (el('statPendingSellers'))  el('statPendingSellers').textContent  = pendingSellers           ?? 0;
  if (el('statPendingListings')) el('statPendingListings').textContent = pendingListingsRes.count ?? 0;
  if (el('statTotalOrders'))     el('statTotalOrders').textContent     = totalOrdersRes.count     ?? 0;
  if (el('statPendingPayments')) el('statPendingPayments').textContent = pendingPayments          ?? 0;
  if (el('statPendingFees'))     el('statPendingFees').textContent     = pendingFeesRes.count     ?? 0;
  if (el('statPendingPayouts'))  el('statPendingPayouts').textContent  = pendingPayoutsRes.count  ?? 0;

  // Attention list — fetch details
  const [pendingListingListRes, pendingFeeListRes] = await Promise.all([
    db.from('products').select('id,name,price').eq('status', 'pending').limit(3),
    db.from('listing_fees').select('id,tier,amount_paid,sellers(business_name)').eq('status', 'proof_submitted').limit(3)
  ]);

  // Pending seller list
  let pendingSellerList = [];
  if (hasAppTable) {
    const { data } = await db.from('seller_applications').select('id,business_name,email,user_id').eq('status', 'pending').limit(3);
    pendingSellerList = data || [];
  } else {
    const { data: fallback } = await db.from('sellers').select('id,business_name,email,user_id,verified,rejection_reason');
    pendingSellerList = (fallback || [])
      .filter(s => !s.verified && !s.rejection_reason)
      .slice(0, 3)
      .map(s => ({ ...s, user_id: s.user_id || s.id }));
  }

  // Pending payments from already-fetched allOrders
  const pendingPaymentList = (allOrders || []).filter(o => o.status === 'pending').slice(0, 3);

  const attentionList = document.getElementById('attentionList');
  const items = [
    ...(pendingSellerList || []).map(s => `
      <div class="admin-attention-row">
        <span class="dash-badge dash-badge-pending">Seller</span>
        <span class="admin-attention-name">${s.business_name}</span>
        <span class="admin-attention-meta">${s.email}</span>
        <button class="admin-btn admin-btn-approve" onclick="approveSellerApplication('${s.id}', '${s.user_id}', '${escapeHtml(s.business_name)}', '${escapeHtml(s.email)}')">Approve</button>
        <button class="admin-btn admin-btn-reject"  onclick="rejectSellerApplication('${s.id}')">Reject</button>
      </div>`),
    ...(pendingFeeListRes.data || []).map(f => `
      <div class="admin-attention-row">
        <span class="dash-badge" style="background:#cce5ff;color:#004085;">Fee</span>
        <span class="admin-attention-name">${f.sellers?.business_name || '—'}</span>
        <span class="admin-attention-meta">${f.tier} · ₱${parseFloat(f.amount_paid).toFixed(2)}</span>
        <button class="admin-btn admin-btn-approve" onclick="adminVerifyFee('${f.id}')">Activate</button>
        <button class="admin-btn admin-btn-reject"  onclick="adminRejectFee('${f.id}')">Reject</button>
      </div>`),
    ...(pendingPaymentList || []).map(o => `
      <div class="admin-attention-row">
        <span class="dash-badge" style="background:#fff3cd;color:#856404;">Payment</span>
        <span class="admin-attention-name">${o.buyer_name || 'Order'}</span>
        <span class="admin-attention-meta">₱${parseFloat(o.total_price || 0).toFixed(2)}</span>
        <button class="admin-btn admin-btn-approve" onclick="adminVerifyPayment('${o.id}', true)">Verify</button>
        <button class="admin-btn admin-btn-reject"  onclick="adminRejectPayment('${o.id}')">Reject</button>
      </div>`),
    ...(pendingListingListRes.data || []).map(p => `
      <div class="admin-attention-row">
        <span class="dash-badge" style="background:rgba(17,17,17,0.1);color:#555">Listing</span>
        <span class="admin-attention-name">${p.name}</span>
        <span class="admin-attention-meta">₱${parseFloat(p.price).toFixed(2)}</span>
        <button class="admin-btn admin-btn-approve" onclick="approveListing('${p.id}')">Approve</button>
        <button class="admin-btn admin-btn-reject"  onclick="promptRejectListing('${p.id}')">Reject</button>
      </div>`)
  ];

  attentionList.innerHTML = items.length
    ? items.join('')
    : '<p class="dash-empty">Nothing needs attention right now. ✅</p>';
}
// ---- SELLERS TAB ----
async function loadSellers() {
  const list = document.getElementById('sellersList');
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  const statusFilter = document.getElementById('sellerStatusFilter')?.value || 'all';  // Changed default to 'all'
  const search = document.getElementById('sellerSearch')?.value.toLowerCase() || '';

  console.log('[admin] loadSellers called, filter:', statusFilter);

  // Try seller_applications first; fall back to sellers table if it doesn't exist yet
  let data, error;
  let usingFallback = false;

  const hasAppTable = await checkSellerApplicationsTable();
  console.log('[admin] seller_applications table exists:', hasAppTable);

  if (hasAppTable) {
    let query = db.from('seller_applications').select('*').order('submitted_at', { ascending: false });
    if (statusFilter === 'approved') query = query.eq('status', 'approved');
    if (statusFilter === 'rejected') query = query.eq('status', 'rejected');
    if (statusFilter === 'pending')  query = query.eq('status', 'pending');
    ({ data, error } = await query);
    console.log('[admin] seller_applications query result:', { dataCount: data?.length, error: error?.message });
  }

  if (!hasAppTable || error) {
    if (error) console.warn('[admin] seller_applications not available, falling back to sellers table:', error.message);
    usingFallback = true;

    console.log('[admin] Querying sellers table...');
    const fallback = await db.from('sellers').select('id, business_name, email, phone, verified, rejection_reason, created_at, description').order('created_at', { ascending: false });
    
    console.log('[admin] sellers query result:', { 
      dataCount: fallback.data?.length, 
      error: fallback.error?.message,
      errorCode: fallback.error?.code,
      errorDetails: fallback.error?.details
    });
    
    if (fallback.error) {
      // Check if it's a CORS/RLS error
      if (fallback.error.message?.includes('CORS') || fallback.error.code === '42501') {
        list.innerHTML = `
          <div class="dash-empty" style="padding:40px 20px;text-align:center;">
            <h3 style="color:#e74c3c;margin:0 0 12px;">Database Access Error</h3>
            <p style="margin:0 0 8px;color:#666;">The admin panel cannot access the sellers table due to Row Level Security (RLS) policies.</p>
            <p style="margin:0 0 16px;color:#666;font-size:14px;">Please configure RLS policies in Supabase to allow admin access.</p>
            <details style="text-align:left;max-width:600px;margin:0 auto;background:#f8f9fa;padding:12px;border-radius:8px;">
              <summary style="cursor:pointer;font-weight:600;margin-bottom:8px;">Show SQL Fix</summary>
              <pre style="background:#fff;padding:12px;border-radius:4px;overflow-x:auto;font-size:12px;">-- Run this in Supabase SQL Editor:
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for admin panel)
CREATE POLICY "Allow public read access to sellers"
ON sellers FOR SELECT
TO public
USING (true);

-- Allow public insert (for seller signup)
CREATE POLICY "Allow public insert to sellers"
ON sellers FOR INSERT
TO public
WITH CHECK (true);

-- Allow public update (for admin approval)
CREATE POLICY "Allow public update to sellers"
ON sellers FOR UPDATE
TO public
USING (true);</pre>
            </details>
          </div>`;
      } else {
        list.innerHTML = `<p class="dash-empty">Could not load seller data. Error: ${fallback.error.message}</p>`;
      }
      console.error('[admin] loadSellers fallback error:', fallback.error);
      return;
    }

    // Normalize sellers rows to look like seller_applications rows
    data = (fallback.data || []).map(s => ({
      ...s,
      user_id: s.user_id || s.id,
      submitted_at: s.created_at,
      business_description: s.description,
      status: s.verified ? 'approved' : (s.rejection_reason ? 'rejected' : 'pending')
    }));
    
    // Log all statuses before filtering
    console.log('[admin] All sellers:', data.map(s => ({ email: s.email, status: s.status, verified: s.verified })));
    
    // Apply filter
    if (statusFilter !== 'all') {
      data = data.filter(s => s.status === statusFilter);
    }
    
    console.log('[admin] After filter:', { filter: statusFilter, count: data.length, statuses: data.map(d => d.status) });
  }

  const filtered = search ? data.filter(s => s.business_name?.toLowerCase().includes(search) || s.email?.toLowerCase().includes(search)) : data;

  list.innerHTML = filtered.length
    ? filtered.map(s => `
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 class="admin-card-title">${s.business_name}</h3>
              <p class="admin-card-meta">${s.email}${s.phone ? ` · ${s.phone}` : ''}</p>
              <p class="admin-card-meta">Applied: ${formatDate(s.submitted_at)}</p>
              ${s.business_description ? `<p class="admin-card-desc">${s.business_description}</p>` : ''}
              ${s.address ? `<p class="admin-card-meta">📍 ${s.address}</p>` : ''}
              ${s.years_in_business ? `<p class="admin-card-meta">Years in business: ${s.years_in_business}</p>` : ''}
            </div>
            <span class="dash-badge ${s.status === 'approved' ? 'dash-badge-verified' : s.status === 'rejected' ? 'dash-badge-rejected' : 'dash-badge-pending'}">${s.status}</span>
          </div>
          ${s.rejection_reason ? `<p class="admin-rejection-note">Rejected: ${s.rejection_reason}</p>` : ''}
          <div class="admin-card-actions">
            ${s.status === 'pending' ? `
              <button class="admin-btn admin-btn-approve" onclick="approveSellerApplication('${s.id}', '${s.user_id}', '${escapeHtml(s.business_name)}', '${escapeHtml(s.email)}')">✓ Approve Seller</button>
              <button class="admin-btn admin-btn-reject" onclick="rejectSellerApplication('${s.id}')">✕ Reject</button>
            ` : s.status === 'rejected' ? `
              <button class="admin-btn admin-btn-approve" onclick="approveSellerApplication('${s.id}', '${s.user_id}', '${escapeHtml(s.business_name)}', '${escapeHtml(s.email)}')">↺ Re-approve</button>
            ` : s.status === 'approved' ? `
              <button class="admin-btn admin-btn-reject" onclick="rejectSellerApplication('${s.id}')">Revoke Approval</button>
            ` : ''}
          </div>
        </div>`).join('')
    : '<p class="dash-empty">No seller applications found.</p>';
}

document.getElementById('sellerStatusFilter')?.addEventListener('change', loadSellers);
document.getElementById('sellerSearch')?.addEventListener('input', loadSellers);

// ---- APPROVE / REJECT SELLER APPLICATION ----
async function approveSellerApplication(applicationId, userId, businessName, email) {
  showConfirmModal({
    title: 'Approve Seller Application?',
    message: `This will approve ${businessName} (${email}) as a verified seller. They will be able to pay listing fees and publish products.`,
    confirmText: 'Approve',
    cancelText: 'Cancel',
    onConfirm: async () => {
      showLoadingModal('Approving Seller…', 'Creating seller record and updating application.');
      
      try {
        // Update seller application status (ignore error if table doesn't exist yet)
        const { error: appError } = await db.from('seller_applications').update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'admin'
        }).eq('id', applicationId);
        if (appError && !appError.message.includes('schema cache')) throw appError;
        
        // Create or update seller record — this is the critical step
        const { error: sellerError } = await db.from('sellers').upsert({
          id: userId,
          user_id: userId,
          business_name: businessName,
          email: email,
          verified: true,
          verified_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });
        
        if (sellerError) throw sellerError;
        
        // Non-critical: notifications & logs (ignore errors)
        await db.from('notifications').insert({
          user_id: userId,
          notification_type: 'seller_application_approved',
          title: 'Seller Application Approved!',
          message: `Your seller application for ${businessName} has been approved.`,
          data: { application_id: applicationId, business_name: businessName }
        }).then(() => {}).catch(() => {});
        
        hideLoadingModal();
        showSuccess('Seller Approved!', `${businessName} is now a verified seller.`, 'Got it');
        loadSellers();
        loadOverviewStats();
        
      } catch (error) {
        hideLoadingModal();
        showError('Update Failed', error.message);
        console.error('[admin] approveSellerApplication:', error.message);
      }
    }
  });
}

async function rejectSellerApplication(applicationId) {
  showConfirmModal({
    title: 'Reject Seller Application?',
    message: 'This will reject the seller application. You can provide a reason in the next step.',
    confirmText: 'Continue',
    cancelText: 'Cancel',
    isDangerous: true,
    onConfirm: async () => {
      const reason = prompt('Reason for rejection (will be shown to seller):');
      if (reason === null) return;
      
      showLoadingModal('Rejecting…', 'Updating application status.');
      
      try {
        // Try to get application details — fall back to using applicationId as userId
        let targetUserId = applicationId;
        let targetBusinessName = '';
        let targetEmail = '';

        const { data: application } = await db
          .from('seller_applications')
          .select('user_id, business_name, email')
          .eq('id', applicationId)
          .single();

        if (application) {
          targetUserId = application.user_id;
          targetBusinessName = application.business_name;
          targetEmail = application.email;
        } else {
          // Fallback: applicationId might actually be a seller id
          const { data: seller } = await db.from('sellers').select('id, user_id, business_name, email').eq('id', applicationId).single();
          if (seller) {
            targetUserId = seller.user_id || seller.id;
            targetBusinessName = seller.business_name;
            targetEmail = seller.email;
          }
        }
        
        // Update seller_applications if it exists
        await db.from('seller_applications').update({
          status: 'rejected',
          rejection_reason: reason || 'Application rejected.',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'admin'
        }).eq('id', applicationId).then(() => {}).catch(() => {});
        

        // Update seller record — this is the critical step
        await db.from('sellers').update({
          verified: false,
          rejection_reason: reason || 'Application rejected.'
        }).eq('id', targetUserId).then(() => {}).catch(() => {});

        // Also try by user_id column
        await db.from('sellers').update({
          verified: false,
          rejection_reason: reason || 'Application rejected.'
        }).eq('user_id', targetUserId).then(() => {}).catch(() => {});
        
        // Non-critical: notification (ignore errors)
        await db.from('notifications').insert({
          user_id: targetUserId,
          notification_type: 'seller_application_rejected',
          title: 'Seller Application Rejected',
          message: `Your seller application has been rejected. Reason: ${reason}`,
          data: { application_id: applicationId, rejection_reason: reason }
        }).then(() => {}).catch(() => {});
        
        hideLoadingModal();
        showSuccess('Seller Rejected', 'The seller has been notified with the rejection reason.', 'Got it');
        loadSellers();
        loadOverviewStats();
        
      } catch (error) {
        hideLoadingModal();
        showError('Update Failed', error.message);
        console.error('[admin] rejectSellerApplication:', error.message);
      }
    }
  });
}

// ---- LISTINGS TAB ----
async function loadListings() {
  const list = document.getElementById('listingsList');
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  const statusFilter = document.getElementById('listingStatusFilter')?.value || 'pending';
  const search = document.getElementById('listingSearch')?.value.toLowerCase() || '';

  let query = db.from('products').select('*').order('created_at', { ascending: false });
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  
  console.log('[admin] loadListings: Query result:', { 
    dataCount: data?.length || 0, 
    error: error?.message || null,
    statusFilter,
    sampleData: data?.slice(0, 2) || []
  });
  
  if (error) { list.innerHTML = '<p class="dash-empty">Could not load listings.</p>'; console.error('[admin] loadListings:', error.message); return; }

  const filtered = search ? data.filter(p => p.name?.toLowerCase().includes(search)) : data;

  list.innerHTML = filtered.length
    ? filtered.map(p => `
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-img-wrap">
              <img src="${p.image_url}" alt="${p.name}" class="admin-card-img">
            </div>
            <div style="flex:1">
              <h3 class="admin-card-title">${p.name}</h3>
              <p class="admin-card-meta">$${parseFloat(p.price).toFixed(2)} · ${p.category} · Sizes: ${(p.sizes||[]).join(', ')}</p>
              <p class="admin-card-meta">Added: ${formatDate(p.created_at)}</p>
              ${p.description ? `<p class="admin-card-desc">${p.description}</p>` : ''}
            </div>
            <span class="dash-badge ${p.status === 'approved' ? 'dash-badge-verified' : p.status === 'rejected' ? 'dash-badge-rejected' : 'dash-badge-pending'}">${p.status}</span>
          </div>
          ${p.rejection_reason ? `<p class="admin-rejection-note">Rejected: ${p.rejection_reason}</p>` : ''}
          <div class="admin-card-actions">
            ${p.status !== 'approved' ? `<button class="admin-btn admin-btn-approve" onclick="approveListing('${p.id}')">✓ Approve Listing</button>` : ''}
            ${p.status !== 'rejected' ? `<button class="admin-btn admin-btn-reject"  onclick="promptRejectListing('${p.id}')">✕ Reject</button>` : ''}
            ${p.status === 'approved' ? `<button class="admin-btn admin-btn-reject" onclick="removeListing('${p.id}', '${p.name.replace(/'/g,"\\'")}')">🗑 Remove</button>` : ''}
            ${p.status === 'rejected' ? `<button class="admin-btn admin-btn-approve" onclick="approveListing('${p.id}')">↺ Re-approve</button>` : ''}
          </div>
        </div>`).join('')
    : '<p class="dash-empty">No listings found.</p>';
}

document.getElementById('listingStatusFilter')?.addEventListener('change', loadListings);
document.getElementById('listingSearch')?.addEventListener('input', loadListings);

// ---- APPROVE / REJECT LISTING ----
async function approveListing(id) {
  console.log('[admin] approveListing: Starting approval for product ID:', id);
  showLoadingModal('Approving…', 'Making listing live in the shop.');
  
  try {
    // First, let's check the current product status
    const { data: currentProduct, error: fetchError } = await db
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('[admin] approveListing: Error fetching product:', fetchError);
      hideLoadingModal();
      showError('Update Failed', 'Could not find product to approve');
      return;
    }
    
    console.log('[admin] approveListing: Current product status:', {
      id: currentProduct.id,
      name: currentProduct.name,
      status: currentProduct.status,
      in_stock: currentProduct.in_stock,
      seller_id: currentProduct.seller_id
    });
    
    // Update the product with approved status and in_stock = true
    // CRITICAL: Both status='approved' AND in_stock=true are required for buyer visibility
    const updateData = { 
      status: 'approved', 
      in_stock: true, 
      rejection_reason: null
    };
    
    console.log('[admin] approveListing: Updating product with:', updateData);
    
    const { data: updatedRows, error } = await db
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select();
    
    hideLoadingModal();
    
    if (error) { 
      console.error('[admin] approveListing: Update error:', error);
      showError('Update Failed', error.message); 
      return; 
    }
    
    if (!updatedRows || updatedRows.length === 0) {
      console.error('[admin] approveListing: No rows were updated - product may not exist');
      showError('Update Failed', 'Product not found or could not be updated');
      return;
    }
    
    const updatedProduct = updatedRows[0];
    console.log('[admin] approveListing: Product successfully updated:', {
      id: updatedProduct.id,
      name: updatedProduct.name,
      status: updatedProduct.status,
      in_stock: updatedProduct.in_stock,
      approved_at: updatedProduct.approved_at,
      seller_id: updatedProduct.seller_id
    });
    
    // Double-check: Verify product is now visible to buyers using the same query buyers use
    const { data: buyerVisible, error: buyerError } = await db
      .from('products')
      .select('id, name, status, in_stock, seller_id')
      .eq('id', id)
      .eq('status', 'approved')
      .eq('in_stock', true)
      .single();
    
    if (!buyerError && buyerVisible) {
      console.log('[admin] approveListing: ✅ CONFIRMED: Product is now visible to buyers');
      console.log('[admin] approveListing: Buyer query result:', buyerVisible);

      // Update badge in-place immediately
      const card = document.querySelector(`[data-listing-id="${id}"]`);
      if (card) {
        const badge = card.querySelector('.status-badge, .dash-order-status');
        if (badge) {
          badge.className = 'status-badge status-approved';
          badge.textContent = 'APPROVED';
        }
      }

      showSuccess('Listing Approved!', `${updatedProduct.name} is now live in the shop and visible to all buyers.`, 'Got it');
    } else {
      console.error('[admin] approveListing: ❌ CRITICAL: Product is NOT visible to buyers');
      console.error('[admin] approveListing: Buyer query error:', buyerError);
      console.error('[admin] approveListing: This means the buyer queries in shop.js/script.js may have additional filters');
      showError('Approval Issue', 'Product was approved but may not be visible to buyers. Please check the shop page.');
    }
    
    loadListings();
    loadOverviewStats();
    
  } catch (error) {
    hideLoadingModal();
    console.error('[admin] approveListing: Exception:', error);
    showError('Update Failed', 'An unexpected error occurred during approval');
  }
}

async function promptRejectListing(id) {
  showConfirmModal({
    title: 'Reject Listing?',
    message: 'This will reject the product listing. You can provide a reason in the next step.',
    confirmText: 'Continue',
    cancelText: 'Cancel',
    isDangerous: true,
    onConfirm: async () => {
      const reason = prompt('Reason for rejection (will be shown to seller):');
      if (reason === null) return;
      showLoadingModal('Rejecting…', 'Updating listing status.');
      const { error } = await db.from('products').update({ status: 'rejected', in_stock: false, rejection_reason: reason || 'Listing rejected.' }).eq('id', id);
      hideLoadingModal();
      if (error) { showError('Update Failed', error.message); return; }
      showSuccess('Listing Rejected', 'The seller will see the rejection reason.', 'Got it');
      loadListings();
      loadOverviewStats();
    }
  });
}

// ---- PAYMENT VERIFICATION TAB ----
async function loadPaymentVerifications() {
  const list = document.getElementById('paymentsList');
  if (!list) return;
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  const statusFilter = document.getElementById('paymentStatusFilter')?.value || 'submitted';

  // Query orders — avoid filtering on payment_status if column doesn't exist yet
  let query = db.from('orders')
    .select('*, products(name, image_url, category, seller_id)')
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    list.innerHTML = '<p class="dash-empty">Could not load orders.</p>';
    console.error('[admin] loadPaymentVerifications:', error.message);
    return;
  }

  if (!data?.length) {
    list.innerHTML = '<p class="dash-empty">No orders found.</p>';
    return;
  }

  // Filter client-side (handles both old schema without payment_status and new schema)
  const filtered = data.filter(o => {
    const ps = o.payment_status || 'pending';
    if (statusFilter === 'submitted') return ps === 'submitted' || o.status === 'pending';
    if (statusFilter === 'verified')  return ps === 'verified'  || o.status === 'confirmed';
    if (statusFilter === 'rejected')  return ps === 'rejected'  || o.status === 'cancelled';
    return true;
  });

  // Fetch seller info separately for orders that have a seller_id
  const sellerIds = [...new Set(filtered.map(o => o.seller_id || o.products?.seller_id).filter(Boolean))];
  let sellerMap = {};
  if (sellerIds.length) {
    // Try with gcash columns first; fall back to basic columns if they don't exist
    let sellersRes = await db.from('sellers').select('id, business_name, gcash_number, gcash_name, phone').in('id', sellerIds);
    if (sellersRes.error) {
      sellersRes = await db.from('sellers').select('id, business_name, phone').in('id', sellerIds);
    }
    (sellersRes.data || []).forEach(s => { sellerMap[s.id] = s; });
  }

  // Attach seller to each order
  const enriched = filtered.map(o => ({
    ...o,
    _seller: sellerMap[o.seller_id] || sellerMap[o.products?.seller_id] || null
  }));

  list.innerHTML = enriched.map(o => paymentVerificationHTML(o)).join('');
}

function paymentVerificationHTML(order) {
  const product = order.products;
  const seller  = order._seller;  // attached by loadPaymentVerifications
  const date    = new Date(order.created_at);
  const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

  // Determine effective payment status
  const pStatus = order.payment_status || (order.status === 'confirmed' ? 'verified' : order.status === 'cancelled' ? 'rejected' : 'pending');
  const isPending = pStatus === 'pending' || pStatus === 'submitted';

  const pBadge = {
    pending:   '<span class="dash-badge dash-badge-pending">Awaiting Payment</span>',
    submitted: '<span class="dash-badge" style="background:#cce5ff;color:#004085;">📤 Proof Submitted</span>',
    verified:  '<span class="dash-badge dash-badge-verified">✅ Verified</span>',
    rejected:  '<span class="dash-badge dash-badge-rejected">❌ Rejected</span>'
  }[pStatus] || `<span class="dash-badge dash-badge-pending">${order.status}</span>`;

  // Extra info from localStorage fallback
  const extra = JSON.parse(localStorage.getItem(`rewear_order_extra_${order.id}`) || '{}');
  const deliveryAddress = order.delivery_address || extra.delivery_address || '—';
  const buyerPhone      = order.buyer_phone      || extra.buyer_phone      || '—';
  const paymentRef      = order.payment_reference || extra.payment_reference || '—';
  const proofUrl        = order.payment_proof_url || null;

  return `
    <div class="admin-card" data-order-id="${order.id}" style="border-left: 4px solid ${isPending ? '#c8a96e' : pStatus === 'verified' ? '#27ae60' : '#e74c3c'};">
      <div class="admin-card-header">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
            <h3 class="admin-card-title" style="margin:0;">${order.buyer_name}</h3>
            ${pBadge}
          </div>
          <p class="admin-card-meta">📧 ${order.buyer_email} ${buyerPhone !== '—' ? '· 📞 ' + buyerPhone : ''}</p>
          <p class="admin-card-meta">📍 ${deliveryAddress}</p>
          <p class="admin-card-meta">🛍 ${product?.name || 'Product'} · Size: ${order.size_selected || '—'} · Qty: ${order.quantity || 1}</p>
          <p class="admin-card-meta">💰 <strong>₱${parseFloat(order.total_price || 0).toFixed(2)}</strong> · Ref: <strong>${paymentRef}</strong></p>
          <p class="admin-card-meta">🏪 Seller: ${seller?.business_name || '—'}${seller?.gcash_number ? ' · GCash: ' + seller.gcash_number : ''}</p>
          <p class="admin-card-meta">🕐 ${dateStr}</p>
          ${order.payment_rejected_reason ? `<p class="admin-card-meta" style="color:#e74c3c;">Rejection reason: ${order.payment_rejected_reason}</p>` : ''}
        </div>
      </div>

      ${proofUrl ? `
      <div style="margin:12px 0;">
        <p style="font-size:13px;font-weight:600;margin-bottom:6px;">Payment Proof:</p>
        <img src="${proofUrl}" alt="Payment Proof"
          style="max-width:280px;max-height:200px;border-radius:8px;border:1px solid #eee;cursor:pointer;"
          onclick="window.open('${proofUrl}','_blank')">
      </div>` : `
      <div style="margin:12px 0;padding:10px;background:#fff8e1;border-radius:8px;font-size:13px;color:#856404;">
        ⚠️ No payment proof image uploaded yet.
      </div>`}

      <div class="admin-card-actions">
        ${isPending ? `
          <button class="admin-btn admin-btn-approve" onclick="adminVerifyPayment('${order.id}', true)">✅ Verify Payment</button>
          <button class="admin-btn admin-btn-reject" onclick="adminRejectPayment('${order.id}')">❌ Reject Payment</button>
        ` : `<span style="color:#888;font-size:13px;">Processed · ${pStatus.toUpperCase()}</span>`}
      </div>
    </div>`;
}

async function adminVerifyPayment(orderId, approve) {
  showLoadingModal('Verifying Payment…', 'Updating order status...');
  try {
    // Try with payment_status column first
    let error;
    ({ error } = await db.from('orders').update({
      payment_status: 'verified',
      status: 'confirmed'
    }).eq('id', orderId));

    if (error?.message?.includes('payment_status')) {
      // Column doesn't exist yet — just update status
      ({ error } = await db.from('orders').update({ status: 'confirmed' }).eq('id', orderId));
    }
    if (error) throw error;

    hideLoadingModal();
    showSuccess('Payment Verified!', 'Order confirmed. Seller will now prepare the item.', 'Got it');
    loadPaymentVerifications();
    loadOverviewStats();
  } catch (err) {
    hideLoadingModal();
    showError('Update Failed', err.message);
  }
}

async function adminRejectPayment(orderId) {
  const reason = prompt('Reason for rejection (shown to buyer):');
  if (reason === null) return; // cancelled

  showLoadingModal('Rejecting Payment…', 'Updating order status...');
  try {
    let error;
    ({ error } = await db.from('orders').update({
      payment_status: 'rejected',
      payment_rejected_reason: reason || 'Payment could not be verified.',
      status: 'cancelled'
    }).eq('id', orderId));

    if (error?.message?.includes('payment_status') || error?.message?.includes('payment_rejected_reason')) {
      ({ error } = await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId));
    }
    if (error) throw error;

    hideLoadingModal();
    showSuccess('Payment Rejected', 'Order cancelled. Buyer has been notified.', 'Got it');
    loadPaymentVerifications();
    loadOverviewStats();
  } catch (err) {
    hideLoadingModal();
    showError('Update Failed', err.message);
  }
}

document.getElementById('paymentStatusFilter')?.addEventListener('change', loadPaymentVerifications);

// ---- ORDERS TAB ---- (see full implementation at line ~1421)

document.addEventListener('change', function(e) {
  if (e.target.classList.contains('admin-order-status-select')) {
    var orderId = e.target.dataset.orderId;
    var status = e.target.value;
    if (orderId && status) updateOrderStatus(orderId, status);
  }
});

async function updateOrderStatus(id, status) {
  if (!status) return;

  // Update the order status first
  const { error } = await db.from('orders').update({ status }).eq('id', id);
  if (error) { showError('Update Failed', error.message); return; }

  // Update badge in-place immediately
  const orderRow = document.querySelector(`[data-order-id="${id}"]`);
  if (orderRow) {
    const badge = orderRow.querySelector('.dash-order-status, .status-badge');
    if (badge) {
      badge.className = `dash-order-status status-${status.replace(/_/g, '-')}`;
      badge.textContent = status.replace(/_/g, ' ').toUpperCase();
    }
  }

  if (status === 'confirmed') {
    showLoadingModal('Creating Transaction…', 'Calculating commission and recording transaction.');
    const { error: txnErr } = await createTransaction(id);
    if (txnErr) {
      console.error('[admin] updateOrderStatus: createTransaction failed:', txnErr.message);
    }
    hideLoadingModal();
    showSuccess('Order Updated', `Status changed to ${status}.`, 'Got it');

  } else if (status === 'delivered') {
    showLoadingModal('Releasing Payout…', 'Recording commission earnings and releasing seller payout.');
    const { data: orderRow, error: fetchErr } = await db
      .from('orders')
      .select('transaction_id')
      .eq('id', id)
      .single();

    if (!fetchErr && orderRow?.transaction_id) {
      const { error: releaseErr } = await releaseTransaction(orderRow.transaction_id);
      if (releaseErr) {
        console.error('[admin] updateOrderStatus: releaseTransaction failed:', releaseErr.message);
      }
    }
    hideLoadingModal();
    showSuccess('Order Updated', `Status changed to ${status}.`, 'Got it');

  } else {
    showSuccess('Order Updated', `Status changed to ${status}.`, 'Got it');
  }

  loadOrders();
}

// ---- TRANSACTION MANAGEMENT ----

/**
 * Create a transaction record when an order is confirmed.
 * Idempotent: if the order already has a transaction_id, returns the existing transaction.
 *
 * @param {string} order_id - UUID of the confirmed order
 * @returns {{ data: object|null, error: Error|null }}
 */
async function createTransaction(order_id) {
  // Step 1: Check for existing transaction (idempotent guard)
  const { data: existingOrder, error: existingOrderErr } = await db
    .from('orders')
    .select('transaction_id')
    .eq('id', order_id)
    .single();

  if (existingOrderErr) {
    return { data: null, error: existingOrderErr };
  }

  if (existingOrder?.transaction_id) {
    const { data: existingTxn, error: existingTxnErr } = await db
      .from('transactions')
      .select('*')
      .eq('id', existingOrder.transaction_id)
      .single();
    return { data: existingTxn ?? null, error: existingTxnErr ?? null };
  }

  // Step 2: Fetch order with product join
  const { data: order, error: orderErr } = await db
    .from('orders')
    .select('*, products(seller_id, price)')
    .eq('id', order_id)
    .single();

  if (orderErr || !order) {
    return { data: null, error: new Error('Order not found') };
  }

  // Step 3: Extract seller_id and gross amount
  const seller_id = order.products?.seller_id;
  const gross = parseFloat(order.total_price);

  // Step 4: Fetch seller's active listing fee tier (fallback to 'basic')
  const { data: feeRecord } = await db
    .from('listing_fees')
    .select('tier')
    .eq('seller_id', seller_id)
    .eq('status', 'active')
    .limit(1)
    .single();

  const tier = feeRecord?.tier ?? 'basic';

  // Step 5: Compute commission
  const rate = computeCommissionRate(gross, tier);
  const commission = Math.round(gross * rate * 100) / 100;
  const payout = gross - commission;

  // Step 6: INSERT transaction
  const { data: transaction, error: insertErr } = await db
    .from('transactions')
    .insert({
      order_id,
      seller_id,
      gross_amount: gross,
      commission_rate: rate,
      commission_amount: commission,
      seller_payout: payout,
      status: 'pending'
    })
    .select()
    .single();

  if (insertErr) {
    return { data: null, error: insertErr };
  }

  // Step 7: UPDATE orders with transaction_id
  const { error: updateErr } = await db
    .from('orders')
    .update({ transaction_id: transaction.id })
    .eq('id', order_id);

  if (updateErr) {
    console.error('[admin] createTransaction: failed to link transaction to order:', updateErr.message);
  }

  return { data: transaction, error: null };
}

/**
 * Release a pending transaction payout and record the commission as platform earnings.
 *
 * @param {string} transaction_id - UUID of the transaction to release
 * @returns {{ error: Error|null }}
 */
async function releaseTransaction(transaction_id) {
  // Step 1: Fetch the transaction
  const { data: txn, error: fetchErr } = await db
    .from('transactions')
    .select('*')
    .eq('id', transaction_id)
    .single();

  if (fetchErr || !txn) {
    return { error: fetchErr ?? new Error('Transaction not found') };
  }

  // Step 2: Guard — must be in pending state
  if (txn.status !== 'pending') {
    return { error: new Error('Transaction is not in pending state') };
  }

  // Step 3: UPDATE transaction to released
  const { error: updateErr } = await db
    .from('transactions')
    .update({
      status: 'released',
      released_at: new Date().toISOString()
    })
    .eq('id', transaction_id);

  if (updateErr) {
    return { error: updateErr };
  }

  // Step 4: INSERT commission earnings row
  const { error: earningsErr } = await db
    .from('earnings')
    .insert({
      source: 'commission',
      reference_id: transaction_id,
      amount: txn.commission_amount
    });

  if (earningsErr) {
    return { error: earningsErr };
  }

  return { error: null };
}

/**
 * Manually mark a listing fee as paid (for cash/GCash payments outside the platform).
 * Updates the fee status to 'active' and records the amount as platform earnings.
 *
 * @param {string} fee_id        - UUID of the listing fee to mark as paid
 * @param {string} payment_method - Payment method: 'gcash' | 'cash' | 'bank_transfer' | 'manual'
 * @param {string} payment_ref   - Reference number or note for the payment
 * @returns {{ error: Error|null }}
 */
async function markFeePaid(fee_id, payment_method, payment_ref) {
  // Step 1: Fetch the fee record
  const { data: fee, error: fetchErr } = await db
    .from('listing_fees')
    .select('*')
    .eq('id', fee_id)
    .single();

  if (fetchErr || !fee) {
    return { error: fetchErr ?? new Error('Listing fee not found') };
  }

  // Step 2: UPDATE fee to active with payment details
  const { error: updateErr } = await db
    .from('listing_fees')
    .update({
      status: 'active',
      payment_method,
      payment_ref
    })
    .eq('id', fee_id);

  if (updateErr) {
    return { error: updateErr };
  }

  // Step 3: INSERT listing fee earnings row
  const { error: earningsErr } = await db
    .from('earnings')
    .insert({
      source: 'listing_fee',
      reference_id: fee_id,
      amount: fee.amount_paid
    });

  if (earningsErr) {
    return { error: earningsErr };
  }

  return { error: null };
}

// ---- ADMIN LIST LOADERS ----

/**
 * Load all listing fee payments and render them to #feesList.
 */
async function loadListingFees() {
  const list = document.getElementById('feesList');
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  const { data, error } = await db
    .from('listing_fees')
    .select('*, sellers(business_name, email)')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = '<p class="dash-empty">Could not load fees.</p>';
    console.error('[admin] loadListingFees:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<p class="dash-empty">No listing fees found.</p>';
    return;
  }

  list.innerHTML = data.map(fee => {
    const tierLabel = fee.tier ? fee.tier.charAt(0).toUpperCase() + fee.tier.slice(1) : '—';

    // Determine effective status
    const isPendingVerification = fee.status === 'proof_submitted';
    const isActive = fee.status === 'active';
    const isRejected = fee.status === 'rejected';
    const isExpired = fee.status === 'expired';

    const badge = isActive
      ? '<span class="dash-badge dash-badge-verified">✅ Active</span>'
      : isPendingVerification
        ? '<span class="dash-badge" style="background:#cce5ff;color:#004085;">📤 Proof Submitted</span>'
        : isRejected
          ? '<span class="dash-badge dash-badge-rejected">❌ Rejected</span>'
          : isExpired
            ? '<span class="dash-badge" style="background:#f8f9fa;color:#6c757d;">Expired</span>'
            : '<span class="dash-badge dash-badge-pending">⏳ Pending</span>';

    // Get proof from DB or localStorage fallback
    const proofUrl = fee.proof_url || localStorage.getItem(`rewear_fee_proof_${fee.seller_id}_${fee.payment_ref}`) || null;

    return `
      <div class="admin-card" style="border-left:4px solid ${isActive?'#27ae60':isPendingVerification?'#c8a96e':isRejected?'#e74c3c':'#ddd'};">
        <div class="admin-card-header">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
              <h3 class="admin-card-title" style="margin:0;">${fee.sellers?.business_name ?? '—'}</h3>
              ${badge}
            </div>
            <p class="admin-card-meta">📧 ${fee.sellers?.email ?? '—'}</p>
            <p class="admin-card-meta">Tier: <strong>${tierLabel}</strong> · Amount: <strong>${formatPHP(fee.amount_paid)}</strong> · Slots: ${fee.listings_used || 0}/${fee.max_listings}</p>
            <p class="admin-card-meta">Ref: ${fee.payment_ref || '—'} · ${formatDate(fee.created_at)}</p>
            ${fee.expires_at ? `<p class="admin-card-meta">Expires: ${formatDate(fee.expires_at)}</p>` : ''}
            ${fee.rejection_reason ? `<p class="admin-card-meta" style="color:#e74c3c;">Rejection: ${fee.rejection_reason}</p>` : ''}
          </div>
        </div>

        ${proofUrl ? `
        <div style="margin:12px 0;">
          <p style="font-size:13px;font-weight:600;margin-bottom:6px;">Payment Proof:</p>
          <img src="${proofUrl}" alt="Fee Proof"
            style="max-width:260px;max-height:180px;border-radius:8px;border:1px solid #eee;cursor:pointer;"
            onclick="window.open('${proofUrl}','_blank')">
        </div>` : `
        <div style="margin:12px 0;padding:10px;background:#fff8e1;border-radius:8px;font-size:13px;color:#856404;">
          ⚠️ No payment proof uploaded yet.
        </div>`}

        <div class="admin-card-actions">
          ${isPendingVerification ? `
            <button class="admin-btn admin-btn-approve" onclick="adminVerifyFee('${fee.id}')">✅ Activate Listing Fee</button>
            <button class="admin-btn admin-btn-reject"  onclick="adminRejectFee('${fee.id}')">❌ Reject</button>
          ` : isActive ? `
            <span style="color:#27ae60;font-size:13px;font-weight:600;">✅ Active — ${fee.max_listings - (fee.listings_used || 0)} slots remaining</span>
          ` : isRejected ? `
            <button class="admin-btn admin-btn-approve" onclick="adminVerifyFee('${fee.id}')">↺ Re-activate</button>
          ` : ''}
        </div>
      </div>`;
  }).join('');
}

async function adminVerifyFee(feeId) {
  showLoadingModal('Activating…', 'Activating listing fee and notifying seller.');
  try {
    const expires_at = new Date();
    // Get fee to determine days
    const { data: fee } = await db.from('listing_fees').select('tier, seller_id, amount_paid').eq('id', feeId).single();
    const days = fee?.tier === 'premium' ? 90 : fee?.tier === 'standard' ? 60 : 30;
    expires_at.setDate(expires_at.getDate() + days);

    const { error } = await db.from('listing_fees').update({
      status: 'active',
      verified_at: new Date().toISOString(),
      verified_by: 'admin',
      paid_at: new Date().toISOString(),
      expires_at: expires_at.toISOString()
    }).eq('id', feeId);

    if (error) throw error;

    // Record earnings
    await db.from('earnings').insert({
      source: 'listing_fee',
      reference_id: feeId,
      amount: fee?.amount_paid || 0
    });

    // Create notification for seller
    await db.from('notifications').insert({
      user_id: fee?.seller_id,
      notification_type: 'payment_verified',
      title: 'Listing Fee Activated!',
      message: 'Your listing fee payment has been verified. You can now publish listings.',
      data: {
        fee_id: feeId,
        tier: fee?.tier,
        expires_at: expires_at.toISOString()
      }
    });

    // Log activity
    await db.from('marketplace_activity_logs').insert({
      user_id: fee?.seller_id,
      user_type: 'seller',
      action_type: 'payment_verified',
      target_id: feeId,
      target_type: 'listing_fee',
      details: {
        tier: fee?.tier,
        amount: fee?.amount_paid
      }
    });

    hideLoadingModal();
    showSuccess('Fee Activated!', 'Seller can now publish listings.', 'Got it');
    loadListingFees();
    loadOverviewStats();
  } catch (err) {
    hideLoadingModal();
    showError('Error', err.message);
  }
}

async function adminRejectFee(feeId) {
  const reason = prompt('Reason for rejection:');
  if (reason === null) return;
  
  showLoadingModal('Rejecting…', 'Updating fee status.');
  try {
    // Get fee details first
    const { data: fee } = await db.from('listing_fees').select('seller_id, tier, amount_paid').eq('id', feeId).single();
    
    const { error } = await db.from('listing_fees').update({
      status: 'rejected',
      rejection_reason: reason || 'Payment could not be verified.'
    }).eq('id', feeId);
    
    if (error) throw error;

    // Create notification for seller
    await db.from('notifications').insert({
      user_id: fee?.seller_id,
      notification_type: 'payment_rejected',
      title: 'Listing Fee Rejected',
      message: `Your listing fee payment has been rejected. Reason: ${reason}`,
      data: {
        fee_id: feeId,
        tier: fee?.tier,
        rejection_reason: reason
      }
    });

    // Log activity
    await db.from('marketplace_activity_logs').insert({
      user_id: fee?.seller_id,
      user_type: 'seller',
      action_type: 'payment_rejected',
      target_id: feeId,
      target_type: 'listing_fee',
      details: {
        tier: fee?.tier,
        amount: fee?.amount_paid,
        rejection_reason: reason
      }
    });

    hideLoadingModal();
    showSuccess('Fee Rejected', 'Seller has been notified.', 'Got it');
    loadListingFees();
    loadOverviewStats();
  } catch (err) {
    hideLoadingModal();
    showError('Error', err.message);
  }
}

/**
 * Load admin earnings summary and render to #earningsSummary.
 */
async function loadAdminEarnings() {
  const summary = document.getElementById('earningsSummary');
  summary.innerHTML = '<p class="dash-empty">Loading…</p>';

  const { data, error } = await db.from('earnings').select('source, amount');

  if (error) {
    summary.innerHTML = '<p class="dash-empty">Could not load earnings.</p>';
    console.error('[admin] loadAdminEarnings:', error.message);
    return;
  }

  const rows = data || [];
  const totalFees        = rows.filter(e => e.source === 'listing_fee').reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalCommissions = rows.filter(e => e.source === 'commission').reduce((s, e) => s + parseFloat(e.amount), 0);
  const grandTotal       = totalFees + totalCommissions;

  summary.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;">
      <div class="admin-stat-card">
        <p class="admin-stat-label">Total Listing Fees</p>
        <p class="admin-stat-value">${formatPHP(totalFees)}</p>
      </div>
      <div class="admin-stat-card">
        <p class="admin-stat-label">Total Commissions</p>
        <p class="admin-stat-value">${formatPHP(totalCommissions)}</p>
      </div>
      <div class="admin-stat-card">
        <p class="admin-stat-label">Grand Total Revenue</p>
        <p class="admin-stat-value">${formatPHP(grandTotal)}</p>
      </div>
    </div>`;
}

// ---- INLINE ACTION WRAPPERS (called from onclick in rendered cards) ----

/**
 * Wrapper: mark a listing fee as paid, then refresh the fees list.
 */
async function adminMarkFeePaid(fee_id) {
  showLoadingModal('Marking as Paid…', 'Updating fee status.');
  const { error } = await markFeePaid(fee_id, 'manual', '');
  hideLoadingModal();
  if (error) { showError('Update Failed', error.message); console.error('[admin] adminMarkFeePaid:', error.message); return; }
  showSuccess('Fee Marked as Paid', 'The listing fee is now active.', 'Got it');
  loadListingFees();
}

/**
 * Wrapper: release a transaction payout, then refresh the transactions list.
 */
async function adminReleaseTransaction(transaction_id) {
  showLoadingModal('Releasing Payout…', 'Recording commission and releasing seller payout.');
  const { error } = await releaseTransaction(transaction_id);
  hideLoadingModal();
  if (error) { showError('Release Failed', error.message); console.error('[admin] adminReleaseTransaction:', error.message); return; }
  showSuccess('Payout Released', 'The seller payout has been released.', 'Got it');
  loadTransactions();
}

// Expose functions globally for inline onclick handlers
window.approveSellerApplication = approveSellerApplication;
window.rejectSellerApplication  = rejectSellerApplication;
window.approveListing          = approveListing;
window.promptRejectListing     = promptRejectListing;
window.removeListing           = removeListing;
window.updateOrderStatus       = updateOrderStatus;
window.createTransaction       = createTransaction;
window.releaseTransaction      = releaseTransaction;
window.markFeePaid             = markFeePaid;
window.loadListingFees         = loadListingFees;
window.loadTransactions        = loadTransactions;
window.loadAdminEarnings       = loadAdminEarnings;
window.adminMarkFeePaid        = adminMarkFeePaid;
window.adminReleaseTransaction = adminReleaseTransaction;
window.adminVerifyPayment      = adminVerifyPayment;
window.adminRejectPayment      = adminRejectPayment;
window.adminVerifyFee          = adminVerifyFee;
window.adminRejectFee          = adminRejectFee;
window.suspendUser             = suspendUser;
window.generateReport          = generateReport;

// ============================================================
// ADMIN FLOW — NEW FUNCTIONS
// ============================================================

// ---- REMOVE LISTING (Moderate) ----
async function removeListing(id, productName) {
  if (!confirm(`Remove "${productName}" from the shop? This will hide it from buyers.`)) return;
  showLoadingModal('Removing…', 'Taking listing offline.');
  const { error } = await db.from('products').update({
    status: 'rejected',
    in_stock: false,
    rejection_reason: 'Removed by admin.'
  }).eq('id', id);
  hideLoadingModal();
  if (error) { showError('Failed', error.message); return; }
  showSuccess('Listing Removed', `"${productName}" has been taken offline.`, 'Got it');
  loadListings();
  loadOverviewStats();
}

// ---- ORDERS TAB (with search) ----
async function loadOrders() {
  const list = document.getElementById('adminOrdersList');
  if (!list) return;
  list.innerHTML = '<p class="dash-empty">Loading...</p>';

  const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
  const search = document.getElementById('orderSearch')?.value.toLowerCase() || '';

  // Select only base columns + products join (sellers join requires seller_id column from 05_critical_fixes.sql)
  let query = db.from('orders')
    .select('id, product_id, buyer_name, buyer_email, size_selected, quantity, total_price, status, created_at, products(name, image_url, seller_id)')
    .order('created_at', { ascending: false });
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) { 
    console.error('[admin] loadOrders error:', error.message);
    list.innerHTML = '<p class="dash-empty">Could not load orders. Error: ' + error.message + '</p>'; 
    return; 
  }
  if (!data?.length) { list.innerHTML = '<p class="dash-empty">No orders found.</p>'; return; }

  // Fetch seller info separately if products have seller_id
  const sellerIds = [...new Set(data.map(o => o.products?.seller_id).filter(Boolean))];
  let sellerMap = {};
  if (sellerIds.length) {
    const { data: sellers } = await db.from('sellers').select('id, business_name');
    (sellers || []).forEach(s => { sellerMap[s.id] = s; });
  }

  const filtered = search
    ? data.filter(o => o.buyer_name?.toLowerCase().includes(search) || o.buyer_email?.toLowerCase().includes(search))
    : data;

  list.innerHTML = filtered.map(o => {
    const d = new Date(o.created_at);
    const dt = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    // Don't reference payment_status since column doesn't exist yet
    const pStatus = o.status === 'confirmed' ? 'verified' : 'pending';
    const pBadge = {
      pending:   '<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:12px;font-size:11px;">⏳ Awaiting</span>',
      verified:  '<span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:12px;font-size:11px;">✅ Verified</span>'
    }[pStatus] || '';
    
    const seller = sellerMap[o.products?.seller_id];

    return `
      <div class="dash-order-row" data-order-id="${o.id}">
        <div style="flex:1;">
          <p class="dash-order-name">${o.buyer_name || 'Unknown'}</p>
          <p class="dash-order-meta">${o.buyer_email || ''} · ${o.products?.name || '—'} · ₱${parseFloat(o.total_price||0).toFixed(2)}</p>
          <p class="dash-order-meta">Seller: ${seller?.business_name || '—'} · ${dt}</p>
          <div style="margin-top:4px;">${pBadge}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span class="dash-order-status status-${o.status.replace(/_/g,'-')}">${o.status.replace(/_/g,' ').toUpperCase()}</span>
          <select class="admin-order-status-select sort-select" data-order-id="${o.id}" style="padding:6px 12px;font-size:12px;">
            <option value="">Update status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('orderStatusFilter')?.addEventListener('change', loadOrders);
document.getElementById('orderSearch')?.addEventListener('input', loadOrders);

// ---- TRANSACTIONS TAB (with filter + search) ----
async function loadTransactions() {
  const list = document.getElementById('transactionsList');
  if (!list) return;
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  const statusFilter = document.getElementById('transactionStatusFilter')?.value || 'all';
  const search = document.getElementById('transactionSearch')?.value.toLowerCase() || '';

  let query = db.from('transactions')
    .select('*, orders(buyer_name, total_price), sellers(business_name)')
    .order('created_at', { ascending: false });
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) { list.innerHTML = '<p class="dash-empty">Could not load transactions.</p>'; return; }
  if (!data?.length) { list.innerHTML = '<p class="dash-empty">No transactions found.</p>'; return; }

  const filtered = search
    ? data.filter(t => t.sellers?.business_name?.toLowerCase().includes(search) || t.orders?.buyer_name?.toLowerCase().includes(search))
    : data;

  list.innerHTML = filtered.map(txn => {
    const ratePercent = txn.commission_rate != null ? `${Math.round(txn.commission_rate * 100)}%` : '—';
    const badge = txn.status === 'released'
      ? '<span class="dash-badge dash-badge-verified">Released</span>'
      : '<span class="dash-badge dash-badge-pending">Pending</span>';
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title">${txn.sellers?.business_name ?? '—'}</h3>
            <p class="admin-card-meta">Buyer: ${txn.orders?.buyer_name ?? '—'}</p>
            <p class="admin-card-meta">Gross: ${formatPHP(txn.gross_amount)} · Commission: ${formatPHP(txn.commission_amount)} (${ratePercent}) · Payout: <strong>${formatPHP(txn.seller_payout)}</strong></p>
            <p class="admin-card-meta">Created: ${formatDate(txn.created_at)}${txn.released_at ? ' · Released: ' + formatDate(txn.released_at) : ''}</p>
          </div>
          ${badge}
        </div>
        <div class="admin-card-actions">
          ${txn.status === 'pending' ? `<button class="admin-btn admin-btn-approve" onclick="adminReleaseTransaction('${txn.id}')">💸 Release Payout</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

document.getElementById('transactionStatusFilter')?.addEventListener('change', loadTransactions);
document.getElementById('transactionSearch')?.addEventListener('input', loadTransactions);

// ---- MANAGE USERS TAB ----
async function loadUsers() {
  const list = document.getElementById('usersList');
  if (!list) return;
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  const typeFilter = document.getElementById('userTypeFilter')?.value || 'all';
  const search = document.getElementById('userSearch')?.value.toLowerCase() || '';

  // Load from localStorage (local auth system)
  const users = JSON.parse(localStorage.getItem('rewear_users') || '[]');

  let filtered = users;
  if (typeFilter !== 'all') filtered = filtered.filter(u => u.accountType === typeFilter);
  if (search) filtered = filtered.filter(u =>
    u.name?.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search)
  );

  if (!filtered.length) {
    list.innerHTML = '<p class="dash-empty">No users found.</p>';
    return;
  }

  // Load seller verification status from DB
  const { data: sellers } = await db.from('sellers').select('id, verified, rejection_reason, business_name, email');
  const sellerMap = {};
  (sellers || []).forEach(s => { sellerMap[s.id] = s; });

  // Load seller applications status (only if table exists)
  const applicationMap = {};
  const hasAppTable = await checkSellerApplicationsTable();
  if (hasAppTable) {
    const { data: applications } = await db.from('seller_applications').select('user_id, status, rejection_reason');
    (applications || []).forEach(app => { applicationMap[app.user_id] = app; });
  }

  list.innerHTML = filtered.map(u => {
    const isSeller = u.accountType === 'seller';
    const sellerRecord = isSeller ? sellerMap[u.id] : null;
    const applicationRecord = isSeller ? applicationMap[u.id] : null;
    
    let statusBadge = '<span class="dash-badge" style="background:#e3f2fd;color:#0d47a1;">🛒 Buyer</span>';
    
    if (isSeller) {
      if (sellerRecord?.verified) {
        statusBadge = '<span class="dash-badge dash-badge-verified">✅ Verified Seller</span>';
      } else if (applicationRecord?.status === 'rejected') {
        statusBadge = '<span class="dash-badge dash-badge-rejected">❌ Rejected</span>';
      } else if (applicationRecord?.status === 'pending') {
        statusBadge = '<span class="dash-badge dash-badge-pending">⏳ Pending</span>';
      } else if (applicationRecord?.status === 'approved') {
        statusBadge = '<span class="dash-badge dash-badge-verified">✅ Approved</span>';
      } else {
        statusBadge = '<span class="dash-badge dash-badge-pending">⏳ Not Applied</span>';
      }
    }

    const suspended = u.suspended || false;
    const rejectionReason = sellerRecord?.rejection_reason || applicationRecord?.rejection_reason;

    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title">${u.name || '—'}</h3>
            <p class="admin-card-meta">📧 ${u.email}</p>
            <p class="admin-card-meta">Type: ${u.accountType} · Joined: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</p>
            ${sellerRecord?.business_name ? `<p class="admin-card-meta">Business: ${sellerRecord.business_name}</p>` : ''}
            ${rejectionReason ? `<p class="admin-card-meta" style="color:#e74c3c;">Rejection: ${rejectionReason}</p>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            ${statusBadge}
            ${suspended ? '<span class="dash-badge dash-badge-rejected">🚫 Suspended</span>' : ''}
          </div>
        </div>
        <div class="admin-card-actions">
          ${isSeller && !sellerRecord?.verified && applicationRecord?.status === 'pending' ? `
            <button class="admin-btn admin-btn-approve" onclick="approveSellerApplication('${applicationRecord.id}', '${u.id}', '${escapeHtml(sellerRecord?.business_name || u.name)}', '${escapeHtml(sellerRecord?.email || u.email)}')">✓ Approve Seller</button>
            <button class="admin-btn admin-btn-reject" onclick="rejectSellerApplication('${applicationRecord.id}')">✕ Reject</button>
          ` : ''}
          <button class="admin-btn ${suspended ? 'admin-btn-approve' : 'admin-btn-reject'}"
            onclick="suspendUser('${u.id}', ${!suspended})">
            ${suspended ? '✓ Unsuspend' : '🚫 Suspend'}
          </button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('userTypeFilter')?.addEventListener('change', loadUsers);
document.getElementById('userSearch')?.addEventListener('input', loadUsers);

async function suspendUser(userId, suspend) {
  const users = JSON.parse(localStorage.getItem('rewear_users') || '[]');
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) { showError('Not Found', 'User not found.'); return; }
  users[idx].suspended = suspend;
  localStorage.setItem('rewear_users', JSON.stringify(users));
  showSuccess(
    suspend ? 'User Suspended' : 'User Unsuspended',
    suspend ? 'The user has been suspended.' : 'The user has been reinstated.',
    'Got it'
  );
  loadUsers();
}

// ---- REPORTS TAB ----
function initReports() {
  const output = document.getElementById('reportOutput');
  if (output) output.innerHTML = '<p style="color:#888;font-size:14px;">Select a report type above to generate it.</p>';
}

async function generateReport(type) {
  const output = document.getElementById('reportOutput');
  if (!output) return;
  output.innerHTML = '<p style="color:#888;font-size:14px;">Generating report…</p>';

  try {
    if (type === 'revenue') {
      const { data: earnings } = await db.from('earnings').select('source, amount, recorded_at').order('recorded_at', { ascending: false });
      const rows = earnings || [];
      const totalFees = rows.filter(e => e.source === 'listing_fee').reduce((s, e) => s + parseFloat(e.amount), 0);
      const totalComm = rows.filter(e => e.source === 'commission').reduce((s, e) => s + parseFloat(e.amount), 0);

      output.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
          <div class="dash-stat-card"><p class="dash-stat-label">Listing Fees</p><h2 class="dash-stat-number">${formatPHP(totalFees)}</h2></div>
          <div class="dash-stat-card"><p class="dash-stat-label">Commissions</p><h2 class="dash-stat-number">${formatPHP(totalComm)}</h2></div>
          <div class="dash-stat-card"><p class="dash-stat-label">Total Revenue</p><h2 class="dash-stat-number">${formatPHP(totalFees + totalComm)}</h2></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:2px solid #e8d5b0;">
            <th style="padding:8px;text-align:left;">Date</th>
            <th style="padding:8px;text-align:left;">Source</th>
            <th style="padding:8px;text-align:right;">Amount</th>
          </tr></thead>
          <tbody>${rows.map(e => `
            <tr style="border-bottom:1px solid #f0e6d3;">
              <td style="padding:8px;">${new Date(e.recorded_at).toLocaleDateString()}</td>
              <td style="padding:8px;">${e.source === 'listing_fee' ? '💳 Listing Fee' : '💰 Commission'}</td>
              <td style="padding:8px;text-align:right;font-weight:600;">${formatPHP(e.amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <button onclick="exportCSV('revenue')" style="margin-top:16px;padding:10px 20px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">⬇ Export CSV</button>`;

    } else if (type === 'orders') {
      const { data: orders } = await db.from('orders').select('*, products(name)').order('created_at', { ascending: false });
      const rows = orders || [];
      const byStatus = {};
      rows.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

      output.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
          ${Object.entries(byStatus).map(([s, c]) => `
            <div class="dash-stat-card"><p class="dash-stat-label">${s.replace(/_/g,' ')}</p><h2 class="dash-stat-number">${c}</h2></div>`).join('')}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:2px solid #e8d5b0;">
            <th style="padding:8px;text-align:left;">Date</th>
            <th style="padding:8px;text-align:left;">Buyer</th>
            <th style="padding:8px;text-align:left;">Product</th>
            <th style="padding:8px;text-align:right;">Amount</th>
            <th style="padding:8px;text-align:left;">Status</th>
          </tr></thead>
          <tbody>${rows.map(o => `
            <tr style="border-bottom:1px solid #f0e6d3;">
              <td style="padding:8px;">${new Date(o.created_at).toLocaleDateString()}</td>
              <td style="padding:8px;">${o.buyer_name}</td>
              <td style="padding:8px;">${o.products?.name || '—'}</td>
              <td style="padding:8px;text-align:right;">${formatPHP(o.total_price)}</td>
              <td style="padding:8px;"><span class="dash-order-status status-${o.status}">${o.status}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <button onclick="exportCSV('orders')" style="margin-top:16px;padding:10px 20px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">⬇ Export CSV</button>`;

    } else if (type === 'sellers') {
      const { data: sellers } = await db.from('sellers').select('*').order('created_at', { ascending: false });
      const rows = sellers || [];
      output.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
          <div class="dash-stat-card"><p class="dash-stat-label">Total Sellers</p><h2 class="dash-stat-number">${rows.length}</h2></div>
          <div class="dash-stat-card"><p class="dash-stat-label">Verified</p><h2 class="dash-stat-number">${rows.filter(s=>s.verified).length}</h2></div>
          <div class="dash-stat-card"><p class="dash-stat-label">Pending</p><h2 class="dash-stat-number">${rows.filter(s=>!s.verified && !s.rejection_reason).length}</h2></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:2px solid #e8d5b0;">
            <th style="padding:8px;text-align:left;">Business</th>
            <th style="padding:8px;text-align:left;">Email</th>
            <th style="padding:8px;text-align:left;">Status</th>
            <th style="padding:8px;text-align:left;">Joined</th>
          </tr></thead>
          <tbody>${rows.map(s => `
            <tr style="border-bottom:1px solid #f0e6d3;">
              <td style="padding:8px;">${s.business_name}</td>
              <td style="padding:8px;">${s.email}</td>
              <td style="padding:8px;">${s.verified ? '✅ Verified' : s.rejection_reason ? '❌ Rejected' : '⏳ Pending'}</td>
              <td style="padding:8px;">${new Date(s.created_at).toLocaleDateString()}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <button onclick="exportCSV('sellers')" style="margin-top:16px;padding:10px 20px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">⬇ Export CSV</button>`;

    } else if (type === 'buyers') {
      const users = JSON.parse(localStorage.getItem('rewear_users') || '[]');
      const buyers = users.filter(u => u.accountType === 'buyer');
      const { data: orders } = await db.from('orders').select('buyer_email, total_price');
      const spendMap = {};
      (orders || []).forEach(o => {
        spendMap[o.buyer_email] = (spendMap[o.buyer_email] || 0) + parseFloat(o.total_price || 0);
      });

      output.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
          <div class="dash-stat-card"><p class="dash-stat-label">Total Buyers</p><h2 class="dash-stat-number">${buyers.length}</h2></div>
          <div class="dash-stat-card"><p class="dash-stat-label">Active Buyers</p><h2 class="dash-stat-number">${Object.keys(spendMap).length}</h2></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:2px solid #e8d5b0;">
            <th style="padding:8px;text-align:left;">Name</th>
            <th style="padding:8px;text-align:left;">Email</th>
            <th style="padding:8px;text-align:right;">Total Spent</th>
            <th style="padding:8px;text-align:left;">Joined</th>
          </tr></thead>
          <tbody>${buyers.map(u => `
            <tr style="border-bottom:1px solid #f0e6d3;">
              <td style="padding:8px;">${u.name || '—'}</td>
              <td style="padding:8px;">${u.email}</td>
              <td style="padding:8px;text-align:right;">${formatPHP(spendMap[u.email] || 0)}</td>
              <td style="padding:8px;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <button onclick="exportCSV('buyers')" style="margin-top:16px;padding:10px 20px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">⬇ Export CSV</button>`;
    }
  } catch (err) {
    output.innerHTML = `<p class="dash-empty">Could not generate report: ${err.message}</p>`;
  }
}

// ---- CSV EXPORT ----
window.exportCSV = async function(type) {
  const output = document.getElementById('reportOutput');
  const table = output?.querySelector('table');
  if (!table) return;

  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('th,td')].map(td => `"${td.textContent.trim().replace(/"/g,'""')}"`);
    rows.push(cells.join(','));
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rewear_${type}_report_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

