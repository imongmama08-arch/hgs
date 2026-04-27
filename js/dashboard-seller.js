// ============================================================
// dashboard-seller.js — Seller dashboard logic
// Used on: dashboard-seller.html
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
    if (tab === 'listings') loadSellerListings();
    if (tab === 'orders')   loadSellerOrders();
    if (tab === 'fees')     loadFeesTab();
    if (tab === 'earnings') loadEarningsTab();
    if (tab === 'payouts')  loadPayoutsTab();
    if (tab === 'profile')  loadSellerProfile();
    if (tab === 'messages') loadSellerMessages();
  });
});

// Shortcut: Add Listing button
document.getElementById('addProductBtn')?.addEventListener('click', () => {
  document.querySelector('[data-tab="add"]')?.click();
});

// ---- OVERVIEW STATS ----
async function loadOverviewStats() {
  try {
    // Get current seller ID from auth system
    const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
    
    console.log('[seller] loadOverviewStats: Current seller ID:', currentSellerId);
    
    if (!currentSellerId) {
      console.log('[seller] loadOverviewStats: No seller ID found');
      // If no seller ID, show zeros
      const el = id => document.getElementById(id);
      if (el('statListings')) el('statListings').textContent = 0;
      if (el('statOrders'))   el('statOrders').textContent   = 0;
      if (el('statPending'))  el('statPending').textContent  = 0;
      
      const list = document.getElementById('recentOrdersList');
      if (list) {
        list.innerHTML = '<p class="dash-empty">No orders yet.</p>';
      }
      return;
    }

    console.log('[seller] loadOverviewStats: Querying database...');

    // Query 1: Count listings by seller
    let listingCount = 0;
    try {
      const { count, error: listingError } = await db
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', currentSellerId);
      
      if (listingError) {
        console.error('[seller] loadOverviewStats: Listing count error:', listingError);
        listingCount = 0;
      } else {
        listingCount = count ?? 0;
      }
    } catch (err) {
      console.error('[seller] loadOverviewStats: Listing query exception:', err);
      listingCount = 0;
    }

    // Query 2: Get orders for this seller
    // First, get all products by this seller
    let orderCount = 0;
    let pendingCount = 0;
    let recentOrders = [];
    
    try {
      const { data: sellerProducts, error: productsError } = await db
        .from('products')
        .select('id')
        .eq('seller_id', currentSellerId);
      
      if (productsError) {
        console.error('[seller] loadOverviewStats: Products query error:', productsError);
      } else if (sellerProducts && sellerProducts.length > 0) {
        const productIds = sellerProducts.map(p => p.id);
        console.log('[seller] loadOverviewStats: Found', productIds.length, 'products');
        
        // Now get orders for these products
        const { data: orders, error: ordersError } = await db
          .from('orders')
          .select('*')
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (ordersError) {
          console.error('[seller] loadOverviewStats: Orders query error:', ordersError);
        } else if (orders) {
          orderCount = orders.length;
          pendingCount = orders.filter(o => o.status === 'pending').length;
          recentOrders = orders.slice(0, 5);
          console.log('[seller] loadOverviewStats: Found', orderCount, 'orders');
        }
      } else {
        console.log('[seller] loadOverviewStats: No products found for seller');
      }
    } catch (err) {
      console.error('[seller] loadOverviewStats: Orders query exception:', err);
    }

    console.log('[seller] loadOverviewStats: Final results:', {
      listingCount,
      orderCount,
      pendingCount
    });

    // Update stats display
    const el = id => document.getElementById(id);
    if (el('statListings')) el('statListings').textContent = listingCount;
    if (el('statOrders'))   el('statOrders').textContent   = orderCount;
    if (el('statPending'))  el('statPending').textContent  = pendingCount;

    // Update recent orders list
    const list = document.getElementById('recentOrdersList');
    if (list) {
      if (recentOrders.length > 0) {
        list.innerHTML = recentOrders.map(o => {
          return `
            <div class="order-row" style="padding:12px;border-bottom:1px solid #eee;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <p style="margin:0;font-weight:600;font-size:14px;">Order #${o.id.substring(0, 8)}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#666;">${o.buyer_name || 'Customer'}</p>
                </div>
                <div style="text-align:right;">
                  <p style="margin:0;font-weight:600;font-size:14px;">₱${parseFloat(o.total_price || 0).toFixed(2)}</p>
                  <span style="display:inline-block;margin-top:4px;padding:4px 8px;background:${
                    o.status === 'pending' ? '#fff8e1' : 
                    o.status === 'confirmed' ? '#e8f5e9' : 
                    o.status === 'shipped' ? '#e3f2fd' : '#f5f5f5'
                  };color:${
                    o.status === 'pending' ? '#856404' : 
                    o.status === 'confirmed' ? '#155724' : 
                    o.status === 'shipped' ? '#0d47a1' : '#666'
                  };border-radius:4px;font-size:11px;font-weight:600;">${o.status || 'pending'}</span>
                </div>
              </div>
            </div>`;
        }).join('');
      } else {
        list.innerHTML = '<p class="dash-empty">No orders yet.</p>';
      }
    }

  } catch (error) {
    console.error('[seller] loadOverviewStats: Exception:', error);
    // Show zeros instead of "Error" for better UX
    const el = id => document.getElementById(id);
    if (el('statListings')) el('statListings').textContent = '0';
    if (el('statOrders'))   el('statOrders').textContent   = '0';
    if (el('statPending'))  el('statPending').textContent  = '0';
    
    const list = document.getElementById('recentOrdersList');
    if (list) {
      list.innerHTML = '<p class="dash-empty" style="color:#e74c3c;">Could not load stats. Please refresh the page.</p>';
    }
  }
}

// ---- LISTINGS TAB ----
async function loadSellerListings() {
  const grid = document.getElementById('sellerListingsGrid');
  if (!grid) return;

  try {
    // Get current seller ID from auth system
    const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
    
    console.log('[seller] loadSellerListings: Current seller ID:', currentSellerId);
    
    if (!currentSellerId) {
      grid.innerHTML = '<p class="dash-empty">Seller session not found. Please log in.</p>';
      return;
    }

    // Only show loading if we expect there might be data
    const hasSearch = document.getElementById('listingSearch')?.value.trim();
    if (hasSearch) {
      grid.innerHTML = '<p class="dash-empty">Searching…</p>';
    } else {
      // For initial load, show loading briefly
      grid.innerHTML = '<p class="dash-empty">Loading…</p>';
    }

    const sort = document.getElementById('listingSort')?.value || 'newest';
    
    console.log('[seller] loadSellerListings: Building query with sort:', sort);
    
    let query = db.from('products').select('*').eq('seller_id', currentSellerId); // Filter by seller ID
    if (sort === 'price_asc')  query = query.order('price', { ascending: true });
    if (sort === 'price_desc') query = query.order('price', { ascending: false });
    if (sort === 'newest')     query = query.order('created_at', { ascending: false });

    console.log('[seller] loadSellerListings: Executing query...');
    const { data, error } = await query;
    
    if (error) { 
      console.error('[seller] loadSellerListings: Database error:', error);
      grid.innerHTML = '<p class="dash-empty">Could not load listings. Error: ' + error.message + '</p>'; 
      return; 
    }

    console.log('[seller] loadSellerListings: Query successful, found', data?.length || 0, 'products');

    // Handle empty data case immediately
    if (!data || data.length === 0) {
      grid.innerHTML = '<p class="dash-empty">No listings yet. <a href="#" onclick="document.querySelector(\'[data-tab=&quot;add&quot;]\').click()" style="color:#c8a96e;text-decoration:underline;">Add your first product</a></p>';
      return;
    }

    const search = document.getElementById('listingSearch')?.value.toLowerCase() || '';
    const filtered = search ? data.filter(p => p.name.toLowerCase().includes(search)) : data;

    console.log('[seller] loadSellerListings: After filtering:', filtered.length, 'products');

    grid.innerHTML = filtered.length
      ? filtered.map(p => {
          const statusColor = p.status==='approved'?'#27ae60':p.status==='rejected'?'#e74c3c':'#c8a96e';
          const statusLabel = p.status==='approved'?'✅ Live':p.status==='rejected'?'❌ Rejected':'⏳ Pending Approval';
          return `
          <div class="product-card" style="cursor:default;position:relative;">
            <div class="product-image"><img src="${p.image_url}" alt="${p.name}" loading="lazy"></div>
            <div class="product-info">
              <h3 class="product-name">${p.name}</h3>
              <p class="product-price">₱${parseFloat(p.price).toFixed(2)}</p>
              <div class="product-sizes">${(p.sizes||[]).map(s=>`<span class="size-tag">${s}</span>`).join('')}</div>
              <div style="margin-top:6px;">
                <span style="font-size:12px;font-weight:600;color:${statusColor};">${statusLabel}</span>
                ${p.rejection_reason ? `<p style="font-size:11px;color:#e74c3c;margin:2px 0 0;">Reason: ${p.rejection_reason}</p>` : ''}
              </div>
              ${p.status==='approved' && p.in_stock ? `
              <button onclick="markAsSold('${p.id}')"
                style="margin-top:8px;width:100%;padding:7px;background:#e74c3c;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                Mark as Sold
              </button>` : ''}
              ${!p.in_stock ? `<p style="margin-top:6px;font-size:12px;color:#888;font-weight:600;">✕ Sold / Out of Stock</p>` : ''}
            </div>
          </div>`}).join('')
      : '<p class="dash-empty">No listings match your search. <button onclick="document.getElementById(\'listingSearch\').value=\'\'; loadSellerListings();" style="background:none;border:none;color:#c8a96e;text-decoration:underline;cursor:pointer;">Clear search</button></p>';

  } catch (error) {
    console.error('[seller] loadSellerListings: Exception:', error);
    grid.innerHTML = '<p class="dash-empty">Error loading listings: ' + error.message + '</p>';
  }
}

