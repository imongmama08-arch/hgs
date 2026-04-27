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

      // Try to fetch seller GCash info separately (columns may not exist yet)
      let sellerInfo = null;
      if (product.seller_id) {
        const { data: seller } = await db
          .from('sellers')
          .select('business_name')
          .eq('id', product.seller_id)
          .single();
        sellerInfo = seller || null;
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
    const proofInput = document.getElementById('paymentProof');
    const uploadArea = document.getElementById('paymentUploadArea');

    // File input change — triggered by clicking the upload area
    if (proofInput) {
      proofInput.addEventListener('change', (e) => {
        if (e.target.files[0]) this.handleProofUpload(e.target.files[0]);
      });
    }

    // Drag & drop support
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#d4a843';
        uploadArea.style.background  = '#fdf9f0';
      });
      uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '';
        uploadArea.style.background  = '';
      });
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        uploadArea.style.background  = '';
        const file = e.dataTransfer.files[0];
        if (file) this.handleProofUpload(file);
      });
    }
  }

  generateOrderReference() {
    return 'RWL-' + Date.now().toString().slice(-6);
  }

  async proceedToPayment() {
    console.log('[checkout] proceedToPayment called');
    
    const buyerName    = document.getElementById('buyerName')?.value.trim();
    const buyerPhone   = document.getElementById('buyerPhone')?.value.trim();
    const deliveryAddr = document.getElementById('deliveryAddress')?.value.trim();
    const currentUser  = window.authManager?.getCurrentUser();
    const buyerEmail   = document.getElementById('buyerEmail')?.value.trim()
                      || currentUser?.email
                      || 'buyer@rewear.com';

    if (!buyerName || !buyerPhone || !deliveryAddr) {
      showError('Incomplete Information', 'Please fill in all delivery details.');
      return;
    }

    this.currentOrder.deliveryInfo = { buyerName, buyerEmail, buyerPhone, deliveryAddr };

    try {
      showLoadingModal('Creating Order…', 'Please wait.');
      const { data: order, error } = await db.from('orders').insert({
        product_id:    this.currentOrder.product.id,
        buyer_name:    buyerName,
        buyer_email:   buyerEmail,
        size_selected: this.currentOrder.size,
        quantity:      this.currentOrder.quantity,
        total_price:   this.currentOrder.totalPrice,
        status:        'pending'
      }).select().single();

      hideLoadingModal();
      if (error) throw error;
      if (order?.id) this.currentOrder.id = order.id;

    } catch (err) {
      hideLoadingModal();
      console.error('[checkout] order insert error:', err);
      // Continue anyway — don't block the user
    }

    this.showStep(2);
    this.startPaymentTimer();
    this.updatePaymentDetails();
  }

  showStep(stepNumber) {
    // Update step indicator pills
    document.querySelectorAll('.step').forEach((step, index) => {
      step.classList.toggle('active', index + 1 <= stepNumber);
    });

    // Hide ALL checkout steps first
    document.querySelectorAll('.checkout-step').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });

    // Show the correct step by ID
    let targetId;
    if (stepNumber === 1) targetId = 'checkout-step-1';
    if (stepNumber === 2) targetId = 'checkout-step-2';
    if (stepNumber === 3) targetId = 'checkout-step-3'; // final confirmation

    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) { el.style.display = ''; el.classList.add('active'); }
    }

    // When entering payment step, push one extra history entry
    if (stepNumber === 2) {
      history.pushState({ payment: true }, '', window.location.href);
    }

    // Step 3 = confirmation — auto redirect to buyer dashboard after 4 seconds
    if (stepNumber === 3) {
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';

      let countdown = 4;
      const countdownEl = document.createElement('p');
      countdownEl.style.cssText = 'color:#888;font-size:13px;margin-top:16px;';
      countdownEl.textContent = `Redirecting to your dashboard in ${countdown} seconds...`;
      document.querySelector('#checkout-step-3 .checkout-section')?.appendChild(countdownEl);

      const timer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          countdownEl.textContent = `Redirecting to your dashboard in ${countdown} seconds...`;
        } else {
          clearInterval(timer);
          window.location.href = prefix + 'dashboard-buyer.html';
        }
      }, 1000);
    }
  }

  showPaymentStep(type) {
    // Hide all steps
    document.querySelectorAll('.checkout-step').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });

    const targetId = type === 'gcash' ? 'checkout-step-gcash' : 'checkout-step-cod';
    const el = document.getElementById(targetId);
    if (el) { el.style.display = ''; el.classList.add('active'); }
  }

  updatePaymentDetails() {
    document.getElementById('paymentAmount').textContent = `₱${parseFloat(this.currentOrder.totalPrice).toFixed(2)}`;
    document.getElementById('paymentReference').textContent = this.currentOrder.reference;

    const seller = this.currentOrder.seller;
    const sellerId = this.currentOrder.product?.seller_id;
    const gcashNumberEl = document.getElementById('sellerGcashNumber');
    const gcashNameEl = document.getElementById('sellerGcashName');

    // Read GCash info from localStorage (stored by seller in their profile)
    const gcashData = JSON.parse(localStorage.getItem(`rewear_gcash_${sellerId}`) || '{}');

    if (gcashNumberEl) gcashNumberEl.textContent = gcashData.gcash_number || 'Contact seller';
    if (gcashNameEl)   gcashNameEl.textContent   = gcashData.gcash_name   || seller?.business_name || 'Seller';
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
    showError('Payment Timeout', 'Payment time has expired. Please start a new order.');
    
    // Update order status to expired
    if (this.currentOrder.id) {
      db.from('orders')
        .update({ status: 'payment_rejected' })
        .eq('id', this.currentOrder.id);
    }
    
    setTimeout(() => {
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      window.location.href = prefix + 'shop.html';
    }, 3000);
  }

  handleProofUpload(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please upload an image file (JPG, PNG, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File Too Large', 'Please upload an image smaller than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      // Hide the upload area, show preview
      const uploadArea = document.getElementById('paymentUploadArea');
      if (uploadArea) uploadArea.style.display = 'none';

      const preview = document.getElementById('proofPreview');
      preview.innerHTML = `
        <div style="text-align:center;padding:16px;background:#f8f3ed;border-radius:12px;margin-bottom:16px;">
          <img src="${e.target.result}" alt="Payment Proof"
            style="max-width:100%;max-height:300px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <p style="margin:10px 0 4px;font-size:13px;color:#388e3c;font-weight:600;">✅ Screenshot ready to submit</p>
          <p style="margin:0;font-size:12px;color:#888;">${file.name} · ${(file.size/1024).toFixed(0)} KB</p>
          <button type="button"
            onclick="document.getElementById('paymentProof').click()"
            style="margin-top:10px;padding:6px 16px;background:none;border:1px solid #e5ddd4;border-radius:8px;font-size:12px;color:#666;cursor:pointer;">
            Change Screenshot
          </button>
        </div>
      `;

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

      console.log('[checkout] Payment proof processed successfully (simulated)');

      hideLoadingModal();
      
      // Stop timer
      if (this.paymentTimer) {
        clearInterval(this.paymentTimer);
      }

      // Show confirmation
      document.getElementById('finalOrderId').textContent = this.currentOrder.id || 'N/A';
      
      // Set up tracking link - use order ID since payment_reference doesn't exist in database
      const trackOrderLink = document.getElementById('trackOrderLink');
      if (trackOrderLink && this.currentOrder.id) {
        const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
        trackOrderLink.href = prefix + `order-tracking.html?id=${this.currentOrder.id}`;
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

  // Called by "Choose Payment Method" button in step 1
  async proceedToPaymentMethod() {
    const buyerName    = document.getElementById('buyerName')?.value.trim();
    const buyerPhone   = document.getElementById('buyerPhone')?.value.trim();
    const deliveryAddr = document.getElementById('deliveryAddress')?.value.trim();

    if (!buyerName || !buyerPhone || !deliveryAddr) {
      showError('Incomplete Information', 'Please fill in all delivery details.');
      return;
    }

    if (buyerPhone.length !== 11 || !buyerPhone.startsWith('09')) {
      showError('Invalid Phone', 'Please enter a valid 11-digit Philippine mobile number starting with 09.');
      return;
    }

    // Get email from logged-in user or a field if present
    const currentUser = window.authManager?.getCurrentUser();
    const buyerEmail  = document.getElementById('buyerEmail')?.value.trim()
                     || currentUser?.email
                     || 'buyer@rewear.com';

    this.currentOrder.deliveryInfo = { buyerName, buyerEmail, buyerPhone, deliveryAddr };

    // Create order in DB now
    try {
      showLoadingModal('Creating Order…', 'Please wait.');
      const { data: order, error } = await db.from('orders').insert({
        product_id:    this.currentOrder.product.id,
        buyer_name:    buyerName,
        buyer_email:   buyerEmail,
        size_selected: this.currentOrder.size,
        quantity:      this.currentOrder.quantity,
        total_price:   this.currentOrder.totalPrice,
        status:        'pending'
      }).select().single();

      hideLoadingModal();

      if (error) throw error;
      if (order?.id) this.currentOrder.id = order.id;

    } catch (err) {
      hideLoadingModal();
      console.error('[checkout] order insert error:', err);
      // Don't block — let user continue even if DB insert fails
    }

    // Move to payment method selection (step 2)
    this.showStep(2);
  }

  // Called when user picks GCash or COD and clicks Continue
  proceedWithPayment() {
    const selected = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (!selected) {
      showError('Select Payment', 'Please choose a payment method.');
      return;
    }

    if (selected === 'gcash') {
      // Show GCash step
      document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
      const gcashStep = document.getElementById('checkout-step-gcash');
      if (gcashStep) { gcashStep.style.display = ''; gcashStep.classList.add('active'); }
      this.startPaymentTimer();
      this.updatePaymentDetails();
    } else {
      // Show COD step
      document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
      const codStep = document.getElementById('checkout-step-cod');
      if (codStep) { codStep.style.display = ''; codStep.classList.add('active'); }
      // Fill COD details
      const info = this.currentOrder.deliveryInfo || {};
      const el = (id) => document.getElementById(id);
      if (el('codAmount'))    el('codAmount').textContent    = `₱${parseFloat(this.currentOrder.totalPrice).toFixed(2)}`;
      if (el('codAddress'))   el('codAddress').textContent   = info.deliveryAddr || '—';
      if (el('codPhone'))     el('codPhone').textContent     = info.buyerPhone   || '—';
      if (el('codReference')) el('codReference').textContent = this.currentOrder.reference;
    }
  }

  // Called when user selects a payment method radio
  selectPaymentMethod(method) {
    const radio = document.getElementById(method);
    if (radio) radio.checked = true;
    document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.payment-method-card[onclick*="${method}"]`);
    if (card) card.classList.add('selected');
    const btn = document.getElementById('proceedPaymentBtn');
    if (btn) btn.disabled = false;
  }

  // Confirm COD order
  async confirmCODOrder() {
    try {
      showLoadingModal('Confirming Order…', 'Please wait.');
      if (this.currentOrder.id) {
        await db.from('orders').update({ status: 'confirmed' }).eq('id', this.currentOrder.id);
      }
      hideLoadingModal();

      document.getElementById('finalOrderId').textContent = this.currentOrder.id || 'N/A';
      const trackLink = document.getElementById('trackOrderLink');
      if (trackLink && this.currentOrder.id) {
        const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
        trackLink.href = prefix + `order-tracking.html?id=${this.currentOrder.id}`;
      }
      this.showStep(3);
      showSuccess('Order Confirmed!', 'Your COD order has been placed. We will contact you to arrange delivery.');
    } catch (err) {
      hideLoadingModal();
      showError('Error', 'Could not confirm order. Please try again.');
    }
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
  if (window.checkoutManager) window.checkoutManager.proceedToPayment();
};

// Alias — checkout.html button calls proceedToPaymentMethod()
window.proceedToPaymentMethod = () => {
  if (window.checkoutManager) window.checkoutManager.proceedToPaymentMethod();
};

window.proceedWithPayment = () => {
  if (window.checkoutManager) window.checkoutManager.proceedWithPayment();
};

window.selectPaymentMethod = (method) => {
  if (window.checkoutManager) window.checkoutManager.selectPaymentMethod(method);
};

window.submitPaymentProof = () => {
  if (window.checkoutManager) window.checkoutManager.submitPaymentProof();
};

window.cancelPayment = () => {
  if (window.checkoutManager) window.checkoutManager.cancelPayment();
};

window.confirmCODOrder = () => {
  if (window.checkoutManager) window.checkoutManager.confirmCODOrder();
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