// ============================================================
// admin.js  REWEAR Admin Dashboard (Complete Rewrite)
// ============================================================

const CORRECT_PIN = '1234';

// ---- ELEMENTS ----
const adminGate      = document.getElementById('adminGate');
const adminDashboard = document.getElementById('adminDashboard');
const pinDigits      = document.querySelectorAll('.pin-digit');
const pinError       = document.getElementById('pinError');
const pinSubmitBtn   = document.getElementById('pinSubmitBtn');

// ---- PIN AUTO-ADVANCE ----
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

// ---- UNLOCK ----
function unlockAdmin() {
  adminGate.style.display = 'none';
  adminDashboard.classList.add('visible');
  localStorage.setItem('rewear_admin', '1');
  startClock();
  checkDBThenLoad();
}

// ---- DB CHECK BEFORE LOADING ----
async function checkDBThenLoad() {
  // Quick test: can we reach the sellers table?
  const { data, error } = await db.from('sellers').select('id').limit(1);

  if (error) {
    // Show a big red banner so user knows what to do
    const banner = document.createElement('div');
    banner.style.cssText = `
      position:fixed;top:0;left:0;right:0;z-index:9998;
      background:#c62828;color:#fff;padding:14px 24px;
      font-size:14px;font-weight:600;text-align:center;
      display:flex;align-items:center;justify-content:center;gap:16px;
    `;
    banner.innerHTML = `
      <span>⚠️ Database not set up — tables missing or no permission.</span>
      <span style="font-weight:400">Go to Supabase → SQL Editor → paste and run <strong>sql/RUN_THIS_IN_SUPABASE.sql</strong></span>
      <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px">✕</button>
    `;
    document.body.prepend(banner);
    console.error('[admin] DB error:', error.message);
  }

  loadOverviewStats();
}

// Auto-login if already authenticated
if (localStorage.getItem('rewear_admin') === '1') unlockAdmin();

pinSubmitBtn.addEventListener('click', checkPin);
document.addEventListener('keydown', e => { if (e.key === 'Enter') checkPin(); });

function checkPin() {
  if (getPin() === CORRECT_PIN) {
    unlockAdmin();
  } else {
    pinError.textContent = 'Incorrect PIN. Try again.';
    pinDigits.forEach(d => { d.value = ''; });
    pinDigits[0].focus();
    setTimeout(() => { pinError.textContent = ''; }, 2000);
  }
}

// ---- LOGOUT ----
document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('rewear_admin');
  adminDashboard.classList.remove('visible');
  adminGate.style.display = 'flex';
  pinDigits.forEach(d => d.value = '');
  pinDigits[0].focus();
});

// ---- CLOCK ----
function startClock() {
  const el = document.getElementById('adminClock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString(); };
  tick();
  setInterval(tick, 1000);
}

// ---- TAB SWITCHING ----
document.querySelectorAll('.sb-link[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    // Update active nav
    document.querySelectorAll('.sb-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show correct pane
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');

    // Update header
    const titles = {
      overview: ['Admin Overview', 'Manage sellers, listings, and platform operations'],
      sellers:  ['Seller Verification', 'Review and approve seller applications'],
      listings: ['Listing Approvals', 'Approve or reject product listings'],
      orders:   ['All Orders', 'Track and manage all platform orders'],
      earnings: ['Platform Earnings', 'View revenue and commission data']
    };
    const [title, sub] = titles[tab] || ['Admin Panel', 'REWEAR Administration'];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = sub;

    // Load data
    if (tab === 'sellers')  loadSellers();
    if (tab === 'listings') loadListings();
    if (tab === 'orders')   loadOrders();
    if (tab === 'earnings') loadAdminEarnings();
  });
});

