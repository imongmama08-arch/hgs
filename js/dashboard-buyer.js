// ============================================================
// dashboard-buyer.js — Buyer dashboard logic
// Used on: dashboard-buyer.html
// ============================================================

// ---- TAB SWITCHING ----
document.querySelectorAll('.dash-nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    console.log('[buyer] Tab clicked:', tab);
    document.querySelectorAll('.dash-nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    link.classList.add('active');
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
    const titleEl = document.getElementById('dashPageTitle');
    if (titleEl) titleEl.textContent = link.textContent.trim();
    
    if (tab === 'orders')   loadBuyerOrders();
    if (tab === 'addresses') loadBuyerAddresses();
    if (tab === 'messages') {
      console.log('[buyer] Messages tab activated, calling loadBuyerMessages()');
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        loadBuyerMessages();
      }, 100);
    }
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
      .select('*, products(id, name, image_url)')
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
  const productName  = o.products?.name || 'Product';
  const productImage = o.products?.image_url || '';
  const lsTracking = JSON.parse(localStorage.getItem(`rewear_tracking_${o.id}`) || '{}');
  const courierName    = o.courier_name    || lsTracking.courier_name    || null;
  const trackingNumber = o.tracking_number || lsTracking.tracking_number || null;
  const hasTracking    = courierName || trackingNumber;
  const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';

  // Flow status banner
  const flowBanners = {
    pending:   { bg:'#fff8e1', color:'#856404', icon:'⏳', text:'Waiting for your payment proof upload' },
    confirmed: { bg:'#e8f5e9', color:'#1b5e20', icon:'✅', text:'Payment verified — seller is preparing your item' },
    shipped:   { bg:'#e3f2fd', color:'#0d47a1', icon:'🚚', text:'Your order is on the way!' },
    delivered: { bg:'#f3e5f5', color:'#4a148c', icon:'🎉', text:'Order delivered — please confirm receipt to complete the transaction' },
    received:  { bg:'#e8f5e9', color:'#1b5e20', icon:'🏁', text:'Transaction complete — thank you for shopping on REWEAR!' },
    cancelled: { bg:'#fce4ec', color:'#880e4f', icon:'❌', text:'Order cancelled' }
  };
  const pStatus = o.payment_status;
  let banner = flowBanners[o.status] || { bg:'#f5f5f5', color:'#333', icon:'•', text: o.status };

  // Override banner for payment_status
  if (pStatus === 'submitted' && o.status === 'pending') {
    banner = { bg:'#e3f2fd', color:'#0d47a1', icon:'📤', text:'Payment proof submitted — awaiting admin verification' };
  } else if (pStatus === 'rejected') {
    banner = { bg:'#fce4ec', color:'#880e4f', icon:'❌', text:`Payment rejected${o.payment_rejected_reason ? ': ' + o.payment_rejected_reason : ''}` };
  }

  return `
    <div class="dash-order-row" data-order-id="${o.id}">
      <div style="display:flex;align-items:flex-start;gap:12px;flex:1;">
        ${productImage ? `<img src="${productImage}" alt="${productName}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;flex-shrink:0;">` : ''}
        <div style="flex:1;">
          <p class="dash-order-name">${productName}</p>
          <p class="dash-order-meta">Size: ${o.size_selected || '—'} · ${formatPHP(o.total_price || 0)}</p>
          <p class="dash-order-meta">${formatDate(o.created_at)}</p>

          <!-- Flow status banner -->
          <div style="margin-top:6px;padding:8px 10px;background:${banner.bg};border-radius:6px;font-size:13px;color:${banner.color};font-weight:500;">
            ${banner.icon} ${banner.text}
          </div>

          ${hasTracking ? `
          <div style="margin-top:6px;padding:8px;background:#f0f9f0;border-radius:6px;font-size:13px;">
            <strong>📦 Tracking Info</strong><br>
            ${courierName    ? `Courier: ${courierName}<br>` : ''}
            ${trackingNumber ? `Tracking #: <strong>${trackingNumber}</strong>` : ''}
          </div>` : ''}

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            <a href="${prefix}order-tracking.html?id=${o.id}"
              style="padding:7px 14px;background:#f5f5f5;color:#333;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;">
              🔍 Track Order
            </a>
            ${o.status === 'delivered' ? `
            <button onclick="confirmReceipt('${o.id}')"
                    style="padding:7px 14px;background:#27ae60;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              ✓ Confirm Receipt
            </button>` : ''}
            ${o.status === 'received' ? `
            <button onclick="openReviewModal('${o.id}', '${(productName).replace(/'/g,"\\'")}', '${o.products?.id || ''}')"
                    style="padding:7px 14px;background:#c8a96e;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              ⭐ Leave Review
            </button>` : ''}
          </div>
        </div>
      </div>
      <span class="dash-order-status status-${o.status}">${o.status.replace(/_/g,' ')}</span>
    </div>`;
}

