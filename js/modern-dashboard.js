// ============================================================
// modern-dashboard.js — Modern dashboard interactions
// ============================================================

// Tab Switching
document.querySelectorAll('.nav-item, [data-tab]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = link.dataset.tab;
    if (!tab) return;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`[data-tab="${tab}"]`).forEach(l => l.classList.add('active'));

    // Update content
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');

    // Update header
    const titles = {
      overview: { title: 'Overview', subtitle: 'Welcome back! Here\'s your store overview' },
      listings: { title: 'My Listings', subtitle: 'Manage your product listings' },
      orders: { title: 'Orders', subtitle: 'Track and manage your orders' },
      add: { title: 'Add New Listing', subtitle: 'Create a new product listing' },
      earnings: { title: 'Earnings', subtitle: 'View your earnings and payouts' },
      profile: { title: 'Profile & Payment', subtitle: 'Manage your business information' },
      verify: { title: 'How to Verify', subtitle: 'Complete verification to start selling' }
    };

    const titleData = titles[tab] || { title: 'Dashboard', subtitle: '' };
    document.getElementById('pageTitle').textContent = titleData.title;
    document.getElementById('pageSubtitle').textContent = titleData.subtitle;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// Quick Add Button
document.getElementById('quickAddBtn')?.addEventListener('click', () => {
  document.querySelector('[data-tab="add"]')?.click();
});