document.getElementById('listingSearch')?.addEventListener('input', loadSellerListings);
document.getElementById('listingSort')?.addEventListener('change', loadSellerListings);

// ---- ORDERS TAB ----
function orderRowHTML(o) {
  return `
    <div class="dash-order-row">
      <div>
        <p class="dash-order-name">${o.buyer_name}</p>
        <p class="dash-order-meta">${o.buyer_email} · Size: ${o.size_selected || '—'} · $${parseFloat(o.total_price||0).toFixed(2)}</p>
        <p class="dash-order-meta">${new Date(o.created_at).toLocaleDateString()}</p>
      </div>
      <span class="dash-order-status status-${o.status}">${o.status}</span>
    </div>`;
}

async function loadSellerOrders() {
  const list = document.getElementById('sellerOrdersList');
  if (!list) return;
  list.innerHTML = '<p class="dash-empty">Loading…</p>';

  // Get current seller ID from auth system
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  
  console.log('[seller] loadSellerOrders: Current seller ID:', currentSellerId);
  
  if (!currentSellerId) {
    list.innerHTML = '<p class="dash-empty">Seller session not found. Please log in.</p>';
    return;
  }

  const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
  
  try {
    // Step 1: Get all products by this seller
    const { data: sellerProducts, error: productsError } = await db
      .from('products')
      .select('id, name, image_url')
      .eq('seller_id', currentSellerId);
    
    if (productsError) {
      console.error('[seller] loadSellerOrders: Products query error:', productsError);
      list.innerHTML = '<p class="dash-empty">Could not load products.</p>';
      return;
    }
    
    if (!sellerProducts || sellerProducts.length === 0) {
      console.log('[seller] loadSellerOrders: No products found for seller');
      list.innerHTML = '<p class="dash-empty">No products found. Add products to receive orders.</p>';
      return;
    }
    
    const productIds = sellerProducts.map(p => p.id);
    const productMap = {};
    sellerProducts.forEach(p => productMap[p.id] = p);
    
    console.log('[seller] loadSellerOrders: Found', productIds.length, 'products');
    
    // Step 2: Get orders for those products
    let query = db
      .from('orders')
      .select('*')
      .in('product_id', productIds)
      .order('created_at', { ascending: false });
    
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    
    const { data: orders, error: ordersError } = await query;
    
    if (ordersError) {
      console.error('[seller] loadSellerOrders: Orders query error:', ordersError);
      list.innerHTML = '<p class="dash-empty">Could not load orders.</p>';
      return;
    }
    
    console.log('[seller] loadSellerOrders: Found', orders?.length || 0, 'orders');
    
    // Attach product info to each order
    const ordersWithProducts = orders?.map(o => ({
      ...o,
      products: productMap[o.product_id] || { name: 'Unknown Product', image_url: '' }
    })) || [];
    
    list.innerHTML = ordersWithProducts.length 
      ? ordersWithProducts.map(o => enhancedOrderRowHTML(o)).join('') 
      : '<p class="dash-empty">No orders found for your products.</p>';
      
  } catch (error) {
    console.error('[seller] loadSellerOrders: Exception:', error);
    list.innerHTML = '<p class="dash-empty">Error loading orders. Please refresh the page.</p>';
  }
}

document.getElementById('orderStatusFilter')?.addEventListener('change', loadSellerOrders);

// ---- ORDER MANAGEMENT FUNCTIONS ----
function getStatusLabel(status) {
  const statusLabels = {
    'pending':   'Pending',
    'confirmed': 'Confirmed',
    'shipped':   'Shipped',
    'delivered': 'Delivered',
    'received':  'Receipt Confirmed',
    'cancelled': 'Cancelled'
  };
  return statusLabels[status] || status.replace(/_/g, ' ').toUpperCase();
}

// Enhanced order row HTML with management controls
function enhancedOrderRowHTML(o) {
  const productName = o.products?.name || 'Unknown Product';
  const showTracking = ['confirmed', 'shipped', 'delivered'].includes(o.status);
  // Prefer DB columns; fall back to localStorage
  const lsTracking = JSON.parse(localStorage.getItem(`rewear_tracking_${o.id}`) || '{}');
  const trackingNumber = o.tracking_number || lsTracking.tracking_number || '';
  const courierName    = o.courier_name    || lsTracking.courier_name    || '';

  const paymentBadge = {
    pending:   '<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">⏳ Awaiting Payment</span>',
    submitted: '<span style="background:#cce5ff;color:#004085;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">📤 Proof Submitted</span>',
    verified:  '<span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">✅ Payment Verified</span>',
    rejected:  '<span style="background:#f8d7da;color:#721c24;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">❌ Payment Rejected</span>'
  }[o.payment_status || 'pending'] || '';

  return `
    <div class="dash-order-row" data-order-id="${o.id}" data-status="${o.status}">
      <div class="order-main-info">
        <div class="order-buyer-info">
          <p class="dash-order-name">${o.buyer_name}</p>
          <p class="dash-order-meta"><strong>Product:</strong> ${productName}</p>
          <p class="dash-order-meta">${o.buyer_email}${o.buyer_phone ? ' · ' + o.buyer_phone : ''}</p>
          ${o.delivery_address ? `<p class="dash-order-meta">📍 ${o.delivery_address}</p>` : ''}
          <p class="dash-order-meta">Size: ${o.size_selected || '—'} · Qty: ${o.quantity || 1} · ₱${parseFloat(o.total_price||0).toFixed(2)}</p>
          <p class="dash-order-meta">Ref: ${o.payment_reference || o.id.slice(0,8).toUpperCase()} · ${new Date(o.created_at).toLocaleDateString()}</p>
          <div style="margin-top:4px;">${paymentBadge}</div>
          ${o.payment_status === 'submitted' ? `
          <div style="margin-top:6px;padding:8px;background:#fff8e1;border-radius:6px;font-size:13px;color:#856404;">
            📤 Payment proof submitted — awaiting admin verification
          </div>` : ''}
          ${o.status === 'confirmed' ? `
          <div style="margin-top:6px;padding:8px;background:#e8f5e9;border-radius:6px;font-size:13px;color:#155724;">
            ✅ Payment verified — please prepare this item for shipping
          </div>` : ''}
          ${o.status === 'received' ? `
          <div style="margin-top:6px;padding:12px;background:#e8f5e9;border-radius:8px;border:1px solid #a5d6a7;">
            <p style="font-weight:700;margin:0 0 6px;color:#155724;">🎉 Buyer Confirmed Receipt!</p>
            <p style="margin:0 0 10px;font-size:13px;color:#555;">The transaction is complete. Mark the item as sold to close this order.</p>
            <button onclick="sellerMarkItemSold('${o.id}', '${o.products?.id || ''}')"
              style="padding:8px 18px;background:#27ae60;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
              ✓ Mark Item as Sold — Transaction Complete
            </button>
          </div>` : ''}
        </div>
        
        <div class="order-status-section">
          <div class="current-status">
            <span class="dash-order-status status-${o.status.replace(/_/g, '-')}">${getStatusLabel(o.status)}</span>
          </div>
          
          <div class="order-actions">
            ${o.status === 'confirmed' ? `
            <button onclick="acceptOrder('${o.id}')" style="display:none;"></button>` : ''}
            <select class="status-update-select" data-order-id="${o.id}" data-current-status="${o.status}">
              <option value="pending"   ${o.status === 'pending'   ? 'selected' : ''}>Pending</option>
              <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="shipped"   ${o.status === 'shipped'   ? 'selected' : ''}>Shipped</option>
              <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>

            ${showTracking ? `
            <div class="tracking-info" style="margin-top:8px;">
              <input type="text" class="tracking-number-input dash-search" 
                     placeholder="Tracking Number" 
                     value="${trackingNumber}"
                     data-order-id="${o.id}"
                     style="margin-bottom:6px;">
              <input type="text" class="courier-name-input dash-search" 
                     placeholder="Courier (e.g. LBC, J&T, Grab)" 
                     value="${courierName}"
                     data-order-id="${o.id}">
            </div>` : ''}
            
            <button class="btn-update-order" data-order-id="${o.id}" style="margin-top:8px;">Update Order</button>
          </div>
        </div>
      </div>
    </div>`;
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    console.log('[seller] updateOrderStatus called:', { orderId, newStatus });

    const orderRow = document.querySelector(`.dash-order-row[data-order-id="${orderId}"]`);
    const trackingNumber = orderRow?.querySelector('.tracking-number-input')?.value.trim() || null;
    const courierName    = orderRow?.querySelector('.courier-name-input')?.value.trim() || null;

    // Base update — always works
    const baseUpdate = { status: newStatus };
    const { error: baseErr } = await db.from('orders').update(baseUpdate).eq('id', orderId);
    if (baseErr) throw baseErr;

    // Extended update — only if 06_buyer_flow.sql has been run
    if (trackingNumber || courierName || newStatus === 'delivered' || newStatus === 'confirmed') {
      const extUpdate = {};
      if (trackingNumber) extUpdate.tracking_number = trackingNumber;
      if (courierName)    extUpdate.courier_name    = courierName;
      if (newStatus === 'delivered') extUpdate.delivered_at = new Date().toISOString();
      if (newStatus === 'confirmed') extUpdate.confirmed_at = new Date().toISOString();

      const { error: extErr } = await db.from('orders').update(extUpdate).eq('id', orderId);
      if (extErr) {
        // Columns not yet available — save tracking to localStorage as fallback
        console.warn('[seller] Extended columns not available, using localStorage:', extErr.message);
        if (trackingNumber || courierName) {
          localStorage.setItem(`rewear_tracking_${orderId}`, JSON.stringify({
            tracking_number: trackingNumber || '',
            courier_name:    courierName || '',
            updated_at:      new Date().toISOString()
          }));
        }
      }
    }

    // Update badge in-place immediately
    if (orderRow) {
      orderRow.dataset.status = newStatus;
      const badge = orderRow.querySelector('.dash-order-status');
      if (badge) {
        badge.className = `dash-order-status status-${newStatus.replace(/_/g, '-')}`;
        badge.textContent = getStatusLabel(newStatus);
      }
    }

    showSuccess('Order Updated', `Status updated to ${getStatusLabel(newStatus)}`);
    loadSellerOrders();
    
  } catch (error) {
    showError('Update Failed', 'Could not update order status: ' + (error.message || error));
    console.error('[seller] updateOrderStatus full error:', error);
  }
}

