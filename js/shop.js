// ============================================================
// shop.js — REWEAR Buyer Browse Page
// Features: search, category tabs, condition/size/price filter
//           drawer, sort, grid/list view, wishlist, load more,
//           skeleton loading, empty state, active filter tags
// ============================================================

// ---- Guard ----
const productsGrid = document.getElementById('productsGrid');
if (!productsGrid) throw new Error('shop.js: productsGrid not found');

// ---- Validation Helper ----
function validateProduct(product) {
  const issues = [];
  
  if (!product.id) issues.push('Missing id');
  if (!product.name) issues.push('Missing name');
  if (!product.category) issues.push('Missing category');
  if (typeof product.price !== 'number') issues.push('Invalid price');
  
  if (issues.length > 0) {
    console.warn('[shop.js] Product validation failed:', product.id || 'unknown', issues);
    return false;
  }
  
  // Validate category is one of the expected values
  const validCategories = ['all', 'shirts', 'pants', 'jackets', 'shoes', 'accessories'];
  if (!validCategories.includes(product.category)) {
    console.warn('[shop.js] Invalid category:', product.category, 'for product:', product.id);
    return false;
  }
  
  return true;
}

// ---- State ----
let allProducts   = [];
let filtered      = [];
let currentCategory = 'all';
let currentSort     = 'default';
let searchQuery     = '';
let isListView      = false;
let visibleCount    = 12;
const PAGE_SIZE     = 12;

// Drawer filters (staged until Apply is clicked)
let stagedConditions = [];
let stagedSizes      = [];
let stagedPriceMin   = null;
let stagedPriceMax   = null;

// Applied filters
let activeConditions = [];
let activeSizes      = [];
let activePriceMin   = null;
let activePriceMax   = null;

// ---- WISHLIST ----
let wishlist = JSON.parse(localStorage.getItem('rewear-wishlist') || '[]');

function saveWishlist() {
  localStorage.setItem('rewear-wishlist', JSON.stringify(wishlist));
  updateWishlistBadge();
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlistBadge');
  if (!badge) return;
  
  if (wishlist.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = wishlist.length;
  } else {
    badge.style.display = 'none';
  }
}

updateWishlistBadge();

// ---- SEARCH (nav + mobile) ----
function onSearch(val) {
  searchQuery = val.trim().toLowerCase();
  visibleCount = PAGE_SIZE;
  applyFiltersAndSort();
}

const navSearch = document.getElementById('navSearchInput');
const mobSearch = document.getElementById('mobileSearchInput');

if (navSearch) navSearch.addEventListener('input', e => { 
  if (mobSearch) mobSearch.value = e.target.value; 
  onSearch(e.target.value); 
});

if (mobSearch) mobSearch.addEventListener('input', e => { 
  if (navSearch) navSearch.value = e.target.value; 
  onSearch(e.target.value); 
});

// ---- CATEGORY TABS (REMOVED - now handled by sidebar only) ----
// Category tabs removed from UI, functionality moved to sidebar filters