// Add Product Form Handler
document.getElementById('addProductForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2"/></svg>Publishing...';
    
    // Get form data
    const formData = getProductFormData();
    formData.status = 'published';
    
    // Validate required fields
    if (!formData.name || !formData.price || !formData.category || !formData.condition) {
      throw new Error('Please fill in all required fields');
    }
    
    // Save to database (implement your save logic here)
    await saveProduct(formData);
    
    // Show success message
    showSuccess('Product Published', 'Your product has been published successfully.');
    
    // Reset form
    e.target.reset();
    document.getElementById('imagePreviewGrid').innerHTML = '';
    
    // Switch to listings tab
    document.querySelector('[data-tab="listings"]')?.click();
    
  } catch (error) {
    console.error('Publish product error:', error);
    showError('Publish Failed', error.message || 'Could not publish product. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

// Save Draft Button Handler
document.getElementById('saveDraftBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('saveDraftBtn');
  const originalText = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2"/></svg>Saving...';
    
    // Get form data
    const formData = getProductFormData();
    formData.status = 'draft';
    
    // Save to database (implement your save logic here)
    await saveProductDraft(formData);
    
    // Show success message
    showSuccess('Draft Saved', 'Your product has been saved as draft.');
    
  } catch (error) {
    console.error('Save draft error:', error);
    showError('Save Failed', 'Could not save draft. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// Profile Form Save Handler
document.getElementById('sellerProfileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2"/></svg>Saving...';
    
    // Get profile data
    const profileData = getProfileFormData();
    
    // Save to database (implement your save logic here)
    await saveSellerProfile(profileData);
    
    // Show success message
    showSuccess('Profile Saved', 'Your profile has been updated successfully.');
    
  } catch (error) {
    console.error('Save profile error:', error);
    showError('Save Failed', 'Could not save profile. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

// Helper Functions
function getProductFormData() {
  // Get selected sizes
  const selectedSizes = Array.from(document.querySelectorAll('.size-selector input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  
  return {
    name: document.getElementById('newName')?.value || '',
    description: document.getElementById('newDescription')?.value || '',
    price: parseFloat(document.getElementById('newPrice')?.value) || 0,
    category: document.getElementById('newCategory')?.value || '',
    condition: document.getElementById('newCondition')?.value || '',
    brand: document.getElementById('newBrand')?.value || '',
    sizes: selectedSizes,
    originalPrice: parseFloat(document.getElementById('newSuggestedPrice')?.value) || 0,
    shippingFee: parseFloat(document.getElementById('newShippingFee')?.value) || 0,
    images: [] // Add image handling logic
  };
}

function getProfileFormData() {
  return {
    fullName: document.getElementById('bizFullName')?.value || '',
    phone: document.getElementById('bizPhone')?.value || '', // This is also the GCash number
    storeName: document.getElementById('bizStoreName')?.value || '',
    email: document.getElementById('bizEmail')?.value || '',
    location: document.getElementById('bizLocation')?.value || '',
    description: document.getElementById('bizDesc')?.value || '',
    gcashName: document.getElementById('bizGcashName')?.value || ''
  };
}

async function saveProduct(data) {
  // Implement your database save logic here
  console.log('Saving product:', data);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // For now, save to localStorage for demo purposes
  const products = JSON.parse(localStorage.getItem('seller_products') || '[]');
  const newProduct = {
    id: Date.now().toString(),
    ...data,
    created_at: new Date().toISOString(),
    seller_id: localStorage.getItem('currentUserId') || 'demo-seller'
  };
  products.push(newProduct);
  localStorage.setItem('seller_products', JSON.stringify(products));
}

async function saveProductDraft(data) {
  // Implement your database save logic here
  console.log('Saving product draft:', data);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // For now, save to localStorage for demo purposes
  const drafts = JSON.parse(localStorage.getItem('seller_drafts') || '[]');
  const newDraft = {
    id: Date.now().toString(),
    ...data,
    created_at: new Date().toISOString(),
    seller_id: localStorage.getItem('currentUserId') || 'demo-seller'
  };
  drafts.push(newDraft);
  localStorage.setItem('seller_drafts', JSON.stringify(drafts));
}

async function saveSellerProfile(data) {
  // Implement your database save logic here
  console.log('Saving seller profile:', data);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
}

function showSuccess(title, message) {
  // Implement your success notification
  alert(`${title}: ${message}`);
}

function showError(title, message) {
  // Implement your error notification
  alert(`${title}: ${message}`);
}

// ========================================
// Verification Guide Functionality
// ========================================

// Document Upload Handler
document.addEventListener('DOMContentLoaded', () => {
  // Verification Method Switching
  const methodTabs = document.querySelectorAll('.method-tab');
  const verificationMethods = document.querySelectorAll('.verification-method');

  console.log('[Dashboard] Found method tabs:', methodTabs.length);
  console.log('[Dashboard] Found verification methods:', verificationMethods.length);

  methodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const method = tab.dataset.method;
      console.log('[Dashboard] Switching to method:', method);
      
      // Update active tab
      methodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding method
      verificationMethods.forEach(m => {
        m.classList.remove('active');
        if (m.id === `${method}Method`) {
          m.classList.add('active');
          console.log('[Dashboard] Activated method:', m.id);
        }
      });
    });
  });

  // ID Upload functionality
  const idUploadBox = document.getElementById('idUploadBox');
  const idUpload = document.getElementById('idUpload');
  const idPreview = document.getElementById('idPreview');

  // Selfie Upload functionality
  const selfieUploadBox = document.getElementById('selfieUploadBox');
  const selfieUpload = document.getElementById('selfieUpload');
  const selfiePreview = document.getElementById('selfiePreview');

  // Setup ID upload
  if (idUploadBox && idUpload) {
    setupFileUpload(idUploadBox, idUpload, idPreview, 'ID', true); // Allow multiple for front/back
  }

  // Setup Selfie upload
  if (selfieUploadBox && selfieUpload) {
    setupFileUpload(selfieUploadBox, selfieUpload, selfiePreview, 'Selfie', false); // Single file only
  }

  function setupFileUpload(uploadBox, fileInput, previewContainer, type, allowMultiple) {
    // Click to upload
    uploadBox.addEventListener('click', () => {
      fileInput.click();
    });

    // Drag and drop
    uploadBox.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadBox.style.borderColor = '#c8a96e';
      uploadBox.style.background = 'rgba(212,168,67,0.15)';
    });

    uploadBox.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadBox.style.borderColor = '#d4a843';
      uploadBox.style.background = 'rgba(212,168,67,0.05)';
    });

    uploadBox.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadBox.style.borderColor = '#d4a843';
      uploadBox.style.background = 'rgba(212,168,67,0.05)';
      
      const files = allowMultiple ? e.dataTransfer.files : [e.dataTransfer.files[0]];
      handleFileUpload(files, previewContainer, type, allowMultiple);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const files = allowMultiple ? e.target.files : [e.target.files[0]];
      handleFileUpload(files, previewContainer, type, allowMultiple);
    });
  }

  function handleFileUpload(files, previewContainer, type, allowMultiple) {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => {
      if (!file) return false;
      
      const isImage = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      
      if (!isImage) {
        showError('Invalid File', 'Please upload image files only.');
        return false;
      }
      
      if (!isValidSize) {
        showError('File Too Large', 'Please upload files smaller than 5MB.');
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    // Clear previous preview if single file upload
    if (!allowMultiple) {
      previewContainer.innerHTML = '';
    }

    // Show preview
    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.createElement('div');
        preview.className = 'upload-preview-item';
        preview.innerHTML = `
          <img src="${e.target.result}" alt="${type} Preview ${index + 1}" style="max-width: 200px; max-height: 150px; border-radius: 8px;">
          <div class="preview-info" style="margin-top: 8px;">
            <span class="preview-name" style="font-size: 14px; color: #666;">${file.name}</span>
            <button class="preview-remove" onclick="removePreview(this)" style="margin-left: 8px; padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Remove</button>
          </div>
        `;
        previewContainer.appendChild(preview);
        
        // Store file data for face verification
        preview.dataset.fileData = e.target.result;
        preview.dataset.fileType = type;
      };
      reader.readAsDataURL(file);
    });

    // Trigger face verification if both ID and selfie are uploaded
    if (type === 'Selfie') {
      setTimeout(() => {
        triggerFaceVerification();
      }, 1000); // Wait for image to load
    }

    // Update step status
    updateVerificationProgress();
  }

  // Face Verification Integration
  async function triggerFaceVerification() {
    const idImages = document.querySelectorAll('#idPreview .upload-preview-item');
    const selfieImages = document.querySelectorAll('#selfiePreview .upload-preview-item');
    
    if (idImages.length === 0 || selfieImages.length === 0) {
      return; // Need both ID and selfie
    }

    const resultsContainer = document.getElementById('faceVerificationResults');
    const verificationBadge = document.getElementById('verificationBadge');
    const confidenceScore = document.getElementById('confidenceScore');
    const verificationRecommendation = document.getElementById('verificationRecommendation');
    const verificationAnalysis = document.getElementById('verificationAnalysis');
    const analysisContent = document.getElementById('analysisContent');

    if (!resultsContainer) return;

    // Show verification UI
    resultsContainer.style.display = 'block';
    verificationBadge.textContent = 'Analyzing...';
    verificationBadge.className = 'verification-badge analyzing';

    try {
      // Get image data
      const idImageData = idImages[0].dataset.fileData;
      const selfieImageData = selfieImages[0].dataset.fileData;

      console.log('[Dashboard] Starting face verification...');

      // Wait for face verification system to be ready
      if (!window.faceVerification || !window.faceVerification.isLoaded) {
        console.log('[Dashboard] Waiting for face verification system...');
        await window.faceVerification.initialize();
      }

      // Perform face verification
      const result = await window.faceVerification.verifyFaceMatch(idImageData, selfieImageData);
      
      console.log('[Dashboard] Face verification result:', result);

      // Update UI with results
      if (result.success && result.isMatch !== undefined) {
        const confidence = result.confidence || 0;
        const recommendation = result.recommendation || { status: 'review', message: 'Manual review needed' };

        // Update badge
        verificationBadge.textContent = result.isMatch ? 'Match Found' : 'No Match';
        verificationBadge.className = `verification-badge ${recommendation.status}`;

        // Update confidence score
        confidenceScore.textContent = `${confidence}%`;
        confidenceScore.style.color = recommendation.color || '#666';

        // Update recommendation
        verificationRecommendation.innerHTML = `
          <span class="recommendation-text" style="color: ${recommendation.color}">${recommendation.message}</span>
        `;

        // Update analysis details
        if (result.analysis) {
          const analysis = result.analysis;
          analysisContent.innerHTML = `
            <div class="analysis-row">
              <strong>ID Analysis:</strong> Age ~${analysis.id.age}, ${analysis.id.gender} (${analysis.id.genderProbability}%)
            </div>
            <div class="analysis-row">
              <strong>Selfie Analysis:</strong> Age ~${analysis.selfie.age}, ${analysis.selfie.gender} (${analysis.selfie.genderProbability}%)
            </div>
            <div class="analysis-row">
              <strong>Age Match:</strong> ${analysis.ageMatch ? '✅ Compatible' : '⚠️ Different'}
            </div>
            <div class="analysis-row">
              <strong>Gender Match:</strong> ${analysis.genderMatch ? '✅ Match' : '⚠️ Different'}
            </div>
            <div class="analysis-row">
              <strong>Technical Score:</strong> ${confidence}% confidence (threshold: ${result.threshold}%)
            </div>
          `;
          verificationAnalysis.style.display = 'block';
        }

        // Store verification result for admin review
        window.verificationResult = result;

      } else {
        // Handle verification error
        verificationBadge.textContent = 'Error';
        verificationBadge.className = 'verification-badge error';
        
        verificationRecommendation.innerHTML = `
          <span class="recommendation-text" style="color: #ef4444">${result.error || 'Verification failed'}</span>
        `;
        
        confidenceScore.textContent = '0%';
        confidenceScore.style.color = '#ef4444';
      }

    } catch (error) {
      console.error('[Dashboard] Face verification error:', error);
      
      verificationBadge.textContent = 'Error';
      verificationBadge.className = 'verification-badge error';
      
      verificationRecommendation.innerHTML = `
        <span class="recommendation-text" style="color: #ef4444">Verification system error</span>
      `;
      
      confidenceScore.textContent = '0%';
      confidenceScore.style.color = '#ef4444';
    }
  }

  // Add real-time form monitoring for profile completion
  const profileFields = ['bizFullName', 'bizPhone', 'bizStoreName', 'bizEmail', 'bizLocation', 'bizGcashName'];
  profileFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => {
        // Phone number validation
        if (fieldId === 'bizPhone') {
          let value = field.value.replace(/\D/g, ''); // Remove non-digits
          if (value.length > 11) {
            value = value.substring(0, 11); // Limit to 11 digits
          }
          field.value = value;
        }
        setTimeout(updateVerificationProgress, 100); // Small delay to ensure value is updated
      });
    }
  });

  // Add phone number formatting and validation
  const phoneField = document.getElementById('bizPhone');
  if (phoneField) {
    phoneField.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
      if (value.length > 11) {
        value = value.substring(0, 11); // Limit to 11 digits
      }
      e.target.value = value;
      
      // Visual feedback for valid Philippine numbers
      if (value.length === 11 && value.startsWith('09')) {
        e.target.style.borderColor = '#10b981';
        e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)';
      } else if (value.length > 0) {
        e.target.style.borderColor = '#f59e0b';
        e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.1)';
      } else {
        e.target.style.borderColor = '';
        e.target.style.boxShadow = '';
      }
    });
  }

  // Initialize verification status
  updateVerificationProgress();
});