// ---- PAYMENT VERIFICATION — ADMIN ONLY ----
// Payment verification is handled exclusively by the admin panel.
// Sellers can see payment status badges but cannot verify or reject payments.

// Event delegation for order management buttons
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-update-order')) {
    const orderId = e.target.dataset.orderId;
    const orderRow = e.target.closest('.dash-order-row');
    const statusSelect = orderRow.querySelector('.status-update-select');
    const newStatus = statusSelect.value;
    
    await updateOrderStatus(orderId, newStatus);
  }
});

// Show/hide tracking inputs based on status selection - removed (tracking not supported)

// ============================================================
// LISTING FEE FUNCTIONS
// ============================================================

// ---- CHECK LISTING FEE AVAILABILITY ----
// Returns { available: true, fee } or { available: false, fee: null, reason: '...' }
async function checkListingFeeAvailability(seller_id) {
  // Query for an active fee that still has slots remaining
  const { data: fees, error } = await db
    .from('listing_fees')
    .select('*')
    .eq('seller_id', seller_id)
    .eq('status', 'active')
    .order('expires_at', { ascending: true });

  if (error) {
    console.error('[seller] checkListingFeeAvailability:', error.message);
    return { available: false, fee: null, reason: 'Could not check listing fee availability.' };
  }

  if (!fees || fees.length === 0) {
    return { available: false, fee: null, reason: 'No active listing fee found. Please purchase a listing tier.' };
  }

  const now = new Date();

  for (const fee of fees) {
    // Check expiry first
    if (fee.expires_at && new Date(fee.expires_at) < now) {
      // Mark as expired in DB
      await db.from('listing_fees').update({ status: 'expired' }).eq('id', fee.id);
      continue; // try next fee
    }

    // Check slots remaining
    if (fee.listings_used >= fee.max_listings) {
      continue; // exhausted, try next
    }

    // This fee is valid and has slots
    return { available: true, fee };
  }

  // All fees were either expired or exhausted
  return {
    available: false,
    fee: null,
    reason: 'Your listing fee has expired or all listing slots are exhausted. Please purchase a new tier.'
  };
}

// ---- RECORD LISTING FEE ----
// Records a listing fee payment for the given seller and tier.
// Returns { data: fee, error } matching the Supabase response pattern.
async function recordListingFee(seller_id, tier) {
  const tierConfig = {
    basic:    { amount_paid: 99,  max_listings: 3,  days: 30 },
    standard: { amount_paid: 249, max_listings: 10, days: 60 },
    premium:  { amount_paid: 499, max_listings: 25, days: 90 }
  };

  const config = tierConfig[tier];
  if (!config) {
    return { data: null, error: new Error(`Invalid tier: ${tier}. Must be basic, standard, or premium.`) };
  }

  // Step 1: Ensure seller record exists
  const { data: existingSeller, error: sellerCheckError } = await db
    .from('sellers')
    .select('id')
    .eq('id', seller_id)
    .single();

  if (sellerCheckError && sellerCheckError.code !== 'PGRST116') {
    // PGRST116 is "not found" error, which is expected if seller doesn't exist
    console.error('[seller] recordListingFee (seller check):', sellerCheckError.message);
    return { data: null, error: sellerCheckError };
  }

  if (!existingSeller) {
    // Seller doesn't exist, create a basic seller record
    console.log('[seller] recordListingFee: Creating seller record for ID:', seller_id);
    
    // Get user info from auth system for seller creation
    const currentUser = authManager.getCurrentUser();
    const userEmail = currentUser?.email || `user_${seller_id}@rewear.com`;
    
    const { data: newSeller, error: createSellerError } = await db
      .from('sellers')
      .insert({
        id: seller_id,
        business_name: `Seller ${seller_id.slice(0, 8)}`,
        email: userEmail,
        verified: true, // Auto-verify for listing fee purchases
        verified_at: new Date().toISOString(),
        description: 'Auto-created seller account'
      })
      .select()
      .single();

    if (createSellerError) {
      console.error('[seller] recordListingFee (create seller):', createSellerError.message);
      return { data: null, error: new Error('Could not create seller account. Please contact support.') };
    }

    console.log('[seller] recordListingFee: Seller record created:', newSeller);
  }

  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + config.days);

  // Step 2: INSERT into listing_fees
  const { data: feeRows, error: feeError } = await db
    .from('listing_fees')
    .insert({
      seller_id,
      tier,
      amount_paid:   config.amount_paid,
      max_listings:  config.max_listings,
      listings_used: 0,
      status:        'active',
      expires_at:    expires_at.toISOString()
    })
    .select()
    .single();

  if (feeError) {
    console.error('[seller] recordListingFee (insert fee):', feeError.message);
    return { data: null, error: feeError };
  }

  const fee = feeRows;

  // Step 3: INSERT into earnings
  const { error: earningsError } = await db
    .from('earnings')
    .insert({
      source:       'listing_fee',
      reference_id: fee.id,
      amount:       config.amount_paid
    });

  if (earningsError) {
    // Non-fatal: fee was recorded, earnings entry failed — log and continue
    console.error('[seller] recordListingFee (insert earnings):', earningsError.message);
  }

  return { data: fee, error: null };
}

