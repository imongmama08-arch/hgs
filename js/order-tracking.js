// ============================================================
// order-tracking.js — Order Tracking System
// Implements: Order status tracking for buyers
// ============================================================

class OrderTracker {
  constructor() {
    this.statusFlow = [
      { key: 'pending',   label: 'Order Placed',         icon: '🛒' },
      { key: 'confirmed', label: 'Payment Confirmed',     icon: '✅' },
      { key: 'shipped',   label: 'Shipped',               icon: '🚚' },
      { key: 'delivered', label: 'Delivered',             icon: '🎉' },
      { key: 'received',  label: 'Receipt Confirmed',     icon: '✓'  }
    ];
  }

  async trackOrder() {
    const reference = document.getElementById('orderReference').value.trim();
    
    if (!reference) {
      showError('Missing Reference', 'Please enter your order reference number or ID');
      return;
    }

    try {
      showLoadingModal('Tracking Order', 'Looking up your order details...');

      let order = null;
      let error = null;

      // Try to find by order ID first (UUID format)
      if (reference.length > 10) {
        const result = await db
          .from('orders')
          .select(`
            *,
            products (
              name,
              image_url,
              category
            )
          `)
          .eq('id', reference)
          .single();
        
        order = result.data;
        error = result.error;
      }

      // If not found by ID and looks like old reference format, try other methods
      if (!order && reference.startsWith('RWL-')) {
        // Try to find by any text field that might contain the reference
        const result = await db
          .from('orders')
          .select(`
            *,
            products (
              name,
              image_url,
              category
            )
          `)
          .or(`buyer_name.ilike.%${reference}%,buyer_email.ilike.%${reference}%`)
          .limit(1);
        
        if (result.data && result.data.length > 0) {
          order = result.data[0];
        } else {
          error = { message: 'Order not found' };
        }
      }

      hideLoadingModal();

      if (error || !order) {
        showError('Order Not Found', 'No order found with this reference number or ID. Please check your order confirmation email for the correct ID.');
        return;
      }

      this.displayOrderInfo(order);
      this.displayTrackingTimeline(order);
      
      document.getElementById('trackingResults').style.display = 'block';

    } catch (error) {
      hideLoadingModal();
      showError('Tracking Error', 'Could not retrieve order information');
      console.error('[order-tracking] trackOrder:', error);
    }
  }

  displayOrderInfo(order) {
    const orderInfo = document.getElementById('orderInfo');
    const product = order.products;

    // Prefer DB columns; fall back to localStorage for legacy data
    const lsTracking = JSON.parse(localStorage.getItem(`rewear_tracking_${order.id}`) || '{}');
    const courierName    = order.courier_name    || lsTracking.courier_name    || null;
    const trackingNumber = order.tracking_number || lsTracking.tracking_number || null;

    // Payment status badge
    const paymentBadge = {
      pending:   '<span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">⏳ Awaiting Payment</span>',
      submitted: '<span style="background:#cce5ff;color:#004085;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">📤 Payment Submitted</span>',
      verified:  '<span style="background:#d4edda;color:#155724;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">✅ Payment Verified</span>',
      rejected:  '<span style="background:#f8d7da;color:#721c24;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">❌ Payment Rejected</span>'
    }[order.payment_status || 'pending'] || '';
    
    orderInfo.innerHTML = `
      <div class="order-summary-card">
        <div class="order-header">
          <h3>Order ${order.id.slice(0, 8).toUpperCase()}</h3>
          <span class="order-status ${order.status.replace(/_/g, '-')}">${this.getStatusLabel(order.status)}</span>
        </div>
        
        <div class="order-product">
          ${product?.image_url ? `<img src="${product.image_url}" alt="${product.name}" class="order-product-image">` : ''}
          <div class="order-product-details">
            <h4>${product?.name || 'Product'}</h4>
            <p>Size: ${order.size_selected || '—'}</p>
            <p>Quantity: ${order.quantity || 1}</p>
            <p class="order-total">Total: ₱${parseFloat(order.total_price || 0).toFixed(2)}</p>
          </div>
        </div>
        
        <div class="order-details">
          <div class="detail-row"><span>Buyer:</span><span>${order.buyer_name}</span></div>
          <div class="detail-row"><span>Email:</span><span>${order.buyer_email}</span></div>
          ${order.delivery_address ? `<div class="detail-row"><span>Address:</span><span>${order.delivery_address}</span></div>` : ''}
          ${order.payment_reference ? `<div class="detail-row"><span>Ref #:</span><span style="font-weight:600;">${order.payment_reference}</span></div>` : ''}
          <div class="detail-row"><span>Payment:</span><span>${paymentBadge}</span></div>
          ${order.payment_rejected_reason ? `<div class="detail-row" style="color:#c0392b;"><span>Reason:</span><span>${order.payment_rejected_reason}</span></div>` : ''}
          ${courierName ? `<div class="detail-row"><span>Courier:</span><span>${courierName}</span></div>` : ''}
          ${trackingNumber ? `<div class="detail-row"><span>Tracking #:</span><span style="font-weight:600;color:#c8a96e;">${trackingNumber}</span></div>` : ''}
        </div>

        ${order.status === 'delivered' ? `
        <div style="margin-top:16px;text-align:center;">
          <button onclick="confirmReceiptFromTracking('${order.id}')" 
                  style="padding:12px 24px;background:#27ae60;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
            ✓ Confirm Receipt
          </button>
        </div>` : ''}
        ${order.status === 'received' ? `
        <div style="margin-top:16px;text-align:center;">
          <p style="color:#27ae60;font-weight:600;">✓ You have confirmed receipt of this order</p>
          ${!order._reviewed ? `<button onclick="openReviewModal('${order.id}', '${order.products?.name || ''}', '${order.products?.id || ''}')"
            style="margin-top:8px;padding:10px 20px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
            ⭐ Leave a Review
          </button>` : ''}
        </div>` : ''}
      </div>
    `;

    // Check if already reviewed
    if (order.status === 'received' && order.products?.id) {
      const currentUser = window.authManager?.getCurrentUser();
      if (currentUser) {
        db.from('reviews')
          .select('id')
          .eq('order_id', order.id)
          .eq('buyer_email', currentUser.email)
          .single()
          .then(({ data }) => {
            if (data) {
              // Already reviewed — hide the button
              const reviewBtn = orderInfo.querySelector('button[onclick*="openReviewModal"]');
              if (reviewBtn) reviewBtn.style.display = 'none';
            }
          });
      }
    }
  }

  displayTrackingTimeline(order) {
    const timeline = document.getElementById('trackingTimeline');
    const currentStatusIndex = this.statusFlow.findIndex(s => s.key === order.status);
    
    const timelineHTML = this.statusFlow.map((status, index) => {
      const isCompleted = index <= currentStatusIndex;
      const isCurrent = index === currentStatusIndex;
      
      return `
        <div class="timeline-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
          <div class="timeline-icon">${status.icon}</div>
          <div class="timeline-content">
            <h4>${status.label}</h4>
            <p>${this.getStatusDescription(status.key, order)}</p>
            ${this.getStatusTimestamp(status.key, order)}
          </div>
        </div>
      `;
    }).join('');
    
    timeline.innerHTML = `
      <div class="timeline-header">
        <h3>Order Progress</h3>
      </div>
      <div class="timeline">
        ${timelineHTML}
      </div>
    `;
  }

  getStatusLabel(status) {
    const statusObj = this.statusFlow.find(s => s.key === status);
    return statusObj ? statusObj.label : status.replace(/_/g, ' ').toUpperCase();
  }

  getStatusDescription(status, order) {
    const pStatus = order.payment_status;
    const descriptions = {
      'pending':   pStatus === 'submitted'
                     ? '📤 Payment proof submitted — awaiting admin verification'
                     : pStatus === 'rejected'
                       ? `❌ Payment rejected${order.payment_rejected_reason ? ': ' + order.payment_rejected_reason : ''} — please contact support`
                       : '⏳ Order placed — please complete GCash payment and upload proof',
      'confirmed': '✅ Payment verified — seller is preparing your item',
      'shipped':   '🚚 Your order is on the way',
      'delivered': '🎉 Order delivered — please confirm receipt below',
      'received':  '✓ Transaction complete — thank you!',
      'cancelled': '❌ This order was cancelled'
    };
    return descriptions[status] || 'Status update';
  }

  getStatusTimestamp(status, order) {
    if (status === 'pending' && order.created_at) {
      const date = new Date(order.created_at);
      return `<span class="timestamp">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>`;
    }
    return '';
  }
}

// Confirm receipt from tracking page
window.confirmReceiptFromTracking = async (orderId) => {
  if (!confirm('Confirm that you have received this order?')) return;
  try {
    const currentUser = window.authManager?.getCurrentUser();
    let error;

    // Try with received_at first
    ({ error } = await db.from('orders').update({
      status: 'received',
      received_at: new Date().toISOString()
    }).eq('id', orderId));

    // If received_at column doesn't exist, retry without it
    if (error?.message?.includes('received_at')) {
      ({ error } = await db.from('orders').update({ status: 'received' }).eq('id', orderId));
    }

    // If still failing (RLS), try matching by buyer_email too
    if (error && currentUser?.email) {
      ({ error } = await db.from('orders').update({ status: 'received' })
        .eq('id', orderId)
        .eq('buyer_email', currentUser.email));
    }

    if (error) throw error;
    showSuccess('Receipt Confirmed!', 'Thank you for confirming your order receipt.', 'Got it');
    setTimeout(() => window.orderTracker?.trackOrder(), 1000);
  } catch (err) {
    console.error('[order-tracking] confirmReceipt error:', err);
    showError('Error', 'Could not confirm receipt. Please try again.');
  }
};

// Review modal
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

  // Star picker interaction
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
    // Get seller_id from order
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
  } catch (err) {
    console.error('[review]', err);
    alert('Could not submit review. Please try again.');
  }
};

// Global function for HTML onclick
window.trackOrder = () => {
  if (window.orderTracker) {
    window.orderTracker.trackOrder();
  }
};

// Initialize order tracker
document.addEventListener('DOMContentLoaded', () => {
  window.orderTracker = new OrderTracker();
  
  const urlParams = new URLSearchParams(window.location.search);
  const reference = urlParams.get('ref') || urlParams.get('id');
  if (reference) {
    document.getElementById('orderReference').value = reference;
    window.orderTracker.trackOrder();
  }
});

console.log('[order-tracking] Order tracking system loaded');