// Keep filterByCategory function for banner clicks
function filterByCategory(cat) {
  // Sync with radio buttons in sidebar
  const radio = document.querySelector(`input[name="category"][value="${cat}"]`);
  if (radio) {
    radio.checked = true;
    // Trigger the change event to apply filter
    radio.dispatchEvent(new Event('change'));
  }
  
  currentCategory = cat;
  visibleCount = PAGE_SIZE;
  updateGridTitle();
  applyFiltersAndSort();
  document.getElementById('productsGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.filterByCategory = filterByCategory;

function updateGridTitle() {
  const titleEl = document.getElementById('gridTitle');
  const subEl   = document.getElementById('gridSubtitle');
  
  const labels  = { 
    all:'All Listings', 
    shirts:'Tops & Shirts', 
    pants:'Bottoms', 
    jackets:'Outerwear', 
    shoes:'Footwear', 
    accessories:'Accessories' 
  };
  
  const subs    = { 
    all:'Curated preloved pieces from verified sellers', 
    shirts:'Preloved tops — shirts, blouses & more', 
    pants:'Denim, trousers, skirts & bottoms', 
    jackets:'Jackets, coats & outerwear', 
    shoes:'Preloved footwear in great condition', 
    accessories:'Bags, belts, jewellery & more' 
  };
  
  if (titleEl) titleEl.textContent = labels[currentCategory] || 'Listings';
  if (subEl)   subEl.textContent   = subs[currentCategory]   || '';
}

// ---- SORT ----
const sortSelect = document.getElementById('sortSelect');
const sortLabel  = document.getElementById('sortLabel');
const sortLabels = { 
  default:'Sort', 
  newest:'Newest', 
  price_asc:'Price ↑', 
  price_desc:'Price ↓', 
  rating:'Top Rated', 
  savings:'Best Savings' 
};

if (sortSelect) sortSelect.addEventListener('change', e => {
  currentSort = e.target.value;
  if (sortLabel) sortLabel.textContent = sortLabels[currentSort] || 'Sort';
  applyFiltersAndSort();
});

// ---- VIEW TOGGLE ----
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');

if (gridViewBtn) gridViewBtn.addEventListener('click', () => { 
  isListView = false; 
  productsGrid.classList.remove('list-view'); 
  gridViewBtn.classList.add('active'); 
  listViewBtn.classList.remove('active'); 
});

if (listViewBtn) listViewBtn.addEventListener('click', () => { 
  isListView = true; 
  productsGrid.classList.add('list-view'); 
  listViewBtn.classList.add('active'); 
  gridViewBtn.classList.remove('active'); 
});

// ---- FILTER DRAWER ----
const filterBtn     = document.getElementById('filterBtn');
const filterOverlay = document.getElementById('filterOverlay');
const filterDrawer  = document.getElementById('filterDrawer');
const drawerClose   = document.getElementById('drawerClose');

function openDrawer() {
  // Sync staged state to current active
  stagedConditions = [...activeConditions];
  stagedSizes      = [...activeSizes];
  stagedPriceMin   = activePriceMin;
  stagedPriceMax   = activePriceMax;
  
  syncDrawerUI();
  filterDrawer.classList.add('open');
  filterOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  filterDrawer.classList.remove('open');
  filterOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

if (filterBtn)     filterBtn.addEventListener('click', openDrawer);
if (filterOverlay) filterOverlay.addEventListener('click', closeDrawer);
if (drawerClose)   drawerClose.addEventListener('click', closeDrawer);

function syncDrawerUI() {
  document.querySelectorAll('#conditionChips .f-chip').forEach(c => 
    c.classList.toggle('active', stagedConditions.includes(c.dataset.condition))
  );
  
  document.querySelectorAll('#sizeChips .f-chip').forEach(c => 
    c.classList.toggle('active', stagedSizes.includes(c.dataset.size))
  );
  
  const minEl = document.getElementById('priceMin');
  const maxEl = document.getElementById('priceMax');
  if (minEl) minEl.value = stagedPriceMin || '';
  if (maxEl) maxEl.value = stagedPriceMax || '';
}

// Condition chips toggle - INSTANT FILTER
document.querySelectorAll('#conditionChips .f-chip, .condition-pill').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    const val = chip.dataset.condition;
    if (activeConditions.includes(val)) {
      activeConditions = activeConditions.filter(c => c !== val);
    } else {
      activeConditions.push(val);
    }
    // Apply instantly
    visibleCount = PAGE_SIZE;
    applyFiltersAndSort();
    updateActiveFilterTags();
    updateFilterBadge();
  });
});

// Size chips toggle - INSTANT FILTER
document.querySelectorAll('#sizeChips .f-chip, .size-filter-btn').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    const val = chip.dataset.size;
    if (activeSizes.includes(val)) {
      activeSizes = activeSizes.filter(s => s !== val);
    } else {
      activeSizes.push(val);
    }
    // Apply instantly
    visibleCount = PAGE_SIZE;
    applyFiltersAndSort();
    updateActiveFilterTags();
    updateFilterBadge();
  });
});