function removePreview(button) {
  button.closest('.upload-preview-item').remove();
  updateVerificationProgress();
}

function updateVerificationProgress() {
  // Check profile completion
  const profileComplete = checkProfileCompletion();
  const qrUploaded = qrUploader && qrUploader.getQRImage();
  
  // Check document uploads
  const idUploaded = document.querySelectorAll('#idPreview .upload-preview-item').length > 0;
  const selfieUploaded = document.querySelectorAll('#selfiePreview .upload-preview-item').length > 0;
  
  // Step 1: Profile + QR code
  updateStepStatus(1, profileComplete && qrUploaded);
  
  // Step 2: ID is required, selfie is optional but recommended
  updateStepStatus(2, idUploaded);
  
  // Step 3: Ready for review when profile and ID are complete
  updateStepStatus(3, profileComplete && qrUploaded && idUploaded);
  
  // Step 4: Only admin can approve
  updateStepStatus(4, false);
  
  // Update overall verification badge
  const verificationBadge = document.getElementById('verificationBadge');
  const verificationStatus = document.getElementById('verificationStatus');
  
  if (verificationBadge) {
    const statusDot = verificationBadge.querySelector('.status-dot');
    const statusText = verificationBadge.querySelector('.status-text');
    
    if (profileComplete && qrUploaded && idUploaded) {
      statusDot.className = 'status-dot review';
      statusText.textContent = 'Under Review';
    } else if (profileComplete || idUploaded) {
      statusDot.className = 'status-dot progress';
      statusText.textContent = 'In Progress';
    } else {
      statusDot.className = 'status-dot pending';
      statusText.textContent = 'Pending Verification';
    }
  }
  
  // Update sidebar verification status
  if (verificationStatus) {
    const statusBadge = verificationStatus.querySelector('.status-badge');
    const statusText = verificationStatus.querySelector('.status-text');
    
    if (profileComplete && qrUploaded && idUploaded) {
      statusBadge.className = 'status-badge review';
      statusBadge.textContent = 'UNDER REVIEW';
      statusText.textContent = 'Documents submitted for review';
    } else {
      statusBadge.className = 'status-badge pending';
      statusBadge.textContent = 'PENDING VERIFICATION';
      statusText.textContent = 'Complete verification to start selling';
    }
  }
  
  // Show recommendation for selfie if ID is uploaded but selfie is not
  const selfieSection = document.getElementById('selfieUploadBox');
  if (selfieSection && idUploaded && !selfieUploaded) {
    selfieSection.style.borderColor = '#f59e0b';
    selfieSection.style.background = 'rgba(245,158,11,0.1)';
    const recommendation = selfieSection.querySelector('.upload-recommendation');
    if (!recommendation) {
      const recDiv = document.createElement('div');
      recDiv.className = 'upload-recommendation';
      recDiv.style.cssText = 'margin-top: 8px; padding: 8px 12px; background: rgba(245,158,11,0.1); border-radius: 6px; font-size: 13px; color: #92400e;';
      recDiv.innerHTML = '💡 <strong>Recommended:</strong> Upload a selfie with your ID for faster verification';
      selfieSection.appendChild(recDiv);
    }
  }
}

