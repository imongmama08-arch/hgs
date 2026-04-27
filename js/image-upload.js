// ============================================================
// image-upload.js — Cloudinary image upload widget
// ============================================================

/**
 * Initialize image upload for a file input
 * @param {string} fileInputId - ID of the file input element
 * @param {string} urlInputId - ID of the hidden input to store the URL
 * @param {string} previewId - ID of the preview container
 * @param {string} cloudName - Cloudinary cloud name
 * @param {string} uploadPreset - Cloudinary upload preset (unsigned)
 */
function initImageUpload(fileInputId, urlInputId, previewId, cloudName, uploadPreset) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);

  if (!fileInput || !urlInput || !preview) {
    console.error('[image-upload] Missing required elements');
    return;
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please select an image file (JPG, PNG, GIF, etc.)');
      fileInput.value = '';
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;  // 10MB
    if (file.size > maxSize) {
      showError('File Too Large', 'Image must be smaller than 10MB');
      fileInput.value = '';
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <div style="position:relative;">
          <img src="${e.target.result}" style="max-width:100%;max-height:300px;border-radius:8px;">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:white;padding:12px 24px;border-radius:8px;font-size:14px;">
            Uploading...
          </div>
        </div>`;
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      showLoadingModal('Uploading Image…', 'Please wait while we upload your image.');
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      hideLoadingModal();

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      const imageUrl = data.secure_url;

      // Update hidden input with URL
      urlInput.value = imageUrl;

      // Show final preview with remove button
      preview.innerHTML = `
        <div style="position:relative;display:inline-block;">
          <img src="${imageUrl}" style="max-width:100%;max-height:300px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <button type="button" onclick="clearImageUpload('${fileInputId}', '${urlInputId}', '${previewId}')" 
                  style="position:absolute;top:8px;right:8px;background:#c0392b;color:white;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:18px;line-height:1;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
            ×
          </button>
        </div>
        <p style="margin-top:8px;font-size:13px;color:#666;">✓ Image uploaded successfully</p>`;

      showSuccess('Upload Complete', 'Your image has been uploaded successfully.');

    } catch (error) {
      hideLoadingModal();
      console.error('[image-upload] Upload failed:', error);
      showError('Upload Failed', 'Could not upload image. Please try again.');
      preview.innerHTML = '<p style="color:#c0392b;font-size:14px;">Upload failed. Please try again.</p>';
      fileInput.value = '';
    }
  });
}

/**
 * Clear uploaded image
 */
function clearImageUpload(fileInputId, urlInputId, previewId) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);

  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = '';
  if (preview) preview.innerHTML = '<p style="color:#666;font-size:14px;">No image selected</p>';
}

// Make clearImageUpload available globally for inline onclick
window.clearImageUpload = clearImageUpload;