async function confirmReceipt(orderId) {
  if (!confirm('Confirm that you have received this order?')) return;
  
  try {
    // Try with received_at first (requires 06_buyer_flow.sql)
    let error;
    ({ error } = await db.from('orders').update({
      status: 'received',
      received_at: new Date().toISOString()
    }).eq('id', orderId));

    if (error?.message?.includes('received_at')) {
      ({ error } = await db.from('orders').update({ status: 'received' }).eq('id', orderId));
    }
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
    .select('*, products(id, name, image_url)')
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

// ---- MESSAGES / CHAT TAB ----
let activeChatId = null; // currently open message thread id

async function loadBuyerMessages() {
  const currentUser = authManager.getCurrentUser();
  console.log('[buyer] loadBuyerMessages: Current user:', currentUser);
  
  if (!currentUser) {
    console.error('[buyer] loadBuyerMessages: No current user found');
    return;
  }

  const convList = document.getElementById('chatConvList');
  if (!convList) {
    console.error('[buyer] loadBuyerMessages: chatConvList element not found');
    return;
  }
  convList.innerHTML = '<p style="padding:20px;font-size:13px;color:#aaa;">Loading…</p>';

  // Check if messagesDb is available
  if (typeof messagesDb === 'undefined' || !messagesDb) {
    console.error('[buyer] loadBuyerMessages: messagesDb is not defined!');
    convList.innerHTML = '<p class="dash-empty" style="padding:20px;color:#e74c3c;">Message system not initialized. Please refresh the page.</p>';
    return;
  }

  try {
    console.log('[buyer] loadBuyerMessages: Querying messages for email:', currentUser.email);
    console.log('[buyer] loadBuyerMessages: Using messagesDb:', messagesDb);
    
    // DEBUG: Check ALL messages in the database first
    const { data: allMessages, error: debugError } = await messagesDb
      .from('messages')
      .select('*');
    
    console.log('[buyer] loadBuyerMessages: ALL messages in database:', allMessages);
    console.log('[buyer] loadBuyerMessages: Total messages in DB:', allMessages?.length || 0);
    if (allMessages && allMessages.length > 0) {
      console.log('[buyer] loadBuyerMessages: Sample message emails:', 
        allMessages.map(m => ({ id: m.id, buyer_email: m.buyer_email, message: m.message?.substring(0, 30) }))
      );
    }
    
    // Use messagesDb for messages (separate Supabase project)
    // Note: products and sellers tables don't exist in messages DB, so we can't join
    const { data, error } = await messagesDb
      .from('messages')
      .select('*')
      .eq('buyer_email', currentUser.email)
      .order('created_at', { ascending: false });

    console.log('[buyer] loadBuyerMessages: Query result for', currentUser.email, ':', { data, error });

    if (error) {
      console.error('[buyer] loadBuyerMessages: Database error:', error);
      throw error;
    }

    if (!data?.length) {
      console.log('[buyer] loadBuyerMessages: No messages found');
      convList.innerHTML = '<p class="dash-empty" style="padding:20px;font-size:13px;">No conversations yet.<br>Click <strong>+ New</strong> to message a seller.</p>';
      return;
    }

    console.log('[buyer] loadBuyerMessages: Found', data.length, 'messages');

    convList.innerHTML = data.map(m => {
      // Use seller_id directly since we can't join with sellers table
      const sellerName  = m.seller_id ? `Seller ${m.seller_id.substring(0, 8)}` : 'Seller';
      const lastMsg     = m.reply || m.message;
      const isUnread    = m.reply && !m.is_read;
      const initial     = 'S'; // S for Seller
      const time        = formatChatTime(m.reply ? m.replied_at : m.created_at);
      
      // Status indicator
      let statusBadge = '';
      if (m.rejected) {
        statusBadge = '<span style="font-size:11px;color:#e74c3c;font-weight:600;">✕ Rejected</span>';
      } else if (m.reply) {
        statusBadge = '<span style="font-size:11px;color:#27ae60;font-weight:600;">✓ Replied</span>';
      } else if (m.accepted) {
        statusBadge = '<span style="font-size:11px;color:#3498db;font-weight:600;">✓ Accepted</span>';
      } else {
        statusBadge = '<span style="font-size:11px;color:#c8a96e;font-weight:600;">⏳ Pending</span>';
      }

      return `
        <div class="chat-conv-item ${isUnread ? 'unread' : ''} ${activeChatId === m.id ? 'active' : ''}"
             onclick="openChat('${m.id}')" data-msg-id="${m.id}">
          <div class="chat-conv-avatar">${initial}</div>
          <div class="chat-conv-info">
            <div class="chat-conv-name">${sellerName}</div>
            <div class="chat-conv-preview">${lastMsg.length > 40 ? lastMsg.slice(0,40)+'…' : lastMsg}</div>
            <div style="margin-top:4px;">${statusBadge}</div>
          </div>
          <div class="chat-conv-time">${time}</div>
          ${isUnread ? '<div class="chat-unread-dot"></div>' : ''}
        </div>`;
    }).join('');

    console.log('[buyer] loadBuyerMessages: Messages rendered successfully');

    // Re-open active chat if one was selected
    if (activeChatId) openChat(activeChatId, data);

  } catch (err) {
    convList.innerHTML = '<p class="dash-empty" style="padding:20px;">Could not load messages.</p>';
    console.error('[buyer] loadBuyerMessages: Exception:', err);
  }
}

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

async function openChat(msgId, cachedData) {
  activeChatId = msgId;

  document.querySelectorAll('.chat-conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.msgId === msgId);
  });

  const emptyState = document.getElementById('chatEmptyState');
  const chatActive = document.getElementById('chatActive');
  if (emptyState) emptyState.style.display = 'none';
  if (chatActive) chatActive.style.display = 'flex';

  // Always fetch fresh data
  const { data: msg } = await messagesDb
    .from('messages')
    .select('*')
    .eq('id', msgId)
    .single();

  if (!msg) return;

  const currentUser = authManager.getCurrentUser();
  const sellerName = msg.seller_id ? `Seller ${msg.seller_id.substring(0, 8)}` : 'Seller';

  // Header
  const header = document.getElementById('chatWindowHeader');
  if (header) {
    header.innerHTML = `
      <div style="width:38px;height:38px;border-radius:50%;background:#c8a96e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;">S</div>
      <div><div style="font-weight:700;font-size:15px;">${sellerName}</div></div>`;
  }

  // Build thread from: original message + thread array
  const messagesEl = document.getElementById('chatMessages');
  if (messagesEl) {
    const bubbles = [];

    // First message (buyer's original)
    bubbles.push(`
      <div class="chat-bubble-wrap from-buyer">
        <div class="chat-bubble">${msg.message}</div>
        <div class="chat-bubble-meta">${formatChatTime(msg.created_at)}</div>
      </div>`);

    // Thread messages (subsequent back-and-forth)
    const thread = Array.isArray(msg.thread) ? msg.thread : [];
    thread.forEach(entry => {
      const isBuyer = entry.role === 'buyer';
      bubbles.push(`
        <div class="chat-bubble-wrap ${isBuyer ? 'from-buyer' : 'from-seller'}">
          <div class="chat-bubble">${entry.text}</div>
          <div class="chat-bubble-meta">${isBuyer ? 'You' : sellerName} · ${formatChatTime(entry.ts)}</div>
        </div>`);
    });

    // If no thread yet but has old-style reply, show it
    if (thread.length === 0 && msg.reply) {
      bubbles.push(`
        <div class="chat-bubble-wrap from-seller">
          <div class="chat-bubble">${msg.reply}</div>
          <div class="chat-bubble-meta">${sellerName} · ${formatChatTime(msg.replied_at)}</div>
        </div>`);
    }

    messagesEl.innerHTML = bubbles.join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Input bar — hide only if not accepted
  const inputBar = document.querySelector('.chat-input-bar');
  document.getElementById('chatAcceptanceHint')?.remove();

  if (inputBar) {
    if (!msg.accepted) {
      inputBar.style.display = 'none';
      const hintEl = document.createElement('p');
      hintEl.id = 'chatAcceptanceHint';
      hintEl.style.cssText = 'text-align:center;padding:16px;font-size:13px;color:#c8a96e;border-top:1px solid #eee;background:#fffbf0;font-weight:600;margin:0;';
      hintEl.textContent = '⏳ Waiting for seller to accept your message...';
      document.getElementById('chatActive').appendChild(hintEl);
    } else {
      inputBar.style.display = 'flex';
    }
  }

  // Mark as read
  if (!msg.is_read) {
    messagesDb.from('messages').update({ is_read: true }).eq('id', msgId);
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text  = input?.value.trim();
  if (!text || !activeChatId) return;

  const currentUser = authManager.getCurrentUser();
  if (!currentUser) return;

  try {
    // Fetch current thread
    const { data: msg } = await messagesDb
      .from('messages')
      .select('thread')
      .eq('id', activeChatId)
      .single();

    const thread = Array.isArray(msg?.thread) ? msg.thread : [];
    thread.push({ role: 'buyer', text, ts: new Date().toISOString() });

    const { error } = await messagesDb
      .from('messages')
      .update({ thread })
      .eq('id', activeChatId);

    if (error) throw error;
    input.value = '';
    // Refresh chat view
    openChat(activeChatId);
    loadBuyerMessages();
  } catch (err) {
    console.error('[chat] sendChatMessage:', err);
    showError('Error', 'Could not send message.');
  }
}

window.openNewInquiryModal = function() {
  // Remove existing overlay if any
  document.getElementById('newInquiryOverlay')?.remove();

  const currentUser = authManager.getCurrentUser();
  const overlay = document.createElement('div');
  overlay.id = 'newInquiryOverlay';
  overlay.className = 'new-inquiry-overlay';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:460px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 4px;font-size:18px;">New Message</h3>
      <p style="color:#888;font-size:13px;margin:0 0 20px;">Send an inquiry to a seller about a product</p>

      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Seller Name / Shop</label>
        <input id="niSellerSearch" type="text" placeholder="Search seller by name…"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"
          oninput="searchSellersForInquiry(this.value)">
        <div id="niSellerResults" style="border:1px solid #eee;border-radius:8px;margin-top:4px;max-height:140px;overflow-y:auto;display:none;"></div>
        <input type="hidden" id="niSellerId">
        <div id="niSellerChosen" style="display:none;margin-top:6px;padding:8px 12px;background:#fdf8f0;border-radius:8px;font-size:13px;font-weight:600;color:#c8a96e;"></div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Product (optional)</label>
        <input id="niProduct" type="text" placeholder="Which product are you asking about?"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
      </div>

      <div style="margin-bottom:20px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Message</label>
        <textarea id="niMessage" rows="4" placeholder="Ask about sizing, availability, condition…"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
      </div>

      <div style="display:flex;gap:12px;">
        <button onclick="submitNewInquiry()"
          style="flex:1;padding:12px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
          Send Message
        </button>
        <button onclick="document.getElementById('newInquiryOverlay').remove()"
          style="padding:12px 20px;background:#f5f5f5;color:#333;border:none;border-radius:8px;font-size:15px;cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};

let _sellerSearchTimer;
window.searchSellersForInquiry = function(query) {
  clearTimeout(_sellerSearchTimer);
  const results = document.getElementById('niSellerResults');
  if (!query || query.length < 2) { results.style.display = 'none'; return; }

  _sellerSearchTimer = setTimeout(async () => {
    const { data } = await db
      .from('sellers')
      .select('id, business_name')
      .ilike('business_name', `%${query}%`)
      .eq('verified', true)
      .limit(6);

    if (!data?.length) {
      results.innerHTML = '<p style="padding:10px;font-size:13px;color:#aaa;">No sellers found.</p>';
      results.style.display = 'block';
      return;
    }

    results.style.display = 'block';
    results.innerHTML = data.map(s => `
      <div onclick="selectSellerForInquiry('${s.id}','${s.business_name.replace(/'/g,"\\'")}') "
        style="padding:10px 14px;cursor:pointer;font-size:14px;border-bottom:1px solid #f5f5f5;"
        onmouseover="this.style.background='#fdf8f0'" onmouseout="this.style.background=''">
        ${s.business_name}
      </div>`).join('');
  }, 300);
};

window.selectSellerForInquiry = function(id, name) {
  document.getElementById('niSellerId').value = id;
  document.getElementById('niSellerSearch').value = name;
  document.getElementById('niSellerResults').style.display = 'none';
  const chosen = document.getElementById('niSellerChosen');
  chosen.textContent = '✓ ' + name;
  chosen.style.display = 'block';
};

window.submitNewInquiry = async function() {
  const sellerId = document.getElementById('niSellerId')?.value;
  const product  = document.getElementById('niProduct')?.value.trim();
  const message  = document.getElementById('niMessage')?.value.trim();
  const currentUser = authManager.getCurrentUser();

  if (!sellerId) { alert('Please select a seller.'); return; }
  if (!message)  { alert('Please enter a message.'); return; }
  if (!currentUser) { alert('Please log in first.'); return; }

  try {
    console.log('[submitNewInquiry] Using buyer email:', currentUser.email);
    
    const payload = {
      seller_id:   sellerId,
      buyer_name:  currentUser.name || currentUser.email,
      buyer_email: currentUser.email, // Use logged-in user's email consistently
      message
    };

    console.log('[submitNewInquiry] Sending message:', payload);

    const { error } = await messagesDb.from('messages').insert(payload);
    if (error) throw error;

    document.getElementById('newInquiryOverlay')?.remove();
    showSuccess('Message Sent!', 'Your inquiry has been sent to the seller.', 'Got it');
    loadBuyerMessages();
  } catch (err) {
    console.error('[chat] submitNewInquiry:', err);
    alert('Could not send message: ' + err.message);
  }
};

// ---- REVIEW MODAL (shared with order-tracking) ----
window.openReviewModal = function(orderId, productName, productId) {
  const overlay = document.createElement('div');
  overlay.id = 'reviewOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 4px;">Leave a Review</h3>
      <p style="color:#888;font-size:14px;margin:0 0 20px;">${productName}</p>
      <div style="margin-bottom:16px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:8px;">Rating</label>
        <div id="starPicker" style="display:flex;gap:8px;font-size:28px;cursor:pointer;">
          ${[1,2,3,4,5].map(n => `<span data-star="${n}" style="color:#ddd;transition:color 0.15s;">★</span>`).join('')}
        </div>
        <input type="hidden" id="selectedRating" value="0">
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Comment (optional)</label>
        <textarea id="reviewComment" rows="3" placeholder="Share your experience…"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
      </div>
      <div style="display:flex;gap:12px;">
        <button onclick="submitReview('${orderId}', '${productId}')"
          style="flex:1;padding:12px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
          Submit Review
        </button>
        <button onclick="document.getElementById('reviewOverlay').remove()"
          style="padding:12px 20px;background:#f5f5f5;color:#333;border:none;border-radius:8px;font-size:15px;cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const stars = overlay.querySelectorAll('#starPicker span');
  stars.forEach(star => {
    star.addEventListener('mouseover', () => {
      const n = parseInt(star.dataset.star);
      stars.forEach((s, i) => s.style.color = i < n ? '#c8a96e' : '#ddd');
    });
    star.addEventListener('click', () => {
      document.getElementById('selectedRating').value = star.dataset.star;
    });
  });
  overlay.querySelector('#starPicker').addEventListener('mouseleave', () => {
    const selected = parseInt(document.getElementById('selectedRating').value) || 0;
    stars.forEach((s, i) => s.style.color = i < selected ? '#c8a96e' : '#ddd');
  });
};

window.submitReview = async function(orderId, productId) {
  const rating  = parseInt(document.getElementById('selectedRating')?.value || '0');
  const comment = document.getElementById('reviewComment')?.value.trim();
  const currentUser = window.authManager?.getCurrentUser();
  if (!rating) { alert('Please select a rating.'); return; }
  if (!currentUser) { alert('Please log in to leave a review.'); return; }
  try {
    const { data: order } = await db.from('orders').select('seller_id').eq('id', orderId).single();
    const { error } = await db.from('reviews').insert({
      order_id:    orderId,
      product_id:  productId,
      seller_id:   order?.seller_id || null,
      buyer_email: currentUser.email,
      rating,
      comment: comment || null
    });
    if (error) throw error;
    document.getElementById('reviewOverlay')?.remove();
    showSuccess('Review Submitted!', 'Thank you for your feedback.', 'Got it');
    loadBuyerOrders();
  } catch (err) {
    console.error('[review]', err);
    alert('Could not submit review. Please try again.');
  }
};

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadOverviewStats();
});

// ---- REAL-TIME SUBSCRIPTIONS ----
// Auto-update messages, orders without needing to refresh
function startRealtimeUpdates() {
  const currentUser = authManager?.getCurrentUser();
  if (!currentUser) return;

  // Real-time: messages updates (seller accepted, replied, etc.)
  messagesDb
    .channel('buyer-messages-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `buyer_email=eq.${currentUser.email}`
    }, (payload) => {
      console.log('[realtime] Message updated:', payload);
      // Refresh conversation list
      loadBuyerMessages();
      // If this message is currently open, refresh the chat view too
      if (activeChatId === payload.new?.id) {
        openChat(activeChatId);
      }
    })
    .subscribe();

  // Real-time: orders updates (status changes)
  db
    .channel('buyer-orders-realtime')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `buyer_email=eq.${currentUser.email}`
    }, (payload) => {
      console.log('[realtime] Order updated:', payload);
      loadBuyerOrders();
      loadOverviewStats();
    })
    .subscribe();

  console.log('[realtime] Buyer real-time subscriptions started');
}

