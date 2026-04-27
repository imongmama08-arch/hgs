// ============================================================
// admin-enhanced.js — Enhanced Professional Admin Functions
// ============================================================

// Enhanced Listings Function with Professional Design
async function loadListingsEnhanced() {
  const list = document.getElementById('listingsList');
  list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2"/></svg><p>Loading listings...</p></div>';

  const statusFilter = document.getElementById('listingStatusFilter')?.value || 'pending';
  const search = document.getElementById('listingSearch')?.value.toLowerCase() || '';

  // For demo purposes, create sample data
  const sampleProducts = [
    {
      id: '1',
      name: 'Vintage Denim Jacket',
      price: 1250.00,
      category: 'Jackets',
      condition: 'Excellent',
      brand: 'Levi\'s',
      sizes: ['S', 'M', 'L'],
      description: 'Classic vintage denim jacket in excellent condition. Perfect for casual wear.',
      images: ['../assets/images/denim-overalls.jpg'],
      status: 'pending',
      created_at: new Date().toISOString(),
      rejection_reason: null
    },
    {
      id: '2',
      name: 'Designer Leather Handbag',
      price: 3500.00,
      category: 'Accessories',
      condition: 'Like New',
      brand: 'Coach',
      sizes: ['One Size'],
      description: 'Authentic Coach leather handbag in pristine condition. Comes with original dust bag.',
      images: ['../assets/images/leather-bomber-jacket.jpg'],
      status: 'approved',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      rejection_reason: null
    },
    {
      id: '3',
      name: 'Casual Cotton T-Shirt',
      price: 450.00,
      category: 'Shirts',
      condition: 'Good',
      brand: 'Uniqlo',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Comfortable cotton t-shirt, slightly faded but still in good wearable condition.',
      images: ['../assets/images/textured-knitted-shirt.jpg'],
      status: 'rejected',
      created_at: new Date(Date.now() - 172800000).toISOString(),
      rejection_reason: 'Image quality too poor, please upload clearer photos'
    }
  ];

  // Filter based on status and search
  let filtered = sampleProducts;
  if (statusFilter !== 'all') {
    filtered = filtered.filter(p => p.status === statusFilter);
  }
  if (search) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
  }

  list.innerHTML = filtered.length
    ? filtered.map(p => {
        // Handle multiple images (take first one or use placeholder)
        const images = p.images || [];
        const primaryImage = images.length > 0 ? images[0] : null;
        const imageUrl = primaryImage || p.image_url || null;
        
        // Format price with currency
        const price = parseFloat(p.price || 0);
        const formattedPrice = `₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        // Format sizes
        const sizes = p.sizes || [];
        const sizesDisplay = sizes.length > 0 ? sizes.map(size => `<span class="size-tag">${size}</span>`).join('') : '<span class="size-tag">One Size</span>';
        
        // Status display
        const statusText = p.status === 'approved' ? 'Approved' : p.status === 'rejected' ? 'Rejected' : 'Pending Review';
        const statusClass = p.status === 'approved' ? 'dash-badge-verified' : p.status === 'rejected' ? 'dash-badge-rejected' : 'dash-badge-pending';
        
        return `
        <div class="admin-card">
          <div class="admin-card-header">
            <div class="admin-card-img-wrap">
              ${imageUrl ? 
                `<img src="${imageUrl}" alt="${p.name}" class="admin-card-img" onerror="this.parentElement.innerHTML='<div class=\\"admin-card-img-placeholder\\">📷<br>No Image</div>'">` :
                '<div class="admin-card-img-placeholder">📷<br>No Image</div>'
              }
            </div>
            <div style="flex: 1;">
              <h3 class="admin-card-title">${p.name || 'Untitled Product'}</h3>
              <div class="admin-card-price">${formattedPrice}</div>
              <div class="admin-card-meta">
                <span class="admin-card-category">${p.category || 'Uncategorized'}</span>
                <span style="color: #9ca3af;">•</span>
                <span>${p.condition || 'Unknown condition'}</span>
                <span style="color: #9ca3af;">•</span>
                <span>Added ${formatDate(p.created_at)}</span>
              </div>
              <div class="admin-card-sizes">
                <strong style="font-size: 12px; color: #6b7280; margin-right: 8px;">SIZES:</strong>
                ${sizesDisplay}
              </div>
              ${p.brand ? `<div class="admin-card-meta"><strong>Brand:</strong> ${p.brand}</div>` : ''}
              ${p.description ? `<div class="admin-card-desc">${p.description}</div>` : ''}
            </div>
            <span class="dash-badge ${statusClass}">${statusText}</span>
          </div>
          ${p.rejection_reason ? `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 16px 0; color: #991b1b;"><strong>Rejection Reason:</strong> ${p.rejection_reason}</div>` : ''}
          <div class="admin-card-actions">
            <button class="admin-btn admin-btn-view" onclick="viewProductDetails('${p.id}')">
              👁️ View Details
            </button>
            ${p.status !== 'approved' ? `
              <button class="admin-btn admin-btn-approve" onclick="approveListingDemo('${p.id}')">
                ✅ Approve Listing
              </button>
            ` : ''}
            ${p.status !== 'rejected' ? `
              <button class="admin-btn admin-btn-reject" onclick="rejectListingDemo('${p.id}')">
                ❌ Reject Listing
              </button>
            ` : ''}
            ${p.status === 'rejected' ? `
              <button class="admin-btn admin-btn-approve" onclick="approveListingDemo('${p.id}')">
                🔄 Re-approve
              </button>
            ` : ''}
          </div>
        </div>`;
      }).join('')
    : '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke-width="2"/></svg><p>No listings found for the selected filter.</p></div>';
}

// Demo functions for testing
function viewProductDetails(productId) {
  alert(`Viewing details for product ID: ${productId}\n\nThis would open a detailed product view with:\n• All product images\n• Complete description\n• Seller information\n• Edit/approval options`);
}

function approveListingDemo(productId) {
  if (confirm('Approve this product listing?')) {
    alert(`Product ${productId} approved! The seller will be notified.`);
    setTimeout(() => {
      loadListingsEnhanced();
    }, 500);
  }
}

function rejectListingDemo(productId) {
  const reason = prompt('Enter rejection reason:');
  if (reason) {
    alert(`Product ${productId} rejected with reason: "${reason}"\n\nThe seller will be notified and can resubmit.`);
    setTimeout(() => {
      loadListingsEnhanced();
    }, 500);
  }
}

// Enhanced date formatting
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  
  return date.toLocaleDateString('en-PH', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Override the original loadListings function
if (typeof loadListings !== 'undefined') {
  window.loadListings = loadListingsEnhanced;
}

// Auto-load enhanced listings when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for the original admin.js to load
  setTimeout(() => {
    if (document.getElementById('listingsList')) {
      loadListingsEnhanced();
    }
  }, 1000);
});

// Enhanced seller verification display
function loadSellersEnhanced() {
  const list = document.getElementById('sellersList');
  if (!list) return;
  
  list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2"/></svg><p>Loading sellers...</p></div>';

  // Sample seller data with live verification
  const sampleSellers = [
    {
      id: '1',
      business_name: 'Juan\'s Fashion Store',
      email: 'juan@email.com',
      phone: '09123456789',
      verified: false,
      created_at: new Date().toISOString(),
      description: 'Selling authentic pre-loved designer items',
      hasLiveVerification: true,
      liveVerificationScore: 87
    },
    {
      id: '2',
      business_name: 'Maria\'s Closet',
      email: 'maria@email.com',
      phone: '09987654321',
      verified: true,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      description: 'Quality second-hand clothing for everyone',
      hasLiveVerification: false,
      liveVerificationScore: null
    }
  ];

  list.innerHTML = sampleSellers.map(s => `
    <div class="admin-card">
      <div class="admin-card-header">
        <div>
          <h3 class="admin-card-title">${s.business_name}</h3>
          <p class="admin-card-meta">${s.email}${s.phone ? ` · ${s.phone}` : ''}</p>
          <p class="admin-card-meta">Applied: ${formatDate(s.created_at)}</p>
          ${s.description ? `<p class="admin-card-desc">${s.description}</p>` : ''}
        </div>
        <span class="dash-badge ${s.verified ? 'dash-badge-verified' : 'dash-badge-pending'}">${s.verified ? 'Verified' : 'Pending'}</span>
      </div>
      
      ${s.hasLiveVerification ? `
        <div class="live-verification-section">
          <div class="verification-header">
            <h4>📹 Live Camera Verification</h4>
            <span class="verification-badge ${s.liveVerificationScore >= 70 ? 'approve' : s.liveVerificationScore >= 40 ? 'review' : 'reject'}">
              ${s.liveVerificationScore >= 70 ? 'High Confidence Match' : s.liveVerificationScore >= 40 ? 'Medium Confidence' : 'Low Confidence'}
            </span>
          </div>
          <div class="verification-details">
            <div class="verification-stats">
              <div class="stat-item">
                <span class="stat-label">AI Confidence:</span>
                <span class="stat-value" style="color: ${s.liveVerificationScore >= 70 ? '#10b981' : s.liveVerificationScore >= 40 ? '#f59e0b' : '#ef4444'}">
                  ${s.liveVerificationScore}%
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Images Captured:</span>
                <span class="stat-value">4 photos</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Verification Time:</span>
                <span class="stat-value">${formatDate(s.created_at)}</span>
              </div>
            </div>
            <div class="verification-recommendation">
              <strong>AI Recommendation:</strong> 
              <span style="color: ${s.liveVerificationScore >= 70 ? '#10b981' : s.liveVerificationScore >= 40 ? '#f59e0b' : '#ef4444'}">
                ${s.liveVerificationScore >= 70 ? 'High confidence match - Recommend approval' : s.liveVerificationScore >= 40 ? 'Medium confidence - Manual review recommended' : 'Low confidence match - Recommend rejection'}
              </span>
            </div>
            <div class="captured-images-preview">
              <button class="btn-view-images" onclick="viewLiveVerificationImages('${s.id}')">
                📸 View Captured Images (4)
              </button>
            </div>
          </div>
        </div>
      ` : ''}
      
      <div class="admin-card-actions">
        ${!s.verified ? `
          <button class="admin-btn admin-btn-approve" onclick="approveSellerDemo('${s.id}')">✅ Approve Seller</button>
          <button class="admin-btn admin-btn-reject" onclick="rejectSellerDemo('${s.id}')">❌ Reject</button>
        ` : `
          <button class="admin-btn admin-btn-reject" onclick="revokeSellerDemo('${s.id}')">Revoke Verification</button>
        `}
      </div>
    </div>
  `).join('');
}

// Demo seller functions
function approveSellerDemo(sellerId) {
  if (confirm('Approve this seller?')) {
    alert(`Seller ${sellerId} approved! They can now start listing products.`);
    setTimeout(() => {
      loadSellersEnhanced();
    }, 500);
  }
}

function rejectSellerDemo(sellerId) {
  const reason = prompt('Enter rejection reason:');
  if (reason) {
    alert(`Seller ${sellerId} rejected with reason: "${reason}"`);
    setTimeout(() => {
      loadSellersEnhanced();
    }, 500);
  }
}

function revokeSellerDemo(sellerId) {
  if (confirm('Revoke seller verification?')) {
    alert(`Seller ${sellerId} verification revoked.`);
    setTimeout(() => {
      loadSellersEnhanced();
    }, 500);
  }
}

// Override seller loading
if (typeof loadSellers !== 'undefined') {
  window.loadSellers = loadSellersEnhanced;
}