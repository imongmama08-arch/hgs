// ============================================================
// checkout.js — ReWear Lite Checkout Flow
// Implements: Order Details → GCash Payment → Payment Proof Upload
// ============================================================

class CheckoutManager {
  constructor() {
    this.currentOrder = null;
    this.paymentTimer = null;
    this.timeRemaining = 15 * 60; // 15 minutes in seconds
    this.init();
  }

  async init() {
    // Get order details from URL or session
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('productId');
    const size = urlParams.get('size');
    
    if (!productId || !size) {
      showError('Invalid Order', 'Missing order information');
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      window.location.href = prefix + 'shop.html';
      return;
    }

    await this.loadOrderDetails(productId, size);
    this.setupEventListeners();
  }

  async loadOrderDetails(productId, size) {
    try {
      console.log('[checkout] Loading product details for:', { productId, size });
      
      const { data: product, error } = await db
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      console.log('[checkout] Product query result:', { data: product, error });

      if (error || !product) {
        console.error('[checkout] Product not found:', error);
        throw new Error('Product not found');
      }

      // Try to fetch seller GCash info from DB first, then localStorage fallback
      let sellerInfo = null;
      if (product.seller_id) {
        const { data: seller } = await db
          .from('sellers')
          .select('business_name, gcash_number, gcash_name')
          .eq('id', product.seller_id)
          .single();
        
        // If DB has no GCash info, try localStorage fallback
        const lsGcash = JSON.parse(localStorage.getItem(`rewear_gcash_${product.seller_id}`) || '{}');
        sellerInfo = {
          ...(seller || {}),
          gcash_number: seller?.gcash_number || lsGcash.gcash_number || null,
          gcash_name:   seller?.gcash_name   || lsGcash.gcash_name   || seller?.business_name || null
        };
      }

      console.log('[checkout] Product loaded successfully:', product);

      this.currentOrder = {
        product,
        size,
        quantity: 1,
        totalPrice: product.price,
        reference: this.generateOrderReference(),
        seller: sellerInfo
      };

      console.log('[checkout] Current order created:', this.currentOrder);

      this.renderOrderSummary();

      // Auto-fill buyer info from logged-in user
      const currentUser = window.authManager?.getCurrentUser();
      if (currentUser) {
        const nameField = document.getElementById('buyerName');
        const emailField = document.getElementById('buyerEmail');
        if (nameField && currentUser.name) nameField.value = currentUser.name;
        if (emailField) {
          emailField.value = currentUser.email;
          emailField.readOnly = true;
        }
      }
      
    } catch (error) {
      showError('Error', 'Could not load order details');
      console.error('[checkout] loadOrderDetails:', error);
    }
  }

  renderOrderSummary() {
    const summary = document.getElementById('orderSummary');
    const { product, size, quantity, totalPrice } = this.currentOrder;
    
    summary.innerHTML = `
      <div class="order-item">
        <img src="${product.image_url}" alt="${product.name}" class="order-item-image">
        <div class="order-item-details">
          <h4>${product.name}</h4>
          <p>Size: ${size}</p>
          <p>Quantity: ${quantity}</p>
          <p class="order-item-price">₱${parseFloat(totalPrice).toFixed(2)}</p>
        </div>
      </div>
      <div class="order-total">
        <h4>Total: ₱${parseFloat(totalPrice).toFixed(2)}</h4>
      </div>
    `;
  }

  setupEventListeners() {
    // Payment proof file upload
    const proofInput = document.getElementById('paymentProof');
    if (proofInput) {
      proofInput.addEventListener('change', (e) => {
        this.handleProofUpload(e.target.files[0]);
      });
    }
  }

  generateOrderReference() {
    return 'RWL-' + Date.now().toString().slice(-6);
  }

