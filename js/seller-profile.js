// ============================================================
// seller-profile.js — Seller public profile page
// Shows seller info, ratings, listings, and reviews
// ============================================================

const params = new URLSearchParams(window.location.search);
const sellerId = params.get('id');

async function loadSellerProfile() {
  const content = document.getElementById('sellerProfileContent');
  if (!sellerId) {
    content.innerHTML = '<p class="dash-empty">Seller not found.</p>';
    return;
  }

  try {
    const { data: seller, error } = await db
      .from('sellers')
      .select('*')
      .eq('id', sellerId)
      .single();

    if (error || !seller) {
      content.innerHTML = '<p class="dash-empty">Seller not found.</p>';
      return;
    }

    // Update breadcrumb
    const bc = document.getElementById('breadcrumbSellerName');
    if (bc) bc.textContent = seller.business_name;
    document.title = `${seller.business_name} - REWEAR`;

    // Load review stats
    const { data: reviews } = await db
      .from('reviews')
      .select('rating')
      .eq('seller_id', sellerId);

    const avgRating = reviews?.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : '—';
    const reviewCount = reviews?.length || 0;

    // GCash info from localStorage (seller saves it there)
    const gcashData = JSON.parse(localStorage.getItem(`rewear_gcash_${sellerId}`) || '{}');

    content.innerHTML = `
      <div class="seller-profile-card" style="display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap;padding:32px;background:#fff;border-radius:16px;box-shadow:0 2px 16px rgba(0,0,0,0.07);margin-bottom:32px;">
        <div class="seller-avatar" style="width:96px;height:96px;border-radius:50%;background:#c8a96e;display:flex;align-items:center;justify-content:center;font-size:40px;color:#fff;flex-shrink:0;">
          ${seller.avatar_url
            ? `<img src="${seller.avatar_url}" alt="${seller.business_name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
            : seller.business_name.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;min-width:200px;">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <h2 style="margin:0;font-size:24px;">${seller.business_name}</h2>
            ${seller.verified ? '<span style="background:#e8f5e9;color:#27ae60;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">✓ Verified</span>' : ''}
          </div>
          <div style="margin:8px 0;color:#888;font-size:14px;">
            ${seller.description || 'No description provided.'}
          </div>
          <div style="display:flex;gap:24px;margin-top:12px;flex-wrap:wrap;">
            <div style="text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#c8a96e;">${avgRating}</div>
              <div style="font-size:12px;color:#888;">Avg Rating</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#c8a96e;">${reviewCount}</div>
              <div style="font-size:12px;color:#888;">Reviews</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#c8a96e;" id="sellerListingCount">—</div>
              <div style="font-size:12px;color:#888;">Listings</div>
            </div>
          </div>
        </div>
        <div>
          <button onclick="openInquiryModal('${sellerId}', '${seller.business_name}', null)"
            style="padding:12px 24px;background:#c8a96e;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">
            💬 Send Inquiry
          </button>
        </div>
      </div>
    `;

    loadSellerListings(seller.business_name);
    loadSellerReviews();

  } catch (err) {
    console.error('[seller-profile]', err);
    document.getElementById('sellerProfileContent').innerHTML = '<p class="dash-empty">Could not load seller profile.</p>';
  }
}

async function loadSellerListings(businessName) {
  const grid = document.getElementById('sellerListingsGrid');
  const title = document.getElementById('sellerListingsTitle');
  if (title) title.textContent = `${businessName || 'Seller'}'s Listings`;

  const { data, error } = await db
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('status', 'approved')
    .eq('in_stock', true);

  const countEl = document.getElementById('sellerListingCount');
  if (countEl) countEl.textContent = data?.length || 0;

  if (error || !data?.length) {
    grid.innerHTML = '<p class="dash-empty">No active listings.</p>';
    return;
  }

  const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
  grid.innerHTML = data.map(p => `
    <div class="product-card" onclick="location.href='${prefix}product.html?id=${p.id}'" style="cursor:pointer;">
      <div class="product-image">
        <img src="${p.image_url}" alt="${p.name}" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-price">₱${parseFloat(p.price).toFixed(2)}</p>
        <div class="product-sizes">${(p.sizes || []).map(s => `<span class="size-tag">${s}</span>`).join('')}</div>
        <div class="product-rating">${starsFromRating(p.rating)}</div>
      </div>
    </div>
  `).join('');
}

async function loadSellerReviews() {
  const list = document.getElementById('sellerReviewsList');

  const { data, error } = await db
    .from('reviews')
    .select('*, products(name)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    list.innerHTML = '<p class="dash-empty" style="padding:24px;">No reviews yet.</p>';
    return;
  }

  list.innerHTML = data.map(r => `
    <div style="padding:16px;border-bottom:1px solid #eee;display:flex;gap:16px;align-items:flex-start;">
      <div style="font-size:24px;line-height:1;">${starsFromRating(r.rating)}</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">${r.buyer_email.replace(/(.{2}).*(@.*)/, '$1***$2')}</div>
        ${r.products?.name ? `<div style="font-size:12px;color:#888;margin:2px 0;">on ${r.products.name}</div>` : ''}
        ${r.comment ? `<p style="margin:6px 0 0;font-size:14px;color:#444;">${r.comment}</p>` : ''}
        <div style="font-size:12px;color:#aaa;margin-top:4px;">${new Date(r.created_at).toLocaleDateString()}</div>
      </div>
    </div>
  `).join('');
}

// ---- INQUIRY MODAL ----
window.openInquiryModal = function(sid, sellerName, productId) {
  const currentUser = window.authManager?.getCurrentUser();

  const overlay = document.createElement('div');
  overlay.id = 'inquiryOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 4px;">Send Inquiry</h3>
      <p style="color:#888;font-size:14px;margin:0 0 20px;">to ${sellerName}</p>
      <div class="form-group" style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Your Name</label>
        <input id="inquiryName" type="text" value="${currentUser?.name || ''}" placeholder="Your name"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">Your Email</label>
        <input id="inquiryEmail" type="email" value="${currentUser?.email || ''}" placeholder="your@email.com"
          style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;">
      </div>
      <div class="form-group" style="margin-bottom:20px;">
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

window.submitInquiry = async function(sid, productId) {
  const name    = document.getElementById('inquiryName')?.value.trim();
  const email   = document.getElementById('inquiryEmail')?.value.trim();
  const message = document.getElementById('inquiryMessage')?.value.trim();

  if (!name || !email || !message) {
    alert('Please fill in all fields.');
    return;
  }

  try {
    const payload = {
      seller_id:   sid || null,
      buyer_name:  name,
      buyer_email: email,
      message:     message
    };
    if (productId) payload.product_id = productId;

    const { error } = await db.from('messages').insert(payload);
    if (error) throw error;

    document.getElementById('inquiryOverlay')?.remove();
    showSuccess('Message Sent!', 'Your inquiry has been sent to the seller.', 'Got it');
  } catch (err) {
    console.error('[inquiry]', err);
    alert('Could not send message. Please try again.');
  }
};

// Init
loadSellerProfile();