// Category filter - INSTANT FILTER
document.querySelectorAll('input[name="category"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const category = radio.value;
    // Update category tabs to match
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.cat-tab[data-category="${category}"]`);
    if (tab) tab.classList.add('active');
    // Update the current category (FIX: was using wrong variable name)
    currentCategory = category;
    visibleCount = PAGE_SIZE;
    updateGridTitle();
    applyFiltersAndSort();
    updateActiveFilterTags();
  });
});

// Price range - INSTANT FILTER (on input change)
const priceMinInput = document.getElementById('priceMin');
const priceMaxInput = document.getElementById('priceMax');

if (priceMinInput) {
  priceMinInput.addEventListener('input', () => {
    activePriceMin = parseFloat(priceMinInput.value) || null;
    visibleCount = PAGE_SIZE;
    applyFiltersAndSort();
    updateActiveFilterTags();
    updateFilterBadge();
  });
}

if (priceMaxInput) {
  priceMaxInput.addEventListener('input', () => {
    activePriceMax = parseFloat(priceMaxInput.value) || null;
    visibleCount = PAGE_SIZE;
    applyFiltersAndSort();
    updateActiveFilterTags();
    updateFilterBadge();
  });
}

// Reset filters
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => {
  // Reset active filters
  activeConditions = []; 
  activeSizes = []; 
  activePriceMin = null; 
  activePriceMax = null;
  
  // Reset UI
  document.querySelectorAll('#conditionChips .f-chip, #sizeChips .f-chip, .condition-pill, .size-filter-btn').forEach(c => 
    c.classList.remove('active')
  );
  
  const minEl = document.getElementById('priceMin'); 
  const maxEl = document.getElementById('priceMax');
  if (minEl) minEl.value = ''; 
  if (maxEl) maxEl.value = '';
  
  // Reset category to "all"
  const allRadio = document.querySelector('input[name="category"][value="all"]');
  if (allRadio) allRadio.checked = true;
  
  visibleCount = PAGE_SIZE;
  applyFiltersAndSort();
  updateActiveFilterTags();
  updateFilterBadge();
});

function updateFilterBadge() {
  const total = activeConditions.length + activeSizes.length + 
                (activePriceMin ? 1 : 0) + (activePriceMax ? 1 : 0);
  const badge = document.getElementById('filterCountBadge');
  const pill  = document.getElementById('filterBtn');
  
  if (!badge) return;
  
  if (total > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = total;
    pill.classList.add('active');
  } else {
    badge.style.display = 'none';
    pill.classList.remove('active');
  }
}

function updateActiveFilterTags() {
  const bar = document.getElementById('activeFiltersBar');
  if (!bar) return;
  
  bar.innerHTML = '';
  const tags = [];
  
  activeConditions.forEach(c => tags.push({ 
    label: condLabel(c), 
    remove: () => { 
      activeConditions = activeConditions.filter(x => x !== c); 
      applyFiltersAndSort(); 
      updateActiveFilterTags(); 
      updateFilterBadge(); 
    } 
  }));
  
  activeSizes.forEach(s => tags.push({ 
    label: `Size: ${s}`, 
    remove: () => { 
      activeSizes = activeSizes.filter(x => x !== s); 
      applyFiltersAndSort(); 
      updateActiveFilterTags(); 
      updateFilterBadge(); 
    } 
  }));
  
  if (activePriceMin) tags.push({ 
    label: `Min ₱${activePriceMin}`, 
    remove: () => { 
      activePriceMin = null; 
      applyFiltersAndSort(); 
      updateActiveFilterTags(); 
      updateFilterBadge(); 
    } 
  });
  
  if (activePriceMax) tags.push({ 
    label: `Max ₱${activePriceMax}`, 
    remove: () => { 
      activePriceMax = null; 
      applyFiltersAndSort(); 
      updateActiveFilterTags(); 
      updateFilterBadge(); 
    } 
  });
  
  if (tags.length > 0) {
    bar.classList.add('visible');
    
    const label = document.createElement('span');
    label.className = 'af-label';
    label.textContent = 'Filters:';
    bar.appendChild(label);
    
    tags.forEach(t => {
      const tag = document.createElement('div');
      tag.className = 'af-tag';
      tag.innerHTML = `${t.label} <button aria-label="Remove filter">✕</button>`;
      tag.querySelector('button').addEventListener('click', t.remove);
      bar.appendChild(tag);
    });
  } else {
    bar.classList.remove('visible');
  }
}

function condLabel(c) {
  return { 
    'like-new':'Like New', 
    'good':'Good', 
    'fair':'Fair', 
    'preloved':'Preloved' 
  }[c] || c;
}

// ---- APPLY ALL FILTERS + SORT ----
function applyFiltersAndSort() {
  let result = [...allProducts];
  
  // Category filter
  if (currentCategory && currentCategory !== 'all') {
    result = result.filter(p => {
      // Defensive: ensure product has category and it matches
      if (!p.category) {
        console.warn('[shop.js] Product missing category:', p.id, p.name);
        return false;
      }
      return p.category === currentCategory;
    });
    
    console.log(`[shop.js] Category filter: ${currentCategory}, found ${result.length} products`);
  }
  
  // Search
  if (searchQuery) {
    result = result.filter(p =>
      (p.name || '').toLowerCase().includes(searchQuery) ||
      (p.description || '').toLowerCase().includes(searchQuery) ||
      (p.category || '').toLowerCase().includes(searchQuery)
    );
  }
  
  // Condition (simulated via DB field; fallback to random assignment for demo)
  if (activeConditions.length > 0) {
    result = result.filter(p => {
      const cond = getCondition(p);
      return activeConditions.includes(cond);
    });
  }
  
  // Size
  if (activeSizes.length > 0) {
    result = result.filter(p => {
      const sizes = p.sizes || [];
      return activeSizes.some(s => sizes.includes(s));
    });
  }
  
  // Price
  if (activePriceMin !== null) result = result.filter(p => p.price >= activePriceMin);
  if (activePriceMax !== null) result = result.filter(p => p.price <= activePriceMax);
  
  // Sort
  if (currentSort === 'price_asc')  result.sort((a, b) => a.price - b.price);
  if (currentSort === 'price_desc') result.sort((a, b) => b.price - a.price);
  if (currentSort === 'rating')     result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (currentSort === 'newest')     result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (currentSort === 'savings')    result.sort((a, b) => getSavings(b) - getSavings(a));
  
  filtered = result;
  updateCounters();
  renderProducts();
}

function getSavings(p) {
  if (p.suggested_price && p.price < p.suggested_price) {
    return p.suggested_price - p.price;
  }
  return 0;
}

// Simulated condition based on product ID hash (no real field in DB yet)
const CONDITIONS = ['like-new', 'good', 'fair', 'preloved'];

function getCondition(p) {
  if (p.condition) return p.condition;
  
  // Deterministic pseudo-random from id
  const sum = (p.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CONDITIONS[sum % CONDITIONS.length];
}

function updateCounters() {
  const cats = ['all', 'shirts', 'pants', 'jackets', 'shoes', 'accessories'];
  
  cats.forEach(cat => {
    const el = document.getElementById(`cnt-${cat}`);
    if (!el) return;
    
    const count = cat === 'all' ? 
      allProducts.length : 
      allProducts.filter(p => p.category === cat).length;
    
    el.textContent = count ? `(${count})` : '';
  });
  
  const chip = document.getElementById('resultsChip');
  if (chip) chip.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
  
  const stat = document.getElementById('statListings');
  if (stat && allProducts.length > 0) stat.textContent = allProducts.length + '+';
}

// ---- RENDER ----
function renderProducts() {
  const slice = filtered.slice(0, visibleCount);
  
  if (!filtered.length) {
    productsGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🔍</span>
        <h3>No pieces found</h3>
        <p>Try adjusting your filters or search term to find what you're looking for.</p>
        <button class="btn-primary" onclick="clearAllFilters()">Clear Filters</button>
      </div>`;
    document.getElementById('loadMoreWrap').style.display = 'none';
    return;
  }
  
  productsGrid.innerHTML = slice.map(p => productCardHTML(p)).join('');
  
  // Wire up wishlist buttons
  productsGrid.querySelectorAll('.product-card').forEach(card => {
    const btn   = card.querySelector('.wishlist-btn');
    const pid   = card.dataset.id;
    const pname = card.dataset.name;
    
    if (wishlist.includes(pid)) btn.classList.add('wishlisted');
    
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      
      if (wishlist.includes(pid)) {
        wishlist = wishlist.filter(i => i !== pid);
        btn.classList.remove('wishlisted');
        btn.textContent = '♡';
      } else {
        wishlist.push(pid);
        btn.classList.add('wishlisted');
        btn.textContent = '♥';
        if (typeof showSuccess === 'function') {
          showSuccess('Added to Wishlist', `${pname} saved to your wishlist.`);
        }
      }
      saveWishlist();
    });
    
    card.addEventListener('click', e => {
      // Check if the clicked element is the wishlist button or inside it
      if (e.target.classList.contains('wishlist-btn') || 
          e.target.closest('.wishlist-btn')) {
        return;
      }
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      window.location.href = prefix + `product.html?id=${pid}`;
    });
  });
  
  // Load more state
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const loadMoreBtn  = document.getElementById('loadMoreBtn');
  const loadMoreProg = document.getElementById('loadMoreProgress');
  
  if (filtered.length > visibleCount) {
    loadMoreWrap.style.display = 'block';
    loadMoreBtn.disabled = false;
    loadMoreProg.textContent = `Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length} items`;
  } else {
    loadMoreWrap.style.display = filtered.length > PAGE_SIZE ? 'block' : 'none';
    if (loadMoreBtn) loadMoreBtn.disabled = true;
    if (loadMoreProg) loadMoreProg.textContent = `All ${filtered.length} items shown`;
  }
}

function productCardHTML(p) {
  const condition = getCondition(p);
  const condLabel = { 
    'like-new':'Like New', 
    'good':'Good', 
    'fair':'Fair', 
    'preloved':'Preloved' 
  }[condition] || 'Preloved';
  
  const savings   = getSavings(p);
  const savePct   = p.suggested_price ? Math.round((savings / p.suggested_price) * 100) : 0;
  const sizes     = (p.sizes || []).slice(0, 4);
  const inWishlist = wishlist.includes(p.id);
  
  // Check if product is actually in stock (should always be true for buyer-facing products)
  const isInStock = p.in_stock !== false; // Default to true if undefined
  
  return `
    <div class="product-card" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
      <div class="product-image">
        <img src="${p.image_url || 'assets/images/studio-white.jpg'}" alt="${escapeHtml(p.name)}" loading="lazy">
        <span class="condition-badge ${condition}">${condLabel}</span>
        <button type="button" class="wishlist-btn ${inWishlist ? 'wishlisted' : ''}" aria-label="Toggle wishlist">
          ${inWishlist ? '♥' : '♡'}
        </button>
        <div class="quick-view-btn">View Details →</div>
      </div>
      <div class="product-info">
        <div class="product-brand">${p.category ? categoryLabel(p.category) : 'REWEAR'}</div>
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-price-row">
          <span class="product-price">${formatPHP(p.price)}</span>
          ${p.suggested_price ? `<span class="product-suggested">${formatPHP(p.suggested_price)}</span>` : ''}
          ${savePct >= 10 ? `<span class="product-save-tag">-${savePct}%</span>` : ''}
        </div>
        <div class="product-card-footer">
          <div class="product-size-chips">
            ${sizes.map(s => `<span class="size-chip">${s}</span>`).join('')}
            ${(p.sizes || []).length > 4 ? `<span class="size-chip">+${(p.sizes || []).length - 4}</span>` : ''}
          </div>
          <div class="product-rating">${starsFromRating(p.rating || 5)}</div>
        </div>
        ${!isInStock ? `<div class="product-stock-status pd-outstock">✕ Out of Stock</div>` : ''}
      </div>
    </div>`;
}

function categoryLabel(cat) {
  return { 
    shirts:'Tops', 
    pants:'Bottoms', 
    jackets:'Outerwear', 
    shoes:'Footwear', 
    accessories:'Accessories' 
  }[cat] || cat;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ---- LOAD MORE ----
const loadMoreBtn = document.getElementById('loadMoreBtn');
if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => {
  visibleCount += PAGE_SIZE;
  renderProducts();
  
  // Animate new cards in
  const cards = productsGrid.querySelectorAll('.product-card');
  const newStart = visibleCount - PAGE_SIZE;
  
  Array.from(cards).slice(newStart).forEach((card, i) => {
    card.style.opacity = 0;
    card.style.transform = 'translateY(16px)';
    
    requestAnimationFrame(() => {
      card.style.transition = `opacity 0.35s ease ${i * 0.05}s, transform 0.35s ease ${i * 0.05}s`;
      card.style.opacity = 1;
      card.style.transform = 'translateY(0)';
    });
  });
});

// ---- CLEAR ALL ----
function clearAllFilters() {
  activeConditions = []; 
  activeSizes = []; 
  activePriceMin = null; 
  activePriceMax = null;
  currentCategory = 'all'; 
  searchQuery = '';
  
  document.querySelectorAll('.cat-tab').forEach(t => 
    t.classList.toggle('active', t.dataset.category === 'all')
  );
  
  if (document.getElementById('navSearchInput')) document.getElementById('navSearchInput').value = '';
  if (document.getElementById('mobileSearchInput')) document.getElementById('mobileSearchInput').value = '';
  
  visibleCount = PAGE_SIZE;
  applyFiltersAndSort();
  updateActiveFilterTags();
  updateFilterBadge();
  updateGridTitle();
}

window.clearAllFilters = clearAllFilters;

// ---- LOAD FROM SUPABASE ----
async function loadProducts() {
  // Show skeleton loading
  const productsGrid = document.getElementById('productsGrid');
  if (productsGrid && window.SkeletonLoader) {
    SkeletonLoader.show(productsGrid, 'productGrid', 8);
  }
  
  try {
    console.log('[shop.js] Loading products for buyers...');
    
    // CRITICAL: This query determines what products buyers can see
    // Products must have BOTH status='approved' AND in_stock=true
    const { data, error } = await db.from('products')
      .select('*')
      .eq('status', 'approved')
      .eq('in_stock', true);
    
    if (error) {
      console.error('[shop.js] loadProducts error:', error.message);
      // Show demo products on error so the page still looks good
      allProducts = getDemoProducts();
      applyFiltersAndSort();
      return;
    }
    
    console.log('[shop.js] Query results:', {
      totalFound: data?.length || 0,
      sampleProducts: data?.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        in_stock: p.in_stock,
        seller_id: p.seller_id,
        created_at: p.created_at
      })) || []
    });
    
    if (!data || data.length === 0) {
      console.warn('[shop.js] No approved products found! This means:');
      console.warn('1. No products have been created yet, OR');
      console.warn('2. Products exist but have not been approved by admin, OR');
      console.warn('3. Products are approved but in_stock is false');
      
      // Let's check what products actually exist
      const { data: allProductsCheck } = await db.from('products').select('id, name, status, in_stock, seller_id, created_at');
      console.log('[shop.js] All products in database:', allProductsCheck);
      
      if (allProductsCheck && allProductsCheck.length > 0) {
        const statusBreakdown = allProductsCheck.reduce((acc, p) => {
          const key = `${p.status}_${p.in_stock ? 'instock' : 'outofstock'}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        console.log('[shop.js] Product status breakdown:', statusBreakdown);
        
        // Show specific guidance based on what we found
        const pendingCount = allProductsCheck.filter(p => p.status === 'pending').length;
        const approvedButOutOfStock = allProductsCheck.filter(p => p.status === 'approved' && !p.in_stock).length;
        
        if (pendingCount > 0) {
          console.log(`[shop.js] Found ${pendingCount} products pending admin approval`);
        }
        if (approvedButOutOfStock > 0) {
          console.log(`[shop.js] Found ${approvedButOutOfStock} approved products that are out of stock`);
        }
      }
    }
    
    console.log('[shop.js] Loaded products:', data?.length || 0, 'approved and in-stock products');
    
    // Validate products before using them
    if (data && data.length > 0) {
      const validProducts = data.filter(validateProduct);
      const invalidCount = data.length - validProducts.length;
      
      if (invalidCount > 0) {
        console.warn(`[shop.js] Filtered out ${invalidCount} invalid products`);
      }
      
      allProducts = validProducts;
      console.log('[shop.js] Valid products loaded:', allProducts.length);
    } else {
      allProducts = getDemoProducts();
    }
    
    applyFiltersAndSort();
  } catch (err) {
    console.error('[shop.js] loadProducts exception:', err);
    allProducts = getDemoProducts();
    applyFiltersAndSort();
  }
}

// Demo fallback products for when DB is empty or unavailable
function getDemoProducts() {
  return [
    { 
      id:'demo-1', 
      name:'Classic Denim Jacket', 
      price:850, 
      suggested_price:1500, 
      category:'jackets', 
      image_url:'assets/images/leather-bomber-jacket.jpg', 
      rating:5, 
      sizes:['S','M','L','XL'], 
      in_stock:true 
    },
    { 
      id:'demo-2', 
      name:'Premium Cotton Shirt', 
      price:480, 
      suggested_price:900, 
      category:'shirts', 
      image_url:'assets/images/textured-knitted-shirt.jpg', 
      rating:5, 
      sizes:['S','M','L'], 
      in_stock:true 
    },
    { 
      id:'demo-3', 
      name:'Tailored Trousers', 
      price:650, 
      suggested_price:1200, 
      category:'pants', 
      image_url:'assets/images/sharp-tailored-blazer.jpg', 
      rating:4, 
      sizes:['S','M','L'], 
      in_stock:true 
    },
    { 
      id:'demo-4', 
      name:'Leather Messenger Bag', 
      price:1100, 
      suggested_price:2200, 
      category:'accessories', 
      image_url:'assets/images/studio-white.jpg', 
      rating:5, 
      sizes:['One Size'], 
      in_stock:true 
    },
    { 
      id:'demo-5', 
      name:'Oversized Hoodie', 
      price:550, 
      suggested_price:1100, 
      category:'shirts', 
      image_url:'assets/images/oversized-hoodie.jpg', 
      rating:4, 
      sizes:['S','M','L','XL'], 
      in_stock:true 
    },
    { 
      id:'demo-6', 
      name:'Ribbed Knit Midi Dress', 
      price:780, 
      suggested_price:1600, 
      category:'pants', 
      image_url:'assets/images/ribbed-knit-midi-dress.jpg', 
      rating:5, 
      sizes:['XS','S','M'], 
      in_stock:true 
    },
    { 
      id:'demo-7', 
      name:'Denim Overalls', 
      price:700, 
      suggested_price:1400, 
      category:'pants', 
      image_url:'assets/images/denim-overalls.jpg', 
      rating:4, 
      sizes:['S','M','L'], 
      in_stock:true 
    },
    { 
      id:'demo-8', 
      name:'Editorial Blazer', 
      price:920, 
      suggested_price:1800, 
      category:'jackets', 
      image_url:'assets/images/editorial-blazer.jpg', 
      rating:5, 
      sizes:['S','M','L'], 
      in_stock:true 
    },
  ];
}

loadProducts();