function checkProfileCompletion() {
  const fullName = document.getElementById('bizFullName')?.value || '';
  const phone = document.getElementById('bizPhone')?.value || '';
  const email = document.getElementById('bizEmail')?.value || '';
  const location = document.getElementById('bizLocation')?.value || '';
  const gcashName = document.getElementById('bizGcashName')?.value || '';
  
  // Check if phone number is valid (11 digits starting with 09)
  const isPhoneValid = phone.length === 11 && phone.startsWith('09');
  
  // Store name is optional, so not required for completion
  return fullName && isPhoneValid && email && location && gcashName;
}

function updateStepStatus(stepNumber, completed) {
  const statusEl = document.getElementById(`step${stepNumber}Status`);
  if (!statusEl) return;
  
  const iconEl = statusEl.querySelector('.status-icon');
  const stepEl = statusEl.closest('.verification-step');
  
  if (completed) {
    iconEl.textContent = '✅';
    stepEl.classList.add('completed');
    stepEl.classList.remove('pending', 'locked');
  } else {
    // Different icons based on step and prerequisites
    if (stepNumber === 1 || stepNumber === 2) {
      iconEl.textContent = '⏳';
      stepEl.classList.add('pending');
      stepEl.classList.remove('completed', 'locked');
    } else if (stepNumber === 3) {
      // Step 3 depends on steps 1 and 2
      const step1Complete = document.getElementById('step1Status')?.closest('.verification-step').classList.contains('completed');
      const step2Complete = document.getElementById('step2Status')?.closest('.verification-step').classList.contains('completed');
      
      if (step1Complete && step2Complete) {
        iconEl.textContent = '⏳';
        stepEl.classList.add('pending');
        stepEl.classList.remove('completed', 'locked');
      } else {
        iconEl.textContent = '🔒';
        stepEl.classList.add('locked');
        stepEl.classList.remove('completed', 'pending');
      }
    } else {
      iconEl.textContent = '🔒';
      stepEl.classList.add('locked');
      stepEl.classList.remove('completed', 'pending');
    }
  }
}