// ---- SUBMIT LISTING ----
// Verifies seller and fee availability, then inserts the product.
// Returns { data: product, error } matching the Supabase response pattern.
async function submitListing(seller_id, productPayload) {
  try {
    console.log('[seller] submitListing called with:', { seller_id, productPayload });

    // Step 1: Ensure seller record exists
    const { data: existingSeller, error: sellerCheckError } = await db
      .from('sellers')
      .select('id')
      .eq('id', seller_id)
      .single();

    if (sellerCheckError && sellerCheckError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if seller doesn't exist
      console.error('[seller] submitListing (seller check):', sellerCheckError.message);
      return { data: null, error: sellerCheckError };
    }

    if (!existingSeller) {
      // Seller doesn't exist, create a basic seller record
      console.log('[seller] submitListing: Creating seller record for ID:', seller_id);
      
      // Get user info from auth system for seller creation
      const currentUser = authManager.getCurrentUser();
      const userEmail = currentUser?.email || `user_${seller_id}@rewear.com`;
      
      const { data: newSeller, error: createSellerError } = await db
        .from('sellers')
        .insert({
          id: seller_id,
          business_name: `Seller ${seller_id.slice(0, 8)}`,
          email: userEmail,
          verified: true, // Auto-verify for product submissions
          verified_at: new Date().toISOString(),
          description: 'Auto-created seller account'
        })
        .select()
        .single();

      if (createSellerError) {
        console.error('[seller] submitListing (create seller):', createSellerError.message);
        return { data: null, error: new Error('Could not create seller account. Please contact support.') };
      }

      console.log('[seller] submitListing: Seller record created:', newSeller);
    }

    // Step 2: Check seller is verified - check both sellers.verified and seller_applications.status
    const { data: sellerRecord } = await db
      .from('sellers')
      .select('verified, rejection_reason')
      .eq('id', seller_id)
      .single();

    // Also check seller application status
    const { data: application } = await db
      .from('seller_applications')
      .select('status, rejection_reason')
      .eq('user_id', seller_id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();

    const isVerified = sellerRecord?.verified || application?.status === 'approved';
    const isRejected = sellerRecord?.rejection_reason || application?.status === 'rejected';
    const rejectionReason = sellerRecord?.rejection_reason || application?.rejection_reason;

    if (!isVerified) {
      if (isRejected) {
        const reason = rejectionReason || 'Your seller application has been rejected.';
        return { data: null, error: new Error(`Application rejected: ${reason}`) };
      } else {
        return { data: null, error: new Error('Your seller account is pending admin approval. Please wait for verification.') };
      }
    }

    // Step 3: Check listing fee availability
    const { available, fee, reason: feeReason } = await checkListingFeeAvailability(seller_id);
    if (!available) {
      return { data: null, error: new Error(feeReason || 'No active listing fee. Please pay a listing fee first.') };
    }

    // Step 4: Insert the product with 'pending' status for admin approval
    const { data: product, error: insertError } = await db
      .from('products')
      .insert({
        seller_id:       seller_id,
        listing_fee_id:  fee.id,
        name:            productPayload.name,
        price:           productPayload.price,
        category:        productPayload.category,
        image_url:       productPayload.image_url,
        description:     productPayload.description || '',
        sizes:           productPayload.sizes,
        suggested_price: productPayload.suggested_price,
        in_stock:        false,   // set to true when admin approves
        status:          'pending' // requires admin approval
      })
      .select()
      .single();

    if (insertError) {
      console.error('[seller] submitListing (insert):', insertError.message);
      return { data: null, error: insertError };
    }

    console.log('[seller] submitListing: Product created successfully:', product);

    // Increment listing fee usage count
    await db.from('listing_fees')
      .update({ listings_used: fee.listings_used + 1 })
      .eq('id', fee.id);

    return { data: product, error: null };
    
  } catch (error) {
    console.error('[seller] submitListing (catch):', error.message);
    return { data: null, error };
  }
}

// ---- LOAD SELLER EARNINGS ----
// Returns aggregated earnings data for the seller's transactions.
// { totalGross, totalCommission, totalPayout, orders: Transaction[] }
async function loadSellerEarnings(seller_id) {
  const { data: orders, error } = await db
    .from('transactions')
    .select('gross_amount, commission_amount, seller_payout, status, created_at')
    .eq('seller_id', seller_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[seller] loadSellerEarnings:', error.message);
    return { totalGross: 0, totalCommission: 0, totalPayout: 0, orders: [] };
  }

  const rows = orders || [];

  const totalGross      = rows.reduce((sum, t) => sum + parseFloat(t.gross_amount      || 0), 0);
  const totalCommission = rows.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0);
  const totalPayout     = rows
    .filter(t => t.status === 'released')
    .reduce((sum, t) => sum + parseFloat(t.seller_payout || 0), 0);

  return { totalGross, totalCommission, totalPayout, orders: rows };
}

// ============================================================
// FEES / EARNINGS / PAYOUTS TAB HANDLERS
// ============================================================

// ---- FEES TAB ----
async function loadFeesTab() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  const statusEl  = document.getElementById('currentFeeStatus');
  const historyEl = document.getElementById('feeHistoryList');
  if (!statusEl) return;

  if (!currentSellerId) {
    statusEl.innerHTML = '<p class="dash-empty">Please log in.</p>';
    return;
  }

  statusEl.innerHTML = '<p style="color:#888;font-size:14px;">Loading…</p>';

  // Load all fees for this seller
  const { data: fees, error } = await db
    .from('listing_fees')
    .select('*')
    .eq('seller_id', currentSellerId)
    .order('created_at', { ascending: false });

  if (error) {
    statusEl.innerHTML = '<p class="dash-empty">Could not load fee status.</p>';
    return;
  }

  const activeFee = fees?.find(f => f.status === 'active' && f.listings_used < f.max_listings);
  const pendingFee = fees?.find(f => f.status === 'proof_submitted' || f.status === 'pending_payment');

  if (activeFee) {
    const remaining = activeFee.max_listings - activeFee.listings_used;
    statusEl.innerHTML = `
      <div style="padding:16px;background:#e8f5e9;border-radius:10px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">✅</span>
        <div>
          <p style="font-weight:700;margin:0;font-size:15px;">Active — ${activeFee.tier.charAt(0).toUpperCase()+activeFee.tier.slice(1)} Tier</p>
          <p style="margin:4px 0 0;font-size:13px;color:#555;">${activeFee.listings_used}/${activeFee.max_listings} listings used · ${remaining} slot${remaining!==1?'s':''} remaining</p>
          ${activeFee.expires_at ? `<p style="margin:2px 0 0;font-size:12px;color:#888;">Expires: ${new Date(activeFee.expires_at).toLocaleDateString()}</p>` : ''}
        </div>
      </div>`;
  } else if (pendingFee) {
    statusEl.innerHTML = `
      <div style="padding:16px;background:#fff8e1;border-radius:10px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">⏳</span>
        <div>
          <p style="font-weight:700;margin:0;font-size:15px;">Payment Proof Submitted</p>
          <p style="margin:4px 0 0;font-size:13px;color:#555;">Awaiting admin verification. Your listings will activate once approved.</p>
        </div>
      </div>`;
  } else {
    statusEl.innerHTML = `
      <div style="padding:16px;background:#fce4ec;border-radius:10px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">⚠️</span>
        <div>
          <p style="font-weight:700;margin:0;font-size:15px;">No Active Listing Fee</p>
          <p style="margin:4px 0 0;font-size:13px;color:#555;">Choose a tier below and pay via GCash to start listing products.</p>
        </div>
      </div>`;
  }

  // Fee history
  if (historyEl) {
    if (!fees?.length) {
      historyEl.innerHTML = '<p style="color:#888;font-size:14px;">No fee payments yet.</p>';
    } else {
      historyEl.innerHTML = fees.map(f => `
        <div style="padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span style="font-weight:600;font-size:14px;">${f.tier.charAt(0).toUpperCase()+f.tier.slice(1)} Tier</span>
            <span style="font-size:13px;color:#888;margin-left:8px;">₱${parseFloat(f.amount_paid).toFixed(2)}</span>
            <p style="margin:2px 0 0;font-size:12px;color:#aaa;">${new Date(f.created_at).toLocaleDateString()}</p>
            ${f.rejection_reason ? `<p style="margin:2px 0 0;font-size:12px;color:#e74c3c;">Rejected: ${f.rejection_reason}</p>` : ''}
          </div>
          <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${
            f.status==='active'?'#d4edda':f.status==='proof_submitted'?'#cce5ff':f.status==='rejected'?'#f8d7da':f.status==='verified'?'#d4edda':'#fff3cd'
          };color:${
            f.status==='active'?'#155724':f.status==='proof_submitted'?'#004085':f.status==='rejected'?'#721c24':f.status==='verified'?'#155724':'#856404'
          };">${f.status==='active'?'✅ Active':f.status==='proof_submitted'?'📤 Pending Verification':f.status==='rejected'?'❌ Rejected':f.status==='verified'?'✅ Verified':'⏳ Pending'}</span>
        </div>`).join('');
    }
  }
}