// Start real-time after auth is ready
if (window.authManager?.isInitialized) {
  startRealtimeUpdates();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startRealtimeUpdates, 1000);
  });
}

// ---- TEST MESSAGE CREATOR (for debugging) ----
window.createTestMessage = async function() {
  console.log('[createTestMessage] Button clicked');
  
  const currentUser = authManager.getCurrentUser();
  console.log('[createTestMessage] Current user:', currentUser);
  
  if (!currentUser) {
    alert('Please log in first');
    return;
  }

  console.log('[createTestMessage] Creating test message for:', currentUser.email);

  const testMessage = {
    seller_id: '00000000-0000-0000-0000-000000000001',
    buyer_name: currentUser.name || 'Test Buyer',
    buyer_email: currentUser.email,
    message: 'This is a test message to verify the messaging system is working. You can delete this later.',
    created_at: new Date().toISOString()
  };

  console.log('[createTestMessage] Test message payload:', testMessage);

  try {
    console.log('[createTestMessage] Inserting into messagesDb...');
    const { data, error } = await messagesDb.from('messages').insert(testMessage).select();
    
    console.log('[createTestMessage] Insert response - data:', data, 'error:', error);
    
    if (error) {
      console.error('[createTestMessage] Error:', error);
      alert('Failed to create test message: ' + error.message);
      return;
    }

    console.log('[createTestMessage] Test message created:', data);
    alert('✅ Test message created! Reloading messages...');
    
    // Reload messages
    loadBuyerMessages();
  } catch (err) {
    console.error('[createTestMessage] Exception:', err);
    alert('Failed to create test message: ' + err.message);
  }
};