// GCash QR Code Upload
class QRCodeUploader {
  constructor() {
    this.qrImage = null;
    this.init();
  }

  init() {
    const dropzone = document.getElementById('qrDropzone');
    const input = document.getElementById('qrInput');
    const preview = document.getElementById('qrPreview');
    const removeBtn = document.getElementById('qrRemove');

    if (!dropzone || !input) return;

    // Click to upload
    dropzone.addEventListener('click', () => input.click());

    // File input change
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    // Remove button
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeQR();
      });
    }
  }

  handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    // Read and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.qrImage = {
        file: file,
        url: e.target.result
      };
      this.showPreview();
    };
    reader.readAsDataURL(file);
  }

  showPreview() {
    const dropzone = document.getElementById('qrDropzone');
    const preview = document.getElementById('qrPreview');
    const img = document.getElementById('qrImage');

    if (dropzone && preview && img) {
      dropzone.style.display = 'none';
      preview.style.display = 'block';
      img.src = this.qrImage.url;
    }
  }

  removeQR() {
    const dropzone = document.getElementById('qrDropzone');
    const preview = document.getElementById('qrPreview');
    const input = document.getElementById('qrInput');

    if (dropzone && preview) {
      dropzone.style.display = 'block';
      preview.style.display = 'none';
    }

    if (input) input.value = '';
    this.qrImage = null;
  }

  getQRImage() {
    return this.qrImage;
  }
}