  async proceedToPayment() {
    console.log('[checkout] proceedToPayment called');
    
    // Validate delivery form
    const form = document.getElementById('deliveryForm');
    const formData = new FormData(form);
    
    const deliveryInfo = {
      buyerName: document.getElementById('buyerName').value.trim(),
      buyerEmail: document.getElementById('buyerEmail').value.trim(),
      buyerPhone: document.getElementById('buyerPhone').value.trim(),
      deliveryAddress: document.getElementById('deliveryAddress').value.trim()
    };

    console.log('[checkout] Delivery info collected:', deliveryInfo);

    // Validation
    if (!deliveryInfo.buyerName || !deliveryInfo.buyerEmail || 
        !deliveryInfo.buyerPhone || !deliveryInfo.deliveryAddress) {
      console.log('[checkout] Validation failed: missing fields');
      showError('Incomplete Information', 'Please fill in all delivery details');
      return;
    }

    if (!validators.email(deliveryInfo.buyerEmail)) {
      console.log('[checkout] Validation failed: invalid email');
      showError('Invalid Email', 'Please enter a valid email address');
      return;
    }

    console.log('[checkout] Validation passed, proceeding with order creation');
    console.log('[checkout] Database object:', db);
    console.log('[checkout] Current order:', this.currentOrder);

    // Check if database is available
    if (!db) {
      console.error('[checkout] Database not initialized');
      showError('System Error', 'Database connection not available. Please refresh the page.');
      return;
    }

    // Save delivery info to order
    this.currentOrder.deliveryInfo = deliveryInfo;

    // Create order in database
    try {
      console.log('[checkout] Creating order with data:', {
        product_id: this.currentOrder.product.id,
        buyer_name: deliveryInfo.buyerName,
        buyer_email: deliveryInfo.buyerEmail,
        size_selected: this.currentOrder.size,
        quantity: this.currentOrder.quantity,
        total_price: this.currentOrder.totalPrice,
        status: 'pending_payment'
      });

      // First try with minimal fields (matching working script.js pattern)
      console.log('[checkout] Attempting order creation...');
      
      const orderData = {
        product_id:    this.currentOrder.product.id,
        buyer_name:    deliveryInfo.buyerName,
        buyer_email:   window.authManager?.getCurrentUser()?.email || deliveryInfo.buyerEmail,
        size_selected: this.currentOrder.size,
        quantity:      this.currentOrder.quantity,
        total_price:   this.currentOrder.totalPrice,
        status:        'pending'
      };

      // Store extra info locally until migrations are run
      this._pendingDeliveryInfo = deliveryInfo;

      // Try inserting with seller_id first; if column missing, retry without it
      let order, error;
      if (this.currentOrder.product?.seller_id) {
        ({ data: order, error } = await db
          .from('orders')
          .insert({ ...orderData, seller_id: this.currentOrder.product.seller_id })
          .select()
          .single());

        if (error?.message?.includes('seller_id')) {
          console.warn('[checkout] seller_id column not found, retrying without it');
          error = null;
          ({ data: order, error } = await db
            .from('orders')
            .insert(orderData)
            .select()
            .single());
        }
      } else {
        ({ data: order, error } = await db
          .from('orders')
          .insert(orderData)
          .select()
          .single());
      }
      
      console.log('[checkout] Database response:', { data: order, error });

      if (error) {
        console.error('[checkout] Database error details:', error);
        
        // Log the full error object for debugging
        console.error('[checkout] Full error object:', JSON.stringify(error, null, 2));
        
        throw error;
      }

      // Order created successfully
      if (order && order.id) {
        console.log('[checkout] Order created successfully with ID:', order.id);
        this.currentOrder.id = order.id;
      }
      
      // Move to payment step
      this.showStep(2);
      this.startPaymentTimer();
      this.updatePaymentDetails();
      
    } catch (error) {
      console.error('[checkout] proceedToPayment error:', error);
      
      let errorMessage = 'Could not create order. Please try again.';
      
      // Provide more specific error messages
      if (error.message) {
        if (error.message.includes('duplicate key')) {
          errorMessage = 'Order reference already exists. Please refresh and try again.';
        } else if (error.message.includes('foreign key')) {
          errorMessage = 'Invalid product or seller information. Please refresh and try again.';
        } else if (error.message.includes('null value')) {
          errorMessage = 'Missing required information. Please check all fields.';
        } else {
          errorMessage = `Database error: ${error.message}`;
        }
      }
      
      showError('Order Creation Failed', errorMessage);
    }
  }

  showStep(stepNumber) {
    // Update step indicators
    document.querySelectorAll('.step').forEach((step, index) => {
      step.classList.toggle('active', index + 1 <= stepNumber);
    });

    // Show/hide step content
    document.querySelectorAll('.checkout-step').forEach((step, index) => {
      step.classList.toggle('active', index + 1 === stepNumber);
    });

    // When entering payment step, push one extra history entry
    if (stepNumber === 2) {
      history.pushState({ payment: true }, '', window.location.href);
    }
  }

