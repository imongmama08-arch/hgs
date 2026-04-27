// ============================================================
// dashboard-seller.js — Seller dashboard logic
// Used on: dashboard-seller.html
// ============================================================

// Flag so script.js knows not to attach a duplicate form listener
window._dashboardSellerLoaded = true;

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

    // Query data filtered by current seller ID
    const { count: listingCount, error: listingError } = await db.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', currentSellerId);
    if (listingError) {
      console.error('[seller] loadOverviewStats: Listing count error:', listingError);
    }

    // Since orders.seller_id doesn't exist, we'll show all orders for now
    // In a real system, you'd need to add seller_id column or use a different relationship
    const { data: allOrders, error: orderError } = await db
      .from('orders')
      .select(`
        *,
        products (
          name,
          seller_id
        )
      `);

    // Filter orders for current seller on the client side
    const sellerOrders = allOrders?.filter(order => 
      order.products?.seller_id === currentSellerId
    ) || [];

    const orderCount = sellerOrders.length;
    
    if (orderError) {
      console.error('[seller] loadOverviewStats: Order count error:', orderError);
    }

    // Count pending orders
    const pendingCount = sellerOrders.filter(order => order.status === 'pending').length;

    console.log('[seller] loadOverviewStats: Query results:', {
      listingCount,
      orderCount,
      pendingCount
    });

    const el = id => document.getElementById(id);
    if (el('statListings')) el('statListings').textContent = listingCount ?? 0;
    if (el('statOrders'))   el('statOrders').textContent   = orderCount ?? 0;
    if (el('statPending'))  el('statPending').textContent  = pendingCount ?? 0;

    // Recent orders - get all orders and filter client-side since seller_id doesn't exist in orders table
    const { data: allRecentOrders, error: recentError } = await db
      .from('orders')
      .select(`
        *,
        products (
          name,
          seller_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20); // Get more to filter from

    // Filter for current seller's products
    const recentOrders = allRecentOrders?.filter(order => 
      order.products?.seller_id === currentSellerId
    ).slice(0, 5) || []; // Take first 5 after filtering
    if (recentError) {
      console.error('[seller] loadOverviewStats: Recent orders error:', recentError);
    }

    const list = document.getElementById('recentOrdersList');
    if (list) {
      list.innerHTML = recentOrders?.length
        ? recentOrders.map(o => enhancedOrderRowHTML(o)).join('')
        : '<p class="dash-empty">No orders yet.</p>';
    }

  } catch (error) {
    console.error('[seller] loadOverviewStats: Exception:', error);
    // Show error state
    const el = id => document.getElementById(id);
    if (el('statListings')) el('statListings').textContent = 'Error';
    if (el('statOrders'))   el('statOrders').textContent   = 'Error';
    if (el('statPending'))  el('statPending').textContent  = 'Error';
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
          const statusMap = {
            pending:  { label: '⏳ Pending Review', cls: 'tag-pending' },
            approved: { label: '✅ Approved',        cls: 'tag-approved' },
            rejected: { label: '❌ Rejected',         cls: 'tag-rejected' }
          };
          const st = statusMap[p.status] || { label: p.status, cls: 'tag-pending' };
          return `
          <div class="product-card" style="cursor:default">
            <div class="product-image">
              ${p.image_url
                ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">`
                : `<div style="width:100%;height:100%;background:#f5f0ea;display:flex;align-items:center;justify-content:center;font-size:32px;">📷</div>`}
            </div>
            <div class="product-info">
              <h3 class="product-name">${p.name}</h3>
              <p class="product-price">₱${parseFloat(p.price).toFixed(2)}</p>
              <div class="product-sizes">${(p.sizes||[]).map(s=>`<span class="size-tag">${s}</span>`).join('')}</div>
              <div style="margin-top:8px">
                <span class="tag ${st.cls}" style="font-size:12px;padding:4px 10px;border-radius:20px;font-weight:600;">${st.label}</span>
              </div>
              ${p.rejection_reason ? `<p style="font-size:12px;color:#c62828;margin-top:6px;background:#fce4ec;padding:6px 10px;border-radius:6px;">Reason: ${p.rejection_reason}</p>` : ''}
            </div>
          </div>`;
        }).join('')
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
  
  if (!currentSellerId) {
    list.innerHTML = '<p class="dash-empty">Seller session not found. Please log in.</p>';
    return;
  }

  const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
  
  // Get all orders and filter client-side since orders.seller_id doesn't exist
  let query = db
    .from('orders')
    .select(`
      *,
      products (
        name,
        seller_id,
        image_url
      )
    `)
    .order('created_at', { ascending: false });
    
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: allOrders, error } = await query;
  
  if (error) { 
    list.innerHTML = '<p class="dash-empty">Could not load orders.</p>'; 
    console.error('[seller] loadOrders:', error.message); 
    return; 
  }

  // Filter orders for current seller's products
  const sellerOrders = allOrders?.filter(order => 
    order.products?.seller_id === currentSellerId
  ) || [];

  list.innerHTML = sellerOrders.length ? sellerOrders.map(o => enhancedOrderRowHTML(o)).join('') : '<p class="dash-empty">No orders found for your products.</p>';
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
  const trackingData = JSON.parse(localStorage.getItem(`rewear_tracking_${o.id}`) || '{}');

  return `
    <div class="dash-order-row" data-order-id="${o.id}" data-status="${o.status}">
      <div class="order-main-info">
        <div class="order-buyer-info">
          <p class="dash-order-name">${o.buyer_name}</p>
          <p class="dash-order-meta"><strong>Product:</strong> ${productName}</p>
          <p class="dash-order-meta">${o.buyer_email}</p>
          <p class="dash-order-meta">Size: ${o.size_selected || '—'} · Qty: ${o.quantity || 1} · ₱${parseFloat(o.total_price||0).toFixed(2)}</p>
          <p class="dash-order-meta">Order ID: ${o.id} · ${new Date(o.created_at).toLocaleDateString()} ${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
        
        <div class="order-status-section">
          <div class="current-status">
            <span class="dash-order-status status-${o.status.replace(/_/g, '-')}">${getStatusLabel(o.status)}</span>
          </div>
          
          <div class="order-actions">
            <select class="status-update-select" data-order-id="${o.id}" data-current-status="${o.status}">
              <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
              <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>

            ${showTracking ? `
            <div class="tracking-info" style="margin-top:8px;">
              <input type="text" class="tracking-number-input dash-search" 
                     placeholder="Tracking Number" 
                     value="${trackingData.tracking_number || ''}"
                     data-order-id="${o.id}"
                     style="margin-bottom:6px;">
              <input type="text" class="courier-name-input dash-search" 
                     placeholder="Courier (e.g. LBC, J&T, Grab)" 
                     value="${trackingData.courier_name || ''}"
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

    const { data, error } = await db
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
      .select();
      
    if (error) {
      console.error('[seller] updateOrderStatus DB error:', error);
      throw error;
    }

    // Save tracking info to localStorage
    const orderRow = document.querySelector(`.dash-order-row[data-order-id="${orderId}"]`);
    if (orderRow) {
      const trackingNumber = orderRow.querySelector('.tracking-number-input')?.value.trim();
      const courierName    = orderRow.querySelector('.courier-name-input')?.value.trim();
      if (trackingNumber || courierName) {
        localStorage.setItem(`rewear_tracking_${orderId}`, JSON.stringify({
          tracking_number: trackingNumber || '',
          courier_name:    courierName || '',
          updated_at:      new Date().toISOString()
        }));
        console.log('[seller] Tracking info saved:', { trackingNumber, courierName });
      }

      // Update badge in-place immediately
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

    // For now, skip listing fee check to test the basic flow
    // TODO: Re-enable listing fee check after testing
    /*
    const { available, fee, reason } = await checkListingFeeAvailability(seller_id);
    
    if (!available) {
      console.log('[seller] submitListing: No active listing fee:', reason);
      return { data: null, error: new Error(reason || 'No active listing fee found.') };
    }
    */

    // Step 2: Insert the product with 'pending' status for admin approval
    console.log('[seller] submitListing: Inserting product...');
    const { data: product, error: insertError } = await db
      .from('products')
      .insert({
        seller_id: seller_id,
        name: productPayload.name,
        price: productPayload.price,
        category: productPayload.category,
        image_url: productPayload.image_url,
        description: productPayload.description || '',
        sizes: productPayload.sizes,
        suggested_price: productPayload.suggested_price,
        in_stock: false, // Will be set to true when admin approves
        status: 'pending' // Requires admin approval
      })
      .select()
      .single();

    if (insertError) {
      console.error('[seller] submitListing (insert):', insertError.message);
      return { data: null, error: insertError };
    }

    console.log('[seller] submitListing: Product created successfully:', product);

    // Skip fee update for now
    /*
    // Update the listing fee usage count
    const { error: updateFeeError } = await db
      .from('listing_fees')
      .update({ 
        listings_used: fee.listings_used + 1 
      })
      .eq('id', fee.id);

    if (updateFeeError) {
      console.error('[seller] submitListing (update fee):', updateFeeError.message);
      // Non-fatal error - product was created successfully
    }
    */

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
  const statusEl = document.getElementById('currentFeeStatus');
  if (!statusEl) return;

  if (!currentSellerId) {
    statusEl.innerHTML = '<p class="dash-empty">Seller session not found. Please log in.</p>';
    authManager.redirectToLogin();
    return;
  }

  statusEl.innerHTML = '<p class="dash-empty">Loading fee status…</p>';

  const { available, fee, reason } = await checkListingFeeAvailability(currentSellerId);

  if (available && fee) {
    const remaining = fee.max_listings - fee.listings_used;
    const expiryText = fee.expires_at
      ? `Expires: ${formatDate(fee.expires_at)}`
      : 'No expiry';
    statusEl.innerHTML = `
      <div class="dash-verify-info">
        <div class="dash-verify-icon">✓</div>
        <div>
          <p class="dash-verify-title">Active — ${fee.tier.charAt(0).toUpperCase() + fee.tier.slice(1)} Tier</p>
          <p class="dash-verify-text">Listings used: ${fee.listings_used} / ${fee.max_listings} &nbsp;·&nbsp; ${remaining} slot${remaining !== 1 ? 's' : ''} remaining</p>
          <p class="dash-verify-text">${expiryText}</p>
        </div>
      </div>`;
  } else {
    statusEl.innerHTML = `
      <div class="dash-verify-info">
        <div class="dash-verify-icon" style="color:#c0392b;">✕</div>
        <div>
          <p class="dash-verify-title">No Active Listing Fee</p>
          <p class="dash-verify-text">${reason || 'Please purchase a listing tier to start listing products.'}</p>
        </div>
      </div>`;
  }
}

// ---- PURCHASE TIER BUTTON ----
document.getElementById('purchaseTierBtn')?.addEventListener('click', async () => {
  const tier = document.querySelector('input[name="feeTier"]:checked')?.value;
  if (!tier) {
    showError('No Tier Selected', 'Please select a listing tier before purchasing.');
    return;
  }

  // ✅ VALIDATION
  if (!validators.tier(tier)) {
    showError('Invalid Tier', 'Please select a valid listing tier (Basic, Standard, or Premium).');
    return;
  }

  const currentSellerId = authManager.getCurrentUser()?.id || sessionStorage.getItem('rewear_seller_id');
  if (!currentSellerId) {
    showError('Not Logged In', 'Seller session not found. Please log in again.');
    authManager.redirectToLogin();
    return;
  }

  // ✅ VALIDATION
  if (!validators.uuid(currentSellerId)) {
    showError('Invalid Session', 'Your session ID is invalid. Please log in again.');
    sessionStorage.removeItem('rewear_seller_id');
    return;
  }

  const btn = document.getElementById('purchaseTierBtn');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  showLoadingModal('Processing…', 'Recording your listing fee purchase.');
  const { data: fee, error } = await recordListingFee(currentSellerId, tier);
  hideLoadingModal();

  btn.disabled = false;
  btn.textContent = 'Purchase Tier';

  if (error) {
    showError('Purchase Failed', error.message);
    console.error('[seller] purchaseTier:', error.message);
  } else {
    showSuccess(
      'Tier Purchased!',
      `You can now list up to ${fee.max_listings} product${fee.max_listings !== 1 ? 's' : ''} with your ${fee.tier.charAt(0).toUpperCase() + fee.tier.slice(1)} tier.`,
      'Got it'
    );
    // Refresh fee status display
    await loadFeesTab();
  }
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

  const sizes = [...document.querySelectorAll('.size-checkboxes input:checked')].map(cb => cb.value);
  const payload = {
    name:             document.getElementById('newName').value.trim(),
    price:            parseFloat(document.getElementById('newPrice').value),
    category:         document.getElementById('newCategory').value,
    suggested_price:  parseFloat(document.getElementById('newSuggestedPrice').value) || null,
    image_url:        document.getElementById('newImageUrl').value.trim(),
    description:      document.getElementById('newDescription').value.trim(),
    sizes:            sizes.length ? sizes : ['S', 'M', 'L'],
    in_stock:         true
  };

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

    if (msg.toLowerCase().includes('not yet verified')) {
      // Error Scenario 5: seller not yet verified
      showError('Not Verified', 'Your seller account is pending admin approval.');
    } else if (msg.toLowerCase().includes('listing fee') || msg.toLowerCase().includes('no active')) {
      // Error Scenarios 1 & 2: no active fee or fee expired/exhausted
      showError('Cannot List', msg, 'Go to Fees');
      // Redirect to Fees tab
      document.querySelector('[data-tab="fees"]')?.click();
    } else {
      showError('Failed to Submit', msg);
    }
  } else {
    showSuccess('Listing Submitted!', 'Listing submitted for admin review.', 'Got it');
    document.getElementById('addProductForm').reset();
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
      .select('business_name, email, phone, description')
      .eq('id', currentSellerId)
      .single();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    if (seller) {
      set('bizName',  seller.business_name);
      set('bizEmail', seller.email);
      set('bizPhone', seller.phone);
      set('bizDesc',  seller.description);
    } else {
      // No DB record yet — pre-fill from local auth
      set('bizName',  currentUser?.name || '');
      set('bizEmail', currentUser?.email || '');
    }

    // Load GCash info from localStorage (stored by seller in their profile)
    const gcashData = JSON.parse(localStorage.getItem(`rewear_gcash_${currentSellerId}`) || '{}');
    set('bizGcashNumber', gcashData.gcash_number);
    set('bizGcashName',   gcashData.gcash_name);

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
    // gcash_number and gcash_name not yet in DB schema
  };

  // Save GCash info to localStorage (DB columns don't exist yet)
  // Use email as key so it survives across sessions on same browser
  const gcashNumber = document.getElementById('bizGcashNumber')?.value.trim();
  const gcashName   = document.getElementById('bizGcashName')?.value.trim();
  const gcashKey = `rewear_gcash_${currentSellerId}`;
  localStorage.setItem(gcashKey, JSON.stringify({
    gcash_number: gcashNumber || '',
    gcash_name:   gcashName || ''
  }));
  console.log('[seller] GCash info saved to localStorage:', { gcashNumber, gcashName });

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
  const { error } = await db.from('sellers').upsert({ id: currentSellerId, ...payload });
  hideLoadingModal();
  
  if (error) {
    if (error.code === '23505') showError('Email Taken', 'This email is already registered as a seller.');
    else showError('Save Failed', error.message);
    console.error('[seller] saveProfile:', error.message);
  } else {
    showSuccess('Profile Saved!', 'Your seller profile has been updated.', 'Got it');
  }
});

// ---- INIT ----
loadOverviewStats();

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