// Initialize QR uploader
let qrUploader;
document.addEventListener('DOMContentLoaded', () => {
  qrUploader = new QRCodeUploader();
});

// Character counter for description
const descTextarea = document.getElementById('newDescription');
const charCount = document.getElementById('descCharCount');
if (descTextarea && charCount) {
  descTextarea.addEventListener('input', () => {
    const count = descTextarea.value.length;
    charCount.textContent = count;
    if (count > 500) {
      charCount.style.color = '#EF4444';
    } else {
      charCount.style.color = '';
    }
  });
}

// Export for use in other scripts
window.qrUploader = qrUploader;

// Test function to manually show live camera method
window.testLiveCamera = function() {
  console.log('[Test] Manually showing live camera method...');
  
  // Find elements
  const liveTab = document.getElementById('liveMethodTab');
  const uploadTab = document.getElementById('uploadMethodTab');
  const liveMethod = document.getElementById('liveMethod');
  const uploadMethod = document.getElementById('uploadMethod');
  
  console.log('[Test] Live tab found:', !!liveTab);
  console.log('[Test] Upload tab found:', !!uploadTab);
  console.log('[Test] Live method found:', !!liveMethod);
  console.log('[Test] Upload method found:', !!uploadMethod);
  
  if (liveTab && uploadTab && liveMethod && uploadMethod) {
    // Switch tabs
    uploadTab.classList.remove('active');
    liveTab.classList.add('active');
    
    // Switch methods
    uploadMethod.classList.remove('active');
    liveMethod.classList.add('active');
    
    console.log('[Test] Switched to live camera method');
    
    // Check if button is visible
    const startButton = document.querySelector('.btn-start-camera');
    console.log('[Test] Start camera button found:', !!startButton);
    console.log('[Test] Start camera button visible:', startButton ? window.getComputedStyle(startButton).display !== 'none' : false);
  } else {
    console.error('[Test] Some elements not found!');
  }
};

// Auto-test when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    console.log('[Dashboard] Running auto-test...');
    window.testLiveCamera();
  }, 2000);
});