// ---- SELECT FEE TIER ----
let _selectedTier = null;
const _tierPrices = { basic: 99, standard: 249, premium: 499 };

window.selectFeeTier = function(tier) {
  _selectedTier = tier;
  document.querySelectorAll('.fee-tier-card').forEach(card => {
    const isSelected = card.dataset.tier === tier;
    card.style.borderColor = isSelected ? '#c8a96e' : '#eee';
    card.style.background  = isSelected ? '#fdf8f0' : '#fff';
    card.style.transform   = isSelected ? 'scale(1.02)' : 'scale(1)';
  });

  const section = document.getElementById('feePaymentSection');
  const amountEl = document.getElementById('feePaymentAmount');
  const refEl    = document.getElementById('feePaymentRef');
  if (section) section.style.display = 'block';
  if (amountEl) amountEl.textContent = `₱${_tierPrices[tier]}`;
  if (refEl)    refEl.textContent    = `FEE-${Date.now().toString().slice(-6)}-${tier.toUpperCase()}`;
};

window.submitFeePayment = async function() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) { showError('Not Logged In', 'Please log in again.'); return; }
  if (!_selectedTier)   { showError('No Tier', 'Please select a tier first.'); return; }

  const proofInput = document.getElementById('feeProofInput');
  const file = proofInput?.files[0];
  if (!file) { showError('No Proof', 'Please upload your GCash payment screenshot.'); return; }
  if (!file.type.startsWith('image/')) { showError('Invalid File', 'Please upload an image file.'); return; }
  if (file.size > 5 * 1024 * 1024) { showError('File Too Large', 'Max 5MB.'); return; }

  showLoadingModal('Submitting…', 'Recording your fee payment request.');

  try {
    const config = { basic:{amount:99,max:3,days:30}, standard:{amount:249,max:10,days:60}, premium:{amount:499,max:25,days:90} };
    const c = config[_selectedTier];
    const ref = document.getElementById('feePaymentRef')?.textContent || `FEE-${Date.now()}`;

    // Ensure seller record exists
    const currentUser = authManager.getCurrentUser();
    await db.from('sellers').upsert({
      id: currentSellerId,
      business_name: currentUser?.name || currentUser?.email || 'Seller',
      email: currentUser?.email || '',
      verified: false
    }, { onConflict: 'id' });

    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + c.days);

    // Try with 'pending' status first (more compatible)
    const feeData = {
      seller_id:    currentSellerId,
      tier:         _selectedTier,
      amount_paid:  c.amount,
      max_listings: c.max,
      listings_used: 0,
      status:       'pending', // Use 'pending' status for better compatibility
      payment_method: 'gcash',
      payment_ref:  ref,
      expires_at:   expires_at.toISOString()
    };

    console.log('[seller] submitFeePayment: Inserting fee data:', feeData);

    // Insert fee record
    let { error } = await db.from('listing_fees').insert(feeData);
    
    if (error) {
      console.error('[seller] submitFeePayment: Insert error:', error);
      
      // If status constraint error, try with 'active' status
      if (error.message?.includes('status_check') || error.message?.includes('constraint')) {
        console.log('[seller] submitFeePayment: Retrying with active status...');
        feeData.status = 'active';
        ({ error } = await db.from('listing_fees').insert(feeData));
      }
      
      if (error) throw error;
    }
    
    // Store proof metadata only (not the full image to avoid quota issues)
    // Admin will verify payment through their GCash account
    try {
      const proofMetadata = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        reference: ref,
        tier: _selectedTier
      };
      localStorage.setItem(`rewear_fee_proof_meta_${currentSellerId}_${ref}`, JSON.stringify(proofMetadata));
      console.log('[seller] submitFeePayment: Proof metadata stored');
    } catch (storageErr) {
      // Non-fatal: proof metadata storage failed, but fee was recorded
      console.warn('[seller] submitFeePayment: Could not store proof metadata:', storageErr);
    }
    
    console.log('[seller] submitFeePayment: Fee submitted successfully');

    hideLoadingModal();
    showSuccess('Payment Submitted!', 'Your listing fee payment has been recorded. Admin will verify your GCash payment and activate your listing slots within 24 hours.', 'Got it');
    document.getElementById('feePaymentSection').style.display = 'none';
    proofInput.value = '';
    _selectedTier = null;
    document.querySelectorAll('.fee-tier-card').forEach(c => { c.style.borderColor='#eee'; c.style.background='#fff'; });
    loadFeesTab();
  } catch (err) {
    hideLoadingModal();
    console.error('[seller] submitFeePayment: Exception:', err);
    showError('Submission Failed', err.message || 'Could not submit fee payment. Please try again or contact support.');
  }
};

// ---- PURCHASE TIER BUTTON (legacy) ----
document.getElementById('purchaseTierBtn')?.addEventListener('click', async () => {
  const tier = document.querySelector('input[name="feeTier"]:checked')?.value;
  if (!tier) { showError('No Tier Selected', 'Please select a listing tier.'); return; }
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) { showError('Not Logged In', 'Please log in again.'); return; }
  showLoadingModal('Processing…', 'Recording your listing fee purchase.');
  const { data: fee, error } = await recordListingFee(currentSellerId, tier);
  hideLoadingModal();
  if (error) { showError('Purchase Failed', error.message); return; }
  showSuccess('Tier Purchased!', `You can now list up to ${fee.max_listings} products.`, 'Got it');
  await loadFeesTab();
});

// ---- EARNINGS TAB ----
async function loadEarningsTab() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  const listEl      = document.getElementById('sellerEarningsList');
  const grossEl     = document.getElementById('earningsTotalGross');
  const commissionEl = document.getElementById('earningsTotalCommission');
  const payoutEl    = document.getElementById('earningsTotalPayout');

  if (!listEl) return;
  if (!currentSellerId) { listEl.innerHTML = '<p class="dash-empty">Please log in.</p>'; return; }

  listEl.innerHTML = '<p class="dash-empty">Loading earnings…</p>';

  try {
    // Get all orders for this seller's products
    const { data: allOrders } = await db
      .from('orders')
      .select('*, products(name, seller_id)')
      .order('created_at', { ascending: false });

    const sellerOrders = (allOrders || []).filter(o =>
      o.products?.seller_id === currentSellerId &&
      ['confirmed', 'shipped', 'delivered', 'received'].includes(o.status)
    );

    const COMMISSION_RATE = 0.10; // 10% platform commission
    const totalGross      = sellerOrders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
    const totalCommission = totalGross * COMMISSION_RATE;
    const totalPayout     = totalGross - totalCommission;

    if (grossEl)      grossEl.textContent      = formatPHP(totalGross);
    if (commissionEl) commissionEl.textContent = formatPHP(totalCommission);
    if (payoutEl)     payoutEl.textContent     = formatPHP(totalPayout);

    if (sellerOrders.length === 0) {
      listEl.innerHTML = '<p class="dash-empty">No earnings yet. Earnings appear once orders are confirmed.</p>';
      return;
    }

    listEl.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr style="border-bottom:2px solid #e8d5b0;text-align:left;">
            <th style="padding:8px 12px;">Date & Time</th>
            <th style="padding:8px 12px;">Product</th>
            <th style="padding:8px 12px;">Gross</th>
            <th style="padding:8px 12px;">Commission (10%)</th>
            <th style="padding:8px 12px;">Net Payout</th>
            <th style="padding:8px 12px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${sellerOrders.map(o => {
            const gross      = parseFloat(o.total_price || 0);
            const commission = gross * COMMISSION_RATE;
            const payout     = gross - commission;
            const date       = new Date(o.created_at);
            const dateStr    = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
            return `
              <tr style="border-bottom:1px solid #f0e6d3;">
                <td style="padding:8px 12px;">${dateStr}</td>
                <td style="padding:8px 12px;">${o.products?.name || '—'}</td>
                <td style="padding:8px 12px;">${formatPHP(gross)}</td>
                <td style="padding:8px 12px;color:#e74c3c;">-${formatPHP(commission)}</td>
                <td style="padding:8px 12px;color:#27ae60;font-weight:600;">${formatPHP(payout)}</td>
                <td style="padding:8px 12px;"><span class="dash-order-status status-${o.status}">${getStatusLabel(o.status)}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;

  } catch (error) {
    listEl.innerHTML = '<p class="dash-empty">Could not load earnings.</p>';
    console.error('[seller] loadEarningsTab:', error);
  }
}

// ---- PAYOUTS TAB ----
async function loadPayoutsTab() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  const balanceEl = document.getElementById('pendingPayoutBalance');
  const historyEl = document.getElementById('payoutHistoryList');

  if (!balanceEl || !historyEl) return;

  if (!currentSellerId) {
    balanceEl.innerHTML = '<p class="dash-empty">Seller session not found. Please log in.</p>';
    historyEl.innerHTML = '';
    authManager.redirectToLogin();
    return;
  }

  balanceEl.innerHTML = '<p class="dash-empty">Loading…</p>';
  historyEl.innerHTML = '<p class="dash-empty">Loading…</p>';

  // Query released transactions (payout history)
  const { data: released, error: releasedError } = await db
    .from('transactions')
    .select('*')
    .eq('seller_id', currentSellerId)
    .eq('status', 'released')
    .order('released_at', { ascending: false });

  if (releasedError) {
    console.error('[seller] loadPayoutsTab (released):', releasedError.message);
    historyEl.innerHTML = '<p class="dash-empty">Could not load payout history.</p>';
  }

  // Query pending transactions to compute pending balance
  const { data: pending, error: pendingError } = await db
    .from('transactions')
    .select('seller_payout')
    .eq('seller_id', currentSellerId)
    .eq('status', 'pending');

  if (pendingError) {
    console.error('[seller] loadPayoutsTab (pending):', pendingError.message);
  }

  // Compute pending balance
  const pendingBalance = (pending || []).reduce((sum, t) => sum + parseFloat(t.seller_payout || 0), 0);

  // Render pending balance
  if (pendingBalance > 0) {
    balanceEl.innerHTML = `
      <div class="dash-verify-info">
        <div>
          <p class="dash-verify-title" style="font-size:1.5rem;">${formatPHP(pendingBalance)}</p>
          <p class="dash-verify-text">Awaiting release by admin after order delivery.</p>
        </div>
      </div>`;
  } else {
    balanceEl.innerHTML = '<p class="dash-empty">No pending payouts.</p>';
  }

  // Render payout history
  const releasedRows = released || [];
  if (releasedRows.length === 0) {
    historyEl.innerHTML = '<p class="dash-empty">No payout history yet.</p>';
    return;
  }

  historyEl.innerHTML = releasedRows.map(t => `
    <div class="dash-order-row">
      <div>
        <p class="dash-order-name">${formatPHP(t.seller_payout)} released</p>
        <p class="dash-order-meta">Gross: ${formatPHP(t.gross_amount)} &nbsp;·&nbsp; Commission: ${formatPHP(t.commission_amount)}</p>
        <p class="dash-order-meta">Released: ${t.released_at ? formatDate(t.released_at) : '—'}</p>
      </div>
      <span class="dash-order-status status-released">released</span>
    </div>`).join('');
}

// ---- ADD PRODUCT FORM ----
document.getElementById('addProductForm')?.addEventListener('submit', async e => {
  e.preventDefault();

  // Read seller ID from auth system (backward compatibility with sessionStorage)
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) {
    showError('Not Logged In', 'Could not find your seller session. Please log in again.');
    authManager.redirectToLogin();
    return;
  }

  const sizes = [...document.querySelectorAll('.size-selector input:checked')].map(cb => cb.value);

  // Get image URL from the modern image uploader (data URL or empty)
  const uploader = window.imageUploader || imageUploader;
  const uploadedImages = uploader?.getImages?.() || [];
  const uploadedImageUrl = uploadedImages.length > 0 ? uploadedImages[0].url : '';

  const payload = {
    name:             document.getElementById('newName').value.trim(),
    price:            parseFloat(document.getElementById('newPrice').value),
    category:         document.getElementById('newCategory').value,
    suggested_price:  parseFloat(document.getElementById('newSuggestedPrice').value) || null,
    image_url:        uploadedImageUrl,
    description:      document.getElementById('newDescription').value.trim(),
    sizes:            sizes.length ? sizes : ['S', 'M', 'L'],
    in_stock:         true
  };

  // Validate image URL is not a local file path
  if (payload.image_url) {
    const isLocalPath = payload.image_url.startsWith('file://') || 
                       payload.image_url.includes(':\\') || 
                       payload.image_url.includes('C:/') || 
                       payload.image_url.includes('Users/');
    
    if (isLocalPath) {
      showError('Invalid Image', 'Image must be uploaded through the form, not a local file path. Please use the image upload area above.');
      return;
    }
    
    // Check if it's a valid format (data URL, http/https, or relative path)
    const isValidFormat = payload.image_url.startsWith('data:image/') ||
                         payload.image_url.startsWith('http://') ||
                         payload.image_url.startsWith('https://') ||
                         payload.image_url.startsWith('/') ||
                         payload.image_url.startsWith('./') ||
                         payload.image_url.startsWith('../');
    
    if (!isValidFormat) {
      showError('Invalid Image Format', 'Please upload an image using the upload area above. Direct file paths are not supported.');
      return;
    }
  }

  // ✅ VALIDATION
  const { valid, errors } = validateObject(payload, {
    name: 'productName',
    price: 'price',
    category: 'category',
    image_url: 'imageUrl',
    sizes: 'sizes'
  });

  if (!valid) {
    showValidationErrors(errors);
    return;
  }

  // Validate optional suggested_price if provided
  if (payload.suggested_price && !validators.price(payload.suggested_price)) {
    showError('Validation Error', 'Suggested price must be a valid amount');
    return;
  }

  // Sanitize description
  if (payload.description) {
    const sanitized = validators.description(payload.description);
    if (sanitized === null) {
      showError('Validation Error', 'Description is too long (max 2000 characters)');
      return;
    }
    payload.description = sanitized;
  }

  showLoadingModal('Submitting…', 'Sending your listing for admin review.');
  const { data: product, error } = await submitListing(currentSellerId, payload);
  hideLoadingModal();

  if (error) {
    const msg = error.message || '';
    console.error('[seller] addProduct:', msg);

    if (msg.toLowerCase().includes('pending admin approval') || msg.toLowerCase().includes('not yet verified') || msg.toLowerCase().includes('rejected')) {
      showError('Account Not Verified', msg);
    } else if (msg.toLowerCase().includes('listing fee') || msg.toLowerCase().includes('no active')) {
      showError('Listing Fee Required', msg);
      document.querySelector('[data-tab="fees"]')?.click();
    } else {
      showError('Failed to Submit', msg);
    }
  } else {
    showSuccess('Listing Submitted!', 'Your listing has been submitted for admin review. It will appear in the shop once approved.', 'Got it');
    document.getElementById('addProductForm').reset();
    window.imageUploader?.reset?.();
  }
});

// ---- SELLER PROFILE LOAD ----
async function loadSellerProfile() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  const currentUser = authManager.getCurrentUser();
  if (!currentSellerId) return;

  try {
    const { data: seller, error } = await db
      .from('sellers')
      .select('business_name, email, phone, description, gcash_number, gcash_name')
      .eq('id', currentSellerId)
      .single();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    if (seller) {
      set('bizName',  seller.business_name);
      set('bizEmail', seller.email);
      set('bizPhone', seller.phone);
      set('bizDesc',  seller.description);
      // Load GCash from DB first, fall back to localStorage
      const lsGcash = JSON.parse(localStorage.getItem(`rewear_gcash_${currentSellerId}`) || '{}');
      set('bizGcashNumber', seller.gcash_number || lsGcash.gcash_number);
      set('bizGcashName',   seller.gcash_name   || lsGcash.gcash_name);
    } else {
      set('bizName',  currentUser?.name || '');
      set('bizEmail', currentUser?.email || '');
      const lsGcash = JSON.parse(localStorage.getItem(`rewear_gcash_${currentSellerId}`) || '{}');
      set('bizGcashNumber', lsGcash.gcash_number);
      set('bizGcashName',   lsGcash.gcash_name);
    }

  } catch (error) {
    console.error('[seller] loadSellerProfile:', error.message);
  }
}

// ---- SELLER PROFILE FORM ----
document.getElementById('sellerProfileForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) return;

  const payload = {
    business_name: document.getElementById('bizName').value.trim(),
    email:         document.getElementById('bizEmail').value.trim(),
    phone:         document.getElementById('bizPhone').value.trim(),
    description:   document.getElementById('bizDesc').value.trim()
  };

  const gcashNumber = document.getElementById('bizGcashNumber')?.value.trim();
  const gcashName   = document.getElementById('bizGcashName')?.value.trim();

  // Always save GCash to localStorage as fallback
  localStorage.setItem(`rewear_gcash_${currentSellerId}`, JSON.stringify({
    gcash_number: gcashNumber || '',
    gcash_name:   gcashName || ''
  }));

  // Try to save GCash to DB (requires 06_buyer_flow.sql)
  if (gcashNumber) {
    payload.gcash_number = gcashNumber;
    payload.gcash_name   = gcashName || '';
  }

  // ✅ VALIDATION
  const { valid, errors } = validateObject(payload, {
    business_name: 'businessName',
    email: 'email'
  });

  if (!valid) {
    showValidationErrors(errors);
    return;
  }

  if (payload.phone && !validators.phone(payload.phone)) {
    showError('Validation Error', validationMessages.phone);
    return;
  }

  if (payload.description) {
    const sanitized = validators.description(payload.description);
    if (sanitized === null) {
      showError('Validation Error', 'Description is too long (max 2000 characters)');
      return;
    }
    payload.description = sanitized;
  }

  showLoadingModal('Saving…', 'Updating your seller profile.');
  let { error } = await db.from('sellers').upsert({ id: currentSellerId, ...payload });

  // If gcash columns don't exist yet, retry without them
  if (error?.message?.includes('gcash')) {
    delete payload.gcash_number;
    delete payload.gcash_name;
    ({ error } = await db.from('sellers').upsert({ id: currentSellerId, ...payload }));
  }
  hideLoadingModal();
  
  if (error) {
    if (error.code === '23505') showError('Email Taken', 'This email is already registered as a seller.');
    else showError('Save Failed', error.message);
    console.error('[seller] saveProfile:', error.message);
  } else {
    showSuccess('Profile Saved!', 'Your seller profile has been updated.', 'Got it');
  }
});

// ---- MESSAGES TAB ----
let activeSellerChatId = null;

function formatChatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function loadSellerMessages() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) return;

  const pendingList  = document.getElementById('sellerPendingList');
  const activeList   = document.getElementById('sellerActiveList');
  if (!pendingList || !activeList) return;

  try {
    const { data, error } = await messagesDb
      .from('messages').select('*')
      .eq('seller_id', currentSellerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const pending  = (data || []).filter(m => !m.accepted && !m.rejected);
    const accepted = (data || []).filter(m => m.accepted);

    // Render pending list
    pendingList.innerHTML = pending.length ? pending.map(m => `
      <div class="chat-conv-item ${activeSellerChatId === m.id ? 'active' : ''}"
           onclick="openSellerChat('${m.id}')" data-msg-id="${m.id}">
        <div class="chat-conv-avatar">${m.buyer_name.charAt(0).toUpperCase()}</div>
        <div class="chat-conv-info">
          <div class="chat-conv-name">${m.buyer_name}</div>
          <div class="chat-conv-preview">${m.message.length > 35 ? m.message.slice(0,35)+'…' : m.message}</div>
        </div>
        <div class="chat-conv-time">${formatChatTime(m.created_at)}</div>
      </div>`).join('')
    : '<p style="padding:12px 16px;font-size:13px;color:#aaa;">No pending messages</p>';

    // Render active list
    activeList.innerHTML = accepted.length ? accepted.map(m => {
      const thread = Array.isArray(m.thread) ? m.thread : [];
      const last = thread.length ? thread[thread.length-1] : null;
      const preview = last ? last.text : (m.reply || m.message);
      const hasUnread = thread.some(t => t.role === 'buyer' && !t.read);
      return `
        <div class="chat-conv-item ${activeSellerChatId === m.id ? 'active' : ''} ${hasUnread ? 'unread' : ''}"
             onclick="openSellerChat('${m.id}')" data-msg-id="${m.id}">
          <div class="chat-conv-avatar">${m.buyer_name.charAt(0).toUpperCase()}</div>
          <div class="chat-conv-info">
            <div class="chat-conv-name">${m.buyer_name}</div>
            <div class="chat-conv-preview">${preview.length > 35 ? preview.slice(0,35)+'…' : preview}</div>
          </div>
          <div class="chat-conv-time">${formatChatTime(m.updated_at || m.created_at)}</div>
          ${hasUnread ? '<div class="chat-unread-dot"></div>' : ''}
        </div>`;
    }).join('')
    : '<p style="padding:12px 16px;font-size:13px;color:#aaa;">No active conversations</p>';

    // Re-open active chat if one was selected
    if (activeSellerChatId) openSellerChat(activeSellerChatId);

  } catch (err) {
    console.error('[seller] loadSellerMessages:', err);
  }
}

window.openSellerChat = async function(msgId) {
  activeSellerChatId = msgId;

  // Update active state in lists
  document.querySelectorAll('#sellerPendingList .chat-conv-item, #sellerActiveList .chat-conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.msgId === msgId);
  });

  // Show chat window
  document.getElementById('sellerChatEmptyState').style.display = 'none';
  document.getElementById('sellerChatActive').style.display = 'flex';

  // Fetch message
  const { data: msg } = await messagesDb.from('messages').select('*').eq('id', msgId).single();
  if (!msg) return;

  // Header
  document.getElementById('sellerChatHeader').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #eee;">
      <div style="width:36px;height:36px;border-radius:50%;background:#3498db;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">
        ${msg.buyer_name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div style="font-weight:700;font-size:15px;">${msg.buyer_name}</div>
        <div style="font-size:12px;color:#888;">${msg.buyer_email}</div>
      </div>
    </div>`;

  // Build chat bubbles
  const messagesEl = document.getElementById('sellerChatMessages');
  const thread = Array.isArray(msg.thread) ? msg.thread : [];
  const bubbles = [];

  // Buyer's first message
  bubbles.push(`
    <div class="chat-bubble-wrap from-seller" style="align-items:flex-start;">
      <div class="chat-bubble" style="background:#f0f0f0;color:#333;">${msg.message}</div>
      <div class="chat-bubble-meta">${msg.buyer_name} · ${formatChatTime(msg.created_at)}</div>
    </div>`);

  // Old-style single reply (backwards compat)
  if (thread.length === 0 && msg.reply) {
    bubbles.push(`
      <div class="chat-bubble-wrap from-buyer">
        <div class="chat-bubble">You: ${msg.reply}</div>
        <div class="chat-bubble-meta">${formatChatTime(msg.replied_at)}</div>
      </div>`);
  }

  // Thread messages
  thread.forEach(entry => {
    const isSeller = entry.role === 'seller';
    bubbles.push(`
      <div class="chat-bubble-wrap ${isSeller ? 'from-buyer' : 'from-seller'}" style="align-items:${isSeller ? 'flex-end' : 'flex-start'};">
        <div class="chat-bubble" style="${isSeller ? '' : 'background:#f0f0f0;color:#333;'}">${entry.text}</div>
        <div class="chat-bubble-meta">${isSeller ? 'You' : msg.buyer_name} · ${formatChatTime(entry.ts)}</div>
      </div>`);
  });

  messagesEl.innerHTML = bubbles.join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Show accept/reject or reply bar
  const acceptBar = document.getElementById('sellerAcceptBar');
  const replyBar  = document.getElementById('sellerReplyBar');
  if (msg.accepted) {
    if (acceptBar) acceptBar.style.display = 'none';
    if (replyBar)  replyBar.style.display  = 'flex';
  } else {
    if (acceptBar) acceptBar.style.display = 'flex';
    if (replyBar)  replyBar.style.display  = 'none';
  }
};

window.sellerAcceptCurrentChat = async function() {
  if (!activeSellerChatId) return;
  const { error } = await messagesDb.from('messages')
    .update({ accepted: true, accepted_at: new Date().toISOString() })
    .eq('id', activeSellerChatId);
  if (error) { showError('Error', error.message); return; }
  showSuccess('Chat Accepted!', 'You can now reply to this buyer.', 'Got it');
  loadSellerMessages();
};

window.sellerRejectCurrentChat = async function() {
  if (!activeSellerChatId) return;
  const reason = prompt('Reason for rejecting? (optional)') || '';
  const { error } = await messagesDb.from('messages')
    .update({ rejected: true, rejected_reason: reason })
    .eq('id', activeSellerChatId);
  if (error) { showError('Error', error.message); return; }
  activeSellerChatId = null;
  document.getElementById('sellerChatEmptyState').style.display = 'flex';
  document.getElementById('sellerChatActive').style.display = 'none';
  loadSellerMessages();
};

window.sendSellerReply = async function() {
  const input = document.getElementById('sellerReplyInput');
  const text  = input?.value.trim();
  if (!text || !activeSellerChatId) return;

  try {
    const { data: msg } = await messagesDb.from('messages').select('thread').eq('id', activeSellerChatId).single();
    const thread = Array.isArray(msg?.thread) ? msg.thread : [];
    thread.push({ role: 'seller', text, ts: new Date().toISOString() });

    const { error } = await messagesDb.from('messages')
      .update({ thread, reply: text, replied_at: new Date().toISOString() })
      .eq('id', activeSellerChatId);

    if (error) throw error;
    input.value = '';
    openSellerChat(activeSellerChatId);
    loadSellerMessages();
  } catch (err) {
    showError('Error', 'Could not send reply: ' + err.message);
  }
};

// Keep old sendReply for backwards compat
window.sendReply = window.sendSellerReply;

// ---- VERIFICATION STATUS ----
async function loadVerificationStatus() {
  const currentUser = authManager.getCurrentUser();
  const currentSellerId = currentUser?.id || sessionStorage.getItem('rewear_seller_id');
  const el = document.getElementById('verificationStatusContent');
  
  if (!el) return;

  try {
    let seller = null;

    // Try by ID first
    if (currentSellerId) {
      const { data } = await db
        .from('sellers')
        .select('verified, rejection_reason')
        .eq('id', currentSellerId)
        .single();
      seller = data;
    }

    // Fallback: try by email
    if (!seller && currentUser?.email) {
      const { data } = await db
        .from('sellers')
        .select('verified, rejection_reason')
        .eq('email', currentUser.email)
        .single();
      seller = data;
    }

    console.log('[seller] Verification status:', seller);

    if (seller?.verified === true) {
      el.innerHTML = `
        <div style="padding:16px;background:#e8f5e9;border-radius:10px;display:flex;gap:12px;align-items:center;">
          <span style="font-size:28px;">✅</span>
          <div>
            <p style="font-weight:700;margin:0;color:#155724;">Account Verified</p>
            <p style="margin:4px 0 0;font-size:13px;color:#555;">You are a verified seller. You can now list products and receive orders.</p>
          </div>
        </div>`;
    } else if (seller?.rejection_reason) {
      el.innerHTML = `
        <div style="padding:16px;background:#fce4ec;border-radius:10px;display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:28px;">❌</span>
          <div>
            <p style="font-weight:700;margin:0;color:#880e4f;">Application Rejected</p>
            <p style="margin:4px 0 0;font-size:13px;color:#555;">Reason: ${seller.rejection_reason}</p>
          </div>
        </div>`;
    } else {
      el.innerHTML = `
        <div style="padding:16px;background:#fff8e1;border-radius:10px;display:flex;gap:12px;align-items:center;">
          <span style="font-size:28px;">⏳</span>
          <div>
            <p style="font-weight:700;margin:0;">Pending Review</p>
            <p style="margin:4px 0 0;font-size:13px;color:#555;">Your seller application is being reviewed by our team.</p>
          </div>
        </div>`;
    }
  } catch (error) {
    console.error('[seller] loadVerificationStatus error:', error);
    el.innerHTML = `
      <div style="padding:16px;background:#f8d7da;border-radius:10px;display:flex;gap:12px;align-items:center;">
        <span style="font-size:28px;">⚠️</span>
        <div>
          <p style="font-weight:700;margin:0;color:#721c24;">Could not load status</p>
          <p style="margin:4px 0 0;font-size:13px;color:#555;">${error.message}</p>
        </div>
      </div>`;
  }
}

// ---- MARK AS SOLD ----
window.markAsSold = async function(productId) {
  if (!confirm('Mark this item as sold? It will be removed from the shop.')) return;
  try {
    const { error } = await db.from('products').update({ in_stock: false, status: 'approved' }).eq('id', productId);
    if (error) throw error;
    showSuccess('Marked as Sold', 'The item has been removed from the shop.', 'Got it');
    loadSellerListings();
  } catch (err) {
    showError('Error', 'Could not mark as sold: ' + err.message);
  }
};

// ---- SELLER MARKS ITEM SOLD (Transaction Complete) ----
window.sellerMarkItemSold = async function(orderId, productId) {
  if (!confirm('Confirm transaction is complete and mark item as sold?')) return;
  try {
    showLoadingModal('Completing Transaction…', 'Marking item as sold.');

    // Mark product as sold (out of stock)
    if (productId) {
      await db.from('products').update({ in_stock: false }).eq('id', productId);
    }

    // Update order status to 'sold' (use 'received' as final state)
    await db.from('orders').update({ status: 'received' }).eq('id', orderId);

    hideLoadingModal();
    showSuccess('Transaction Complete! 🎉', 'The item has been marked as sold. The transaction is now complete.', 'Done');
    loadSellerOrders();
    loadOverviewStats();
  } catch (err) {
    hideLoadingModal();
    showError('Error', 'Could not complete transaction: ' + err.message);
  }
};

// ---- ACCEPT ORDER ----
window.acceptOrder = async function(orderId) {
  if (!confirm('Accept this order? This confirms you will prepare the item.')) return;
  try {
    const { error } = await db.from('orders').update({ status: 'confirmed' }).eq('id', orderId);
    if (error) throw error;
    showSuccess('Order Accepted!', 'The buyer has been notified. Please prepare the item.', 'Got it');
    loadSellerOrders();
    loadOverviewStats();
  } catch (err) {
    showError('Error', 'Could not accept order: ' + err.message);
  }
};

// ---- INIT ----
// Wait for authManager to be available before initializing
if (window.authManager) {
  loadOverviewStats();
  loadVerificationStatus();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.authManager) {
      loadOverviewStats();
      loadVerificationStatus();
    }
  });
}

// ---- REAL-TIME SUBSCRIPTIONS ----
function startSellerRealtimeUpdates() {
  const currentUser = authManager?.getCurrentUser();
  if (!currentUser) return;

  // Real-time: new buyer messages coming in
  messagesDb
    .channel('seller-messages-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `seller_id=eq.${currentUser.id}`
    }, (payload) => {
      console.log('[realtime] Seller: message update:', payload);
      loadSellerMessages();
      // If this message is currently open, refresh the chat view
      if (activeSellerChatId === payload.new?.id) {
        openSellerChat(activeSellerChatId);
      }
    })
    .subscribe();

  // Real-time: order status changes
  db
    .channel('seller-orders-realtime')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `seller_id=eq.${currentUser.id}`
    }, (payload) => {
      console.log('[realtime] Seller: order updated:', payload);
      loadSellerOrders();
      loadOverviewStats();
    })
    .subscribe();

  console.log('[realtime] Seller real-time subscriptions started');
}

// Start real-time after a short delay to ensure auth is ready
setTimeout(() => {
  if (window.authManager?.getCurrentUser()) {
    startSellerRealtimeUpdates();
  }
}, 1500);

// ---- DEVELOPMENT HELPER FUNCTIONS ----
// These functions can be called from browser console for testing

// Clear all data for current seller (for testing purposes)
window.clearSellerData = async function() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) {
    console.log('No seller logged in');
    return;
  }
  
  console.log('Clearing data for seller:', currentSellerId);
  
  try {
    // Delete seller's products
    const { error: productsError } = await db.from('products').delete().eq('seller_id', currentSellerId);
    if (productsError) console.error('Error deleting products:', productsError);
    
    // Delete seller's orders (get all orders and delete those for seller's products)
    const { data: allOrdersToCheck } = await db
      .from('orders')
      .select(`
        id,
        products (
          seller_id
        )
      `);
      
    const sellerOrderIds = allOrdersToCheck?.filter(order => 
      order.products?.seller_id === currentSellerId
    ).map(order => order.id) || [];
      
    if (sellerOrderIds.length > 0) {
      const { error: ordersError } = await db.from('orders').delete().in('id', sellerOrderIds);
      if (ordersError) console.error('Error deleting orders:', ordersError);
    }
    
    // Delete seller's listing fees
    const { error: feesError } = await db.from('listing_fees').delete().eq('seller_id', currentSellerId);
    if (feesError) console.error('Error deleting listing fees:', feesError);
    
    console.log('Seller data cleared successfully');
    
    // Refresh the dashboard
    loadOverviewStats();
    loadSellerListings();
    loadSellerOrders();
    
  } catch (error) {
    console.error('Error clearing seller data:', error);
  }
};

// Check current seller's data count
window.checkSellerData = async function() {
  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) {
    console.log('No seller logged in');
    return;
  }
  
  console.log('Checking data for seller:', currentSellerId);
  
  try {
    const { count: productCount } = await db.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', currentSellerId);
    
    // Count orders through products relationship (client-side filtering)
    const { data: allOrdersToCount } = await db
      .from('orders')
      .select(`
        id,
        products (
          seller_id
        )
      `);
      
    const orderCount = allOrdersToCount?.filter(order => 
      order.products?.seller_id === currentSellerId
    ).length || 0;
    
    const { count: feeCount } = await db.from('listing_fees').select('*', { count: 'exact', head: true }).eq('seller_id', currentSellerId);
    
    console.log('Products:', productCount);
    console.log('Orders:', orderCount);
    console.log('Listing Fees:', feeCount);
    
  } catch (error) {
    console.error('Error checking seller data:', error);
  }
};
