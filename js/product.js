// ============================================================
// product.js — Product detail page logic
// Used on: product.html
// ============================================================

const productDetailContent = document.getElementById('productDetailContent');
if (!productDetailContent) throw new Error('product.js loaded on wrong page');

const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

// ---- WISHLIST ----
let wishlist = JSON.parse(localStorage.getItem('wearix-wishlist') || '[]');
function saveWishlist() { localStorage.setItem('wearix-wishlist', JSON.stringify(wishlist)); }

function initWishlistBtn(btn, productName) {
  if (wishlist.includes(productName)) { btn.textContent = '♥'; btn.style.color = '#8e1f1f'; }
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.textContent === '♥') {
      btn.textContent = '♡'; btn.style.color = '';
      wishlist = wishlist.filter(i => i !== productName);
    } else {
      btn.textContent = '♥'; btn.style.color = '#8e1f1f';
      if (!wishlist.includes(productName)) wishlist.push(productName);
      showSuccess('Added to Wishlist', `${productName} saved to your wishlist.`, 'Got it');
    }
    saveWishlist();
  });
}

// ---- RENDER DETAIL ----
async function renderDetail(p) {
  const sizes = p.sizes || ['S', 'M', 'L'];
  document.title = `${p.name} - REWEAR`;
  const breadcrumb = document.getElementById('breadcrumbName');
  if (breadcrumb) breadcrumb.textContent = p.name;

  // Load seller info if available
  let sellerHTML = '';
  let sellerData = null;
  if (p.seller_id) {
    const { data: seller } = await db
      .from('sellers')
      .select('id, business_name, verified, rating, description')
      .eq('id', p.seller_id)
      .single();
    sellerData = seller;
    if (seller) {
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      sellerHTML = `
        <div class="pd-seller-box" style="margin:20px 0;padding:16px;background:#fafafa;border-radius:12px;border:1px solid #eee;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:44px;height:44px;border-radius:50%;background:#c8a96e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;flex-shrink:0;">
                ${seller.business_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-weight:600;font-size:15px;">${seller.business_name}
                  ${seller.verified ? '<span style="background:#e8f5e9;color:#27ae60;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;margin-left:6px;">✓ Verified</span>' : ''}
                </div>
                ${seller.rating ? `<div style="font-size:13px;color:#888;">${starsFromRating(seller.rating)} (${seller.rating})</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <a href="${prefix}seller-profile.html?id=${seller.id}"
                style="padding:8px 16px;background:#fff;border:1px solid #c8a96e;color:#c8a96e;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
                View Profile
              </a>
              <button onclick="openInquiryModal('${seller.id}', '${seller.business_name.replace(/'/g, "\\'")}', '${p.id}')"
                style="padding:8px 16px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                💬 Inquire
              </button>
            </div>
          </div>
        </div>`;
    }
  }

  // Load product reviews
  const { data: reviews } = await db
    .from('reviews')
    .select('*')
    .eq('product_id', p.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : p.rating;
  const reviewCount = reviews?.length || 0;

  const reviewsHTML = reviews?.length ? `
    <div class="pd-reviews" style="margin-top:24px;">
      <h4 style="margin:0 0 12px;font-size:16px;">Buyer Reviews (${reviewCount})</h4>
      ${reviews.map(r => `
        <div style="padding:12px 0;border-bottom:1px solid #eee;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span>${starsFromRating(r.rating)}</span>
            <span style="font-size:12px;color:#888;">${r.buyer_email.replace(/(.{2}).*(@.*)/, '$1***$2')}</span>
            <span style="font-size:12px;color:#bbb;">${new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          ${r.comment ? `<p style="margin:0;font-size:14px;color:#444;">${r.comment}</p>` : ''}
        </div>
      `).join('')}
    </div>` : '';

  productDetailContent.innerHTML = `
    <div class="pd-image-wrap">
      <img src="${p.image_url}" alt="${p.name}" class="pd-image">
      <button class="wishlist-btn pd-wishlist" aria-label="Wishlist">♡</button>
    </div>
    <div class="pd-info">
      <span class="pd-category">${p.category}</span>
      <h1 class="pd-name">${p.name}</h1>
      <div class="pd-rating">${starsFromRating(avgRating)} <span class="pd-rating-num">(${avgRating}${reviewCount ? ` · ${reviewCount} reviews` : ''})</span></div>
      <div class="pd-price-row">
        <span class="pd-price">${formatPrice(p.price)}</span>
        ${p.suggested_price ? `<span class="pd-suggested">Suggested: ${formatPrice(p.suggested_price)}</span>` : ''}
      </div>
      ${p.description ? `<p class="pd-description">${p.description}</p>` : ''}
      ${sellerHTML}
      <div class="pd-size-section">
        <p class="pd-size-label">Select Size</p>
        <div class="pd-sizes">
          ${sizes.map((s, i) => `<button class="pd-size-btn${i === 0 ? ' active' : ''}" data-size="${s}">${s}</button>`).join('')}
        </div>
      </div>
      <div class="pd-actions">
        <button class="btn-primary-large pd-buy-btn" id="pdBuyBtn" ${!p.in_stock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Buy Now</button>
        <button class="btn-secondary-large pd-cart-btn" id="pdCartBtn" ${!p.in_stock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Add to Cart</button>
      </div>
      ${sellerData ? `
      <div style="margin-top:16px;">
        <button onclick="openQuickChatModal('${sellerData.id}', '${sellerData.business_name.replace(/'/g, "\\'")}', '${p.id}', '${p.name.replace(/'/g, "\\'")}')"
          style="width:100%;padding:14px;background:#fff;border:2px solid #c8a96e;color:#c8a96e;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s;"
          onmouseover="this.style.background='#c8a96e';this.style.color='#fff';"
          onmouseout="this.style.background='#fff';this.style.color='#c8a96e';">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat with Seller
        </button>
      </div>` : ''}
      <div class="pd-meta">
        <span class="${p.in_stock ? 'pd-instock' : 'pd-outstock'}">${p.in_stock ? '✓ In Stock' : '✕ Out of Stock'}</span>
      </div>
      ${reviewsHTML}
    </div>`;

  // Size selector
  let selectedSize = sizes[0];
  productDetailContent.querySelectorAll('.pd-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      productDetailContent.querySelectorAll('.pd-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
    });
  });

  // Wishlist
  initWishlistBtn(productDetailContent.querySelector('.pd-wishlist'), p.name);

  const goToCheckout = () => {
    const pid = new URLSearchParams(window.location.search).get('id');
    if (!pid) { showError('Error', 'Product information not found'); return; }
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    window.location.href = prefix + `checkout.html?productId=${pid}&size=${selectedSize}`;
  };

  document.getElementById('pdBuyBtn')?.addEventListener('click', goToCheckout);
  document.getElementById('pdCartBtn')?.addEventListener('click', goToCheckout);
}

// ---- RELATED PRODUCTS ----
async function loadRelated(category, excludeId) {
  const relatedGrid = document.getElementById('relatedGrid');
  if (!relatedGrid) return;
  const { data, error } = await db.from('products').select('*').eq('category', category).eq('status', 'approved').eq('in_stock', true).neq('id', excludeId).limit(4);
  if (error || !data.length) { relatedGrid.innerHTML = '<p class="dash-empty">No related products.</p>'; return; }
  relatedGrid.innerHTML = data.map(p => `
    <div class="product-card" data-id="${p.id}">
      <div class="product-image"><img src="${p.image_url}" alt="${p.name}" loading="lazy"><button class="wishlist-btn">♡</button></div>
      <div class="product-info">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-price">${formatPrice(p.price)}</p>
        <div class="product-sizes">${(p.sizes || []).map(s => `<span class="size-tag">${s}</span>`).join('')}</div>
        <div class="product-rating">${starsFromRating(p.rating)}</div>
      </div>
    </div>`).join('');
  relatedGrid.querySelectorAll('.product-card').forEach(card => {
    initWishlistBtn(card.querySelector('.wishlist-btn'), card.querySelector('.product-name').textContent.trim());
    card.addEventListener('click', e => {
      // Check if the clicked element is the wishlist button or inside it
      if (e.target.classList.contains('wishlist-btn') || 
          e.target.closest('.wishlist-btn')) {
        return;
      }
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      window.location.href = prefix + `product.html?id=${card.dataset.id}`;
    });
  });
}

// ---- LOAD ----
async function loadProductDetail() {
  if (!productId) { productDetailContent.innerHTML = '<p class="dash-empty">Product not found.</p>'; return; }
  const { data: p, error } = await db.from('products').select('*').eq('id', productId).single();
  if (error || !p) {
    productDetailContent.innerHTML = '<p class="dash-empty">Product not found.</p>';
    console.error('[product.js] loadProductDetail:', error?.message);
    return;
  }
  await renderDetail(p);
  loadRelated(p.category, p.id);
}

// Inquiry modal (inline, reused from seller-profile.js pattern)
window.openInquiryModal = function(sid, sellerName, productId) {
  const currentUser = window.authManager?.getCurrentUser();
  const overlay = document.createElement('div');
  overlay.id = 'inquiryOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 4px;">Send Inquiry</h3>
      <p style="color:#888;font-size:14px;margin:0 0 20px;">to ${sellerName}</p>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Your Name</label>
        <input id="inquiryName" type="text" value="${currentUser?.name || ''}" placeholder="Your name"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Your Email</label>
        <input id="inquiryEmail" type="email" value="${currentUser?.email || ''}" placeholder="your@email.com"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Message</label>
        <textarea id="inquiryMessage" rows="4" placeholder="Ask about sizing, condition, availability…"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
      </div>
      <div style="display:flex;gap:12px;">
        <button onclick="submitInquiry('${sid}', '${productId || ''}')"
          style="flex:1;padding:12px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
          Send Message
        </button>
        <button onclick="document.getElementById('inquiryOverlay').remove()"
          style="padding:12px 20px;background:#f5f5f5;color:#333;border:none;border-radius:8px;font-size:15px;cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
};

// Quick chat modal with pre-filled questions
window.openQuickChatModal = function(sid, sellerName, productId, productName) {
  const currentUser = window.authManager?.getCurrentUser();
  const overlay = document.createElement('div');
  overlay.id = 'quickChatOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:500px;width:100%;box-shadow:0 12px 48px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h3 style="margin:0 0 4px;font-size:20px;">Chat with Seller</h3>
          <p style="color:#888;font-size:14px;margin:0;">${sellerName}</p>
        </div>
        <button onclick="document.getElementById('quickChatOverlay').remove()"
          style="width:32px;height:32px;border:none;background:#f5f5f5;border-radius:50%;cursor:pointer;font-size:18px;color:#666;">
          ×
        </button>
      </div>

      <div style="background:#f9f9f9;padding:12px;border-radius:10px;margin-bottom:16px;">
        <div style="font-size:13px;color:#666;margin-bottom:4px;">About:</div>
        <div style="font-weight:600;font-size:14px;">${productName}</div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:8px;">Quick Questions:</label>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button onclick="document.getElementById('quickChatMessage').value='Is this item still available?'"
            style="padding:10px 14px;background:#fff;border:1px solid #ddd;border-radius:8px;text-align:left;cursor:pointer;font-size:13px;transition:all 0.2s;"
            onmouseover="this.style.borderColor='#c8a96e';this.style.background='#fdf8f0';"
            onmouseout="this.style.borderColor='#ddd';this.style.background='#fff';">
            💬 Is this item still available?
          </button>
          <button onclick="document.getElementById('quickChatMessage').value='Can you provide more details about the condition?'"
            style="padding:10px 14px;background:#fff;border:1px solid #ddd;border-radius:8px;text-align:left;cursor:pointer;font-size:13px;transition:all 0.2s;"
            onmouseover="this.style.borderColor='#c8a96e';this.style.background='#fdf8f0';"
            onmouseout="this.style.borderColor='#ddd';this.style.background='#fff';">
            🔍 Can you provide more details about the condition?
          </button>
          <button onclick="document.getElementById('quickChatMessage').value='Do you offer shipping? What are the rates?'"
            style="padding:10px 14px;background:#fff;border:1px solid #ddd;border-radius:8px;text-align:left;cursor:pointer;font-size:13px;transition:all 0.2s;"
            onmouseover="this.style.borderColor='#c8a96e';this.style.background='#fdf8f0';"
            onmouseout="this.style.borderColor='#ddd';this.style.background='#fff';">
            📦 Do you offer shipping? What are the rates?
          </button>
          <button onclick="document.getElementById('quickChatMessage').value='Can I see more photos of this item?'"
            style="padding:10px 14px;background:#fff;border:1px solid #ddd;border-radius:8px;text-align:left;cursor:pointer;font-size:13px;transition:all 0.2s;"
            onmouseover="this.style.borderColor='#c8a96e';this.style.background='#fdf8f0';"
            onmouseout="this.style.borderColor='#ddd';this.style.background='#fff';">
            📸 Can I see more photos of this item?
          </button>
          <button onclick="document.getElementById('quickChatMessage').value='Is the price negotiable?'"
            style="padding:10px 14px;background:#fff;border:1px solid #ddd;border-radius:8px;text-align:left;cursor:pointer;font-size:13px;transition:all 0.2s;"
            onmouseover="this.style.borderColor='#c8a96e';this.style.background='#fdf8f0';"
            onmouseout="this.style.borderColor='#ddd';this.style.background='#fff';">
            💰 Is the price negotiable?
          </button>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Your Name</label>
        <input id="quickChatName" type="text" value="${currentUser?.name || ''}" placeholder="Your name"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Your Email</label>
        <input id="quickChatEmail" type="email" value="${currentUser?.email || ''}" placeholder="your@email.com"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
      </div>

      <div style="margin-bottom:20px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px;">Your Message</label>
        <textarea id="quickChatMessage" rows="4" placeholder="Type your question or select from quick questions above..."
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
      </div>

      <div style="display:flex;gap:12px;">
        <button onclick="submitQuickChat('${sid}', '${productId}')"
          style="flex:1;padding:14px;background:#c8a96e;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
          Send Message
        </button>
        <button onclick="document.getElementById('quickChatOverlay').remove()"
          style="padding:14px 24px;background:#f5f5f5;color:#333;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">
          Cancel
        </button>
      </div>

      <div style="margin-top:16px;padding:12px;background:#e8f5e9;border-radius:8px;font-size:12px;color:#155724;">
        💡 <strong>Tip:</strong> The seller will receive your message and reply in their dashboard. You can check replies in your <strong>Buyer Dashboard → Messages</strong>.
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target.id === 'quickChatOverlay') {
      overlay.remove();
    }
  });
};

window.submitQuickChat = async function(sid, productId) {
  const name    = document.getElementById('quickChatName')?.value.trim();
  const email   = document.getElementById('quickChatEmail')?.value.trim();
  const message = document.getElementById('quickChatMessage')?.value.trim();
  
  if (!name || !email || !message) { 
    alert('Please fill in all fields.'); 
    return; 
  }
  
  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    alert('Please enter a valid email address.');
    return;
  }
  
  try {
    showLoadingModal('Sending...', 'Sending your message to the seller.');
    
    const payload = { 
      seller_id: sid, 
      buyer_name: name, 
      buyer_email: email, 
      message 
    };
    if (productId) payload.product_id = productId;
    
    const { error } = await db.from('messages').insert(payload);
    if (error) throw error;
    
    hideLoadingModal();
    document.getElementById('quickChatOverlay')?.remove();
    
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    showSuccess(
      'Message Sent! ✉️', 
      `Your message has been sent to the seller. They will reply soon. <br><br><a href="${prefix}dashboard-buyer.html#messages" style="color:#c8a96e;font-weight:600;text-decoration:underline;">View in Messages →</a>`, 
      'Got it'
    );
  } catch (err) {
    hideLoadingModal();
    console.error('[quickChat]', err);
    showError('Failed to Send', 'Could not send message. Please try again.');
  }
};

window.submitInquiry = async function(sid, productId) {
  const name    = document.getElementById('inquiryName')?.value.trim();
  const email   = document.getElementById('inquiryEmail')?.value.trim();
  const message = document.getElementById('inquiryMessage')?.value.trim();
  if (!name || !email || !message) { alert('Please fill in all fields.'); return; }
  try {
    const payload = { seller_id: sid || null, buyer_name: name, buyer_email: email, message };
    if (productId) payload.product_id = productId;
    const { error } = await db.from('messages').insert(payload);
    if (error) throw error;
    document.getElementById('inquiryOverlay')?.remove();
    const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    showSuccess('Message Sent!', `Your inquiry has been sent. <a href="${prefix}dashboard-buyer.html#messages" style="color:#c8a96e;font-weight:600;">View in Messages →</a>`, 'Got it');
  } catch (err) {
    console.error('[inquiry]', err);
    alert('Could not send message. Please try again.');
  }
};

loadProductDetail();