// ---- HELPERS ----
function php(n) {
  return '' + parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function badge(status) {
  const map = {
    pending:   'badge-pending',
    approved:  'badge-approved',
    verified:  'badge-approved',
    rejected:  'badge-rejected',
    cancelled: 'badge-rejected',
    confirmed: 'badge-confirmed',
    shipped:   'badge-shipped',
    delivered: 'badge-delivered',
    received:  'badge-delivered',
  };
  return `<span class="badge ${map[status] || 'badge-pending'}">${status}</span>`;
}
function emptyState(msg) {
  return `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke-width="2"/></svg><p>${msg}</p></div>`;
}

// ---- OVERVIEW STATS ----
async function loadOverviewStats() {
  try {
    const [r1, r2, r3, r4] = await Promise.all([
      db.from('sellers').select('*', { count: 'exact', head: true }).eq('verified', false),
      db.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('orders').select('*', { count: 'exact', head: true }),
      db.from('sellers').select('*', { count: 'exact', head: true })
    ]);

    document.getElementById('statPendingSellers').textContent  = r1.count ?? 0;
    document.getElementById('statPendingListings').textContent = r2.count ?? 0;
    document.getElementById('statTotalOrders').textContent     = r3.count ?? 0;
    document.getElementById('statTotalSellers').textContent    = r4.count ?? 0;

    // Sidebar badges
    const sc = document.getElementById('pendingSellersCount');
    const lc = document.getElementById('pendingListingsCount');
    const oc = document.getElementById('totalOrdersCount');
    if (sc) { sc.textContent = r1.count ?? 0; sc.classList.toggle('zero', !r1.count); }
    if (lc) { lc.textContent = r2.count ?? 0; lc.classList.toggle('zero', !r2.count); }
    if (oc) { oc.textContent = r3.count ?? 0; oc.classList.toggle('zero', !r3.count); }

    // Attention list
    const [{ data: pendingSellers }, { data: pendingListings }] = await Promise.all([
      db.from('sellers').select('*').eq('verified', false).limit(5),
      db.from('products').select('*').eq('status', 'pending').limit(5)
    ]);

    const rows = [
      ...(pendingSellers || []).map(s => `
        <div class="attention-row">
          <span class="badge badge-pending">Seller</span>
          <span class="attention-name">${s.business_name}</span>
          <span class="attention-meta">${s.email}</span>
          <button class="btn btn-approve" onclick="verifySeller('${s.id}',true)">Approve</button>
          <button class="btn btn-reject"  onclick="promptRejectSeller('${s.id}')">Reject</button>
        </div>`),
      ...(pendingListings || []).map(p => `
        <div class="attention-row">
          <span class="badge badge-pending">Listing</span>
          <span class="attention-name">${p.name}</span>
          <span class="attention-meta">${php(p.price)}</span>
          <button class="btn btn-approve" onclick="approveListing('${p.id}')">Approve</button>
          <button class="btn btn-reject"  onclick="promptRejectListing('${p.id}')">Reject</button>
        </div>`)
    ];

    document.getElementById('attentionList').innerHTML =
      rows.length ? rows.join('') : emptyState('Nothing needs attention right now.');

  } catch (err) {
    console.error('[admin] loadOverviewStats:', err);
    document.getElementById('attentionList').innerHTML =
      `<div class="empty" style="color:#ef4444"><p>Database error: ${err.message}<br><small>Run RUN_THIS_IN_SUPABASE.sql in Supabase SQL Editor</small></p></div>`;
  }
}

// ---- SELLERS TAB ----
async function loadSellers() {
  const list = document.getElementById('sellersList');
  list.innerHTML = emptyState('Loading sellers...');

  const filter = document.getElementById('sellerStatusFilter')?.value || 'all';
  const search = document.getElementById('sellerSearch')?.value.toLowerCase() || '';

  let q = db.from('sellers').select('*').order('created_at', { ascending: false });
  if (filter === 'verified') q = q.eq('verified', true);
  if (filter === 'pending')  q = q.eq('verified', false);

  const { data, error } = await q;
  if (error) { list.innerHTML = emptyState('Could not load sellers: ' + error.message); return; }

  const filtered = search
    ? (data || []).filter(s => s.business_name?.toLowerCase().includes(search) || s.email?.toLowerCase().includes(search))
    : (data || []);

  if (!filtered.length) { list.innerHTML = emptyState('No sellers found.'); return; }

  list.innerHTML = filtered.map(s => `
    <div class="seller-card">
      <div class="seller-head">
        <div>
          <div class="seller-name">${s.business_name}</div>
          <div class="seller-email">${s.email}${s.phone ? '  ' + s.phone : ''}</div>
          <div class="seller-email" style="margin-top:4px;color:#aaa">Applied: ${fmtDate(s.created_at)}</div>
        </div>
        ${badge(s.verified ? 'verified' : 'pending')}
      </div>
      ${s.description ? `<div class="seller-desc">${s.description}</div>` : ''}
      ${s.rejection_reason ? `<div class="rejection-note">Rejected: ${s.rejection_reason}</div>` : ''}
      <div class="seller-actions">
        ${!s.verified
          ? `<button class="btn btn-approve" onclick="verifySeller('${s.id}',true)"> Approve</button>
             <button class="btn btn-reject"  onclick="promptRejectSeller('${s.id}')"> Reject</button>`
          : `<button class="btn btn-reject"  onclick="verifySeller('${s.id}',false)">Revoke</button>`}
      </div>
    </div>`).join('');
}

document.getElementById('sellerStatusFilter')?.addEventListener('change', loadSellers);
document.getElementById('sellerSearch')?.addEventListener('input', loadSellers);

// ---- VERIFY / REJECT SELLER ----
async function verifySeller(id, approve) {
  const { error } = await db.from('sellers').update({
    verified: approve,
    verified_at: approve ? new Date().toISOString() : null,
    rejection_reason: approve ? null : undefined
  }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  loadSellers();
  loadOverviewStats();
}

async function promptRejectSeller(id) {
  const reason = prompt('Reason for rejection (shown to seller):');
  if (reason === null) return;
  const { error } = await db.from('sellers').update({
    verified: false,
    rejection_reason: reason || 'Application rejected.'
  }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  loadSellers();
  loadOverviewStats();
}

// ---- LISTINGS TAB ----
async function loadListings() {
  const list = document.getElementById('listingsList');
  list.innerHTML = '<div class="empty"><p>Loading listings...</p></div>';

  const filter = document.getElementById('listingStatusFilter')?.value || 'all';
  const search = document.getElementById('listingSearch')?.value.toLowerCase() || '';

  let q = db.from('products').select('*, sellers(business_name)').order('created_at', { ascending: false });
  if (filter !== 'all') q = q.eq('status', filter);

  const { data, error } = await q;
  if (error) { list.innerHTML = emptyState('Could not load listings: ' + error.message); return; }

  const filtered = search
    ? (data || []).filter(p => p.name?.toLowerCase().includes(search))
    : (data || []);

  if (!filtered.length) { list.innerHTML = emptyState('No listings found.'); return; }

  list.innerHTML = filtered.map(p => {
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    const sellerName = p.sellers?.business_name || 'Unknown Seller';
    return `
    <div class="product-card">
      ${p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" class="product-img" onerror="this.outerHTML='<div class=\\'product-img-placeholder\\'></div>'">`
        : '<div class="product-img-placeholder"></div>'}
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-price">${php(p.price)}</div>
        <div class="product-meta">Seller: ${sellerName}</div>
        <div class="product-meta">Category: ${p.category}  Added: ${fmtDate(p.created_at)}</div>
        ${p.description ? `<div class="product-desc">${p.description}</div>` : ''}
        <div class="product-tags">
          ${badge(p.status)}
          ${sizes.map(s => `<span class="tag tag-size">${s}</span>`).join('')}
        </div>
        ${p.rejection_reason ? `<div class="rejection-note">Rejected: ${p.rejection_reason}</div>` : ''}
        <div class="product-actions">
          ${p.status !== 'approved'
            ? `<button class="btn btn-approve" onclick="approveListing('${p.id}')"> Approve</button>` : ''}
          ${p.status !== 'rejected'
            ? `<button class="btn btn-reject" onclick="promptRejectListing('${p.id}')"> Reject</button>` : ''}
          ${p.status === 'rejected'
            ? `<button class="btn btn-approve" onclick="approveListing('${p.id}')"> Re-approve</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('listingStatusFilter')?.addEventListener('change', loadListings);
document.getElementById('listingSearch')?.addEventListener('input', loadListings);

// ---- APPROVE / REJECT LISTING ----
async function approveListing(id) {
  const { error } = await db.from('products').update({
    status: 'approved', in_stock: true, rejection_reason: null
  }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  loadListings();
  loadOverviewStats();
}

async function promptRejectListing(id) {
  const reason = prompt('Reason for rejection (shown to seller):');
  if (reason === null) return;
  const { error } = await db.from('products').update({
    status: 'rejected', in_stock: false, rejection_reason: reason || 'Listing rejected.'
  }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  loadListings();
  loadOverviewStats();
}

// ---- ORDERS TAB ----
async function loadOrders() {
  const list = document.getElementById('adminOrdersList');
  list.innerHTML = emptyState('Loading orders...');

  const filter = document.getElementById('orderStatusFilter')?.value || 'all';
  let q = db.from('orders').select('*, products(name, image_url)').order('created_at', { ascending: false });
  if (filter !== 'all') q = q.eq('status', filter);

  const { data, error } = await q;
  if (error) { list.innerHTML = emptyState('Could not load orders: ' + error.message); return; }
  if (!data?.length) { list.innerHTML = emptyState('No orders found.'); return; }

  list.innerHTML = data.map(o => `
    <div class="order-row">
      <div class="order-info">
        <h4>${o.buyer_name || 'Unknown Buyer'}</h4>
        <p>${o.buyer_email || ''}  Size: ${o.size_selected || ''}  Qty: ${o.quantity || 1}</p>
        <p>${o.products?.name || 'Product deleted'}  ${fmtDate(o.created_at)}</p>
      </div>
      <div class="order-right">
        <strong style="font-size:16px;color:#1a1512">${php(o.total_price)}</strong>
        ${badge(o.status)}
        <select class="toolbar select" onchange="updateOrderStatus('${o.id}', this.value)" style="padding:6px 10px;border-radius:8px;border:1px solid #e5ddd4;font-size:12px;cursor:pointer">
          <option value="">Update status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>`).join('');
}

document.getElementById('orderStatusFilter')?.addEventListener('change', loadOrders);

async function updateOrderStatus(id, status) {
  if (!status) return;
  const { error } = await db.from('orders').update({ status }).eq('id', id);
  if (error) { alert('Error: ' + error.message); return; }
  loadOrders();
}

// ---- EARNINGS TAB ----
async function loadAdminEarnings() {
  const el = document.getElementById('earningsSummary');
  el.innerHTML = emptyState('Loading earnings...');

  const { data, error } = await db.from('earnings').select('source, amount');
  if (error) { el.innerHTML = emptyState('Could not load earnings: ' + error.message); return; }

  const rows = data || [];
  const fees        = rows.filter(e => e.source === 'listing_fee').reduce((s, e) => s + parseFloat(e.amount), 0);
  const commissions = rows.filter(e => e.source === 'commission').reduce((s, e) => s + parseFloat(e.amount), 0);
  const total       = fees + commissions;

  el.innerHTML = `
    <div class="earnings-grid">
      <div class="earning-box">
        <div class="earning-label">Listing Fees</div>
        <div class="earning-val">${php(fees)}</div>
      </div>
      <div class="earning-box">
        <div class="earning-label">Commissions</div>
        <div class="earning-val">${php(commissions)}</div>
      </div>
      <div class="earning-box" style="background:#1a1512;color:#fff">
        <div class="earning-label" style="color:#d4a843">Total Revenue</div>
        <div class="earning-val" style="color:#d4a843">${php(total)}</div>
      </div>
    </div>`;
}

// ---- EXPOSE GLOBALS ----
window.verifySeller        = verifySeller;
window.promptRejectSeller  = promptRejectSeller;
window.approveListing      = approveListing;
window.promptRejectListing = promptRejectListing;
window.updateOrderStatus   = updateOrderStatus;
window.loadSellers         = loadSellers;
window.loadListings        = loadListings;
window.loadOrders          = loadOrders;
window.loadAdminEarnings   = loadAdminEarnings;