  updatePaymentDetails() {
    document.getElementById('paymentAmount').textContent = `₱${parseFloat(this.currentOrder.totalPrice).toFixed(2)}`;
    document.getElementById('paymentReference').textContent = this.currentOrder.reference;

    const seller   = this.currentOrder.seller;
    const sellerId = this.currentOrder.product?.seller_id;
    const gcashNumberEl = document.getElementById('sellerGcashNumber');
    const gcashNameEl   = document.getElementById('sellerGcashName');

    // Use DB columns first, fall back to localStorage
    const lsGcash = JSON.parse(localStorage.getItem(`rewear_gcash_${sellerId}`) || '{}');
    const gcashNumber = seller?.gcash_number || lsGcash.gcash_number || null;
    const gcashName   = seller?.gcash_name   || lsGcash.gcash_name   || seller?.business_name || null;

    if (gcashNumberEl) gcashNumberEl.textContent = gcashNumber || 'Contact seller for GCash number';
    if (gcashNameEl)   gcashNameEl.textContent   = gcashName   || 'Seller';

    // Show warning if no GCash info
    const gcashDetails = document.querySelector('.gcash-details');
    if (gcashDetails && !gcashNumber) {
      gcashDetails.insertAdjacentHTML('beforeend',
        '<p style="color:#e74c3c;font-size:13px;margin-top:8px;">⚠️ Seller has not set up GCash yet. Please contact them directly.</p>');
    }
  }

  startPaymentTimer() {
    this.timeRemaining = 15 * 60; // Reset to 15 minutes
    
    this.paymentTimer = setInterval(() => {
      this.timeRemaining--;
      
      const minutes = Math.floor(this.timeRemaining / 60);
      const seconds = this.timeRemaining % 60;
      
      document.getElementById('paymentTimer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      if (this.timeRemaining <= 0) {
        this.handlePaymentTimeout();
      }
    }, 1000);
  }

  handlePaymentTimeout() {
    clearInterval(this.paymentTimer);
    showError('Payment Timeout', 'Payment time has expired. Your order has been cancelled.');
    
    if (this.currentOrder.id) {
      db.from('orders')
        .update({ status: 'cancelled' })
        .eq('id', this.currentOrder.id);
    }
    
    setTimeout(() => {
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      window.location.href = prefix + 'shop.html';
    }, 3000);
  }

  handleProofUpload(file) {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('File Too Large', 'Please upload an image smaller than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('proofPreview');
      preview.innerHTML = `
        <div class="proof-preview">
          <img src="${e.target.result}" alt="Payment Proof" style="max-width: 300px; max-height: 200px; border-radius: 8px;">
          <p>Payment proof ready to submit</p>
        </div>
      `;
      
      // Enable submit button
      document.getElementById('submitProofBtn').disabled = false;
    };
    
    reader.readAsDataURL(file);
    this.currentOrder.paymentProofFile = file;
  }

  async submitPaymentProof() {
    if (!this.currentOrder.paymentProofFile) {
      showError('No File Selected', 'Please upload payment proof first');
      return;
    }

    try {
      console.log('[checkout] submitPaymentProof called for order ID:', this.currentOrder.id);
      
      showLoadingModal('Submitting Payment Proof', 'Processing your payment verification...');

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update order payment_status in DB
      if (this.currentOrder.id) {
        // Try to save extended fields (requires 06_buyer_flow.sql to be run)
        const extendedUpdate = { payment_status: 'submitted' };
        const di = this._pendingDeliveryInfo;
        if (di) {
          extendedUpdate.buyer_phone       = di.buyerPhone;
          extendedUpdate.delivery_address  = di.deliveryAddress;
          extendedUpdate.payment_reference = this.currentOrder.reference;
        }

        const { error: updateErr } = await db.from('orders')
          .update(extendedUpdate)
          .eq('id', this.currentOrder.id);

        if (updateErr) {
          // Columns may not exist yet — fall back to just marking submitted via localStorage
          console.warn('[checkout] Extended columns not available yet, storing locally:', updateErr.message);
          localStorage.setItem(`rewear_order_extra_${this.currentOrder.id}`, JSON.stringify({
            buyer_phone:       di?.buyerPhone || '',
            delivery_address:  di?.deliveryAddress || '',
            payment_reference: this.currentOrder.reference,
            payment_status:    'submitted'
          }));
        }
      }

      hideLoadingModal();
      
      // Stop timer
      if (this.paymentTimer) {
        clearInterval(this.paymentTimer);
      }

      // Show confirmation
      document.getElementById('finalOrderId').textContent = this.currentOrder.id || 'N/A';
      
      const trackOrderLink = document.getElementById('trackOrderLink');
      if (trackOrderLink && this.currentOrder.id) {
        const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
        trackOrderLink.href = prefix + `order-tracking.html?id=${this.currentOrder.id}`;
      }

      // Show what happens next
      const nextSteps = document.getElementById('checkoutNextSteps');
      if (nextSteps) {
        nextSteps.innerHTML = `
          <div style="margin-top:20px;padding:16px;background:#f0f9f0;border-radius:10px;text-align:left;">
            <p style="font-weight:700;margin:0 0 10px;font-size:14px;">What happens next:</p>
            <ol style="margin:0;padding-left:20px;font-size:13px;color:#444;line-height:1.8;">
              <li>Admin reviews your payment proof</li>
              <li>Once verified, the seller prepares your item</li>
              <li>Seller adds tracking number when shipped</li>
              <li>You receive tracking updates in your dashboard</li>
              <li>Confirm receipt when your order arrives</li>
            </ol>
          </div>`;
      }
      
      this.showStep(3);

      showSuccess('Payment Submitted!', 'Your payment proof has been submitted for verification. The admin will review and approve your payment.');

      console.log('[checkout] Payment proof submission completed successfully');

    } catch (error) {
      hideLoadingModal();
      showError('Submission Failed', 'Could not submit payment proof. Please try again.');
      console.error('[checkout] submitPaymentProof:', error);
    }
  }
  isOnPaymentStep() {
    return document.getElementById('checkout-step-2')?.classList.contains('active') || false;
  }

  async cancelPayment() {
    // Stop the timer
    if (this.paymentTimer) {
      clearInterval(this.paymentTimer);
      this.paymentTimer = null;
    }

    // Mark order as cancelled in DB
    if (this.currentOrder?.id) {
      try {
        showLoadingModal('Cancelling…', 'Cancelling your order.');
        await db.from('orders')
          .update({ status: 'cancelled' })
          .eq('id', this.currentOrder.id);
        hideLoadingModal();
        console.log('[checkout] Order cancelled:', this.currentOrder.id);
      } catch (err) {
        hideLoadingModal();
        console.error('[checkout] Failed to cancel order:', err);
      }
    }

    // Redirect back to shop
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    window.location.href = prefix + 'shop.html';
  }
}

// Global functions for HTML onclick handlers
window.proceedToPayment = () => {
  if (window.checkoutManager) {
    window.checkoutManager.proceedToPayment();
  }
};

window.submitPaymentProof = () => {
  if (window.checkoutManager) {
    window.checkoutManager.submitPaymentProof();
  }
};

window.cancelPayment = () => {
  if (window.checkoutManager) {
    window.checkoutManager.cancelPayment();
  }
};

// Initialize checkout manager
document.addEventListener('DOMContentLoaded', () => {
  // Require authentication
  if (!requireAuth()) return;
  
  window.checkoutManager = new CheckoutManager();

  // Lock navigation during payment step — only Cancel Payment button can exit
  // Note: beforeunload removed to avoid "Leave site?" dialog on back button

  // Block browser back button during payment step — show custom modal, not alert()
  history.pushState({ payment: true }, '', window.location.href);
  
  let backWarningShowing = false;
  
  window.addEventListener('popstate', () => {
    if (window.checkoutManager?.isOnPaymentStep()) {
      // Always push back to stay on page
      history.pushState({ payment: true }, '', window.location.href);
      
      // Show warning only if not already showing
      if (!backWarningShowing) {
        backWarningShowing = true;
        
        // Create overlay modal
        const overlay = document.createElement('div');
        overlay.id = 'backWarningOverlay';
        overlay.style.cssText = `
          position:fixed;top:0;left:0;width:100%;height:100%;
          background:rgba(0,0,0,0.6);z-index:99999;
          display:flex;align-items:center;justify-content:center;
        `;
        overlay.innerHTML = `
          <div style="background:#fff;border-radius:12px;padding:32px;max-width:360px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
            <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
            <h3 style="margin:0 0 12px;color:#333;">Payment In Progress</h3>
            <p style="color:#666;margin:0 0 24px;line-height:1.5;">You need to <strong>cancel the payment</strong> first before going back.</p>
            <button id="backWarningOk" style="background:#c8a96e;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%;">OK, Stay Here</button>
          </div>
        `;
        document.body.appendChild(overlay);
        
        document.getElementById('backWarningOk').addEventListener('click', () => {
          overlay.remove();
          backWarningShowing = false;
        });
      }
    }
  });
});

console.log('[checkout] Checkout system loaded');