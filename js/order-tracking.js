// ============================================================
// order-tracking.js — Order Tracking System
// Implements: Order status tracking for buyers
// ============================================================

class OrderTracker {
  constructor() {
    this.statusFlow = [
      { key: 'pending',   label: 'Order Placed',      icon: '🛒' },
      { key: 'confirmed', label: 'Payment Confirmed',  icon: '✅' },
      { key: 'shipped',   label: 'Shipped',            icon: '🚚' },
      { key: 'delivered', label: 'Delivered',          icon: '🎉' },
      { key: 'received',  label: 'Receipt Confirmed',  icon: '✓'  }
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

    // Get tracking info from localStorage (saved by seller)
    const trackingData = JSON.parse(localStorage.getItem(`rewear_tracking_${order.id}`) || '{}');
    
    orderInfo.innerHTML = `
      <div class="order-summary-card">
        <div class="order-header">
          <h3>Order ${order.id}</h3>
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
          ${trackingData.courier_name ? `
            <div class="detail-row"><span>Courier:</span><span>${trackingData.courier_name}</span></div>` : ''}
          ${trackingData.tracking_number ? `
            <div class="detail-row">
              <span>Tracking #:</span>
              <span class="tracking-number" style="font-weight:600;color:#c8a96e;">${trackingData.tracking_number}</span>
            </div>` : ''}
        </div>

        ${order.status === 'delivered' ? `
        <div style="margin-top:16px;text-align:center;">
          <button onclick="confirmReceiptFromTracking('${order.id}')" 
                  style="padding:12px 24px;background:#27ae60;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
            ✓ Confirm Receipt
          </button>
        </div>` : ''}
        ${order.status === 'received' ? `
        <p style="margin-top:12px;text-align:center;color:#27ae60;font-weight:600;">✓ You have confirmed receipt of this order</p>` : ''}
      </div>
    `;
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
    const descriptions = {
      'pending':   'Order placed, waiting for payment confirmation',
      'confirmed': 'Payment confirmed — seller is preparing your order',
      'shipped':   'Your order is on its way',
      'delivered': 'Order has been delivered — please confirm receipt',
      'received':  'You have confirmed receipt of this order',
      'cancelled': 'This order was cancelled'
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
    const { error } = await db.from('orders').update({ status: 'received' }).eq('id', orderId);
    if (error) throw error;
    showSuccess('Receipt Confirmed!', 'Thank you for confirming your order receipt.', 'Got it');
    setTimeout(() => window.orderTracker?.trackOrder(), 1000);
  } catch (err) {
    showError('Error', 'Could not confirm receipt. Please try again.');
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