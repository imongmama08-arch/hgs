// ============================================================
// confirm-modal.js — Confirmation modal for destructive actions
// ============================================================

/**
 * Show a confirmation modal before executing a destructive action
 * @param {Object} options - { title, message, confirmText, cancelText, onConfirm, isDangerous }
 */
function showConfirmModal(options) {
  const {
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm = () => {},
    isDangerous = true
  } = options;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const iconClass = isDangerous ? 'error-icon' : 'success-icon';
  const confirmBtnClass = isDangerous ? 'btn-danger' : 'btn-primary';
  
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-confetti-area">
        <div class="modal-icon-wrap ${iconClass}">
          <span>${isDangerous ? '⚠' : '?'}</span>
        </div>
      </div>
      <div class="modal-body">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-message">${message}</p>
      </div>
      <div class="modal-footer" style="display:flex;gap:12px;justify-content:center;">
        <button class="modal-btn btn-secondary" id="confirmCancelBtn">${cancelText}</button>
        <button class="modal-btn ${confirmBtnClass}" id="confirmActionBtn">${confirmText}</button>
      </div>
    </div>`;
  
  document.body.appendChild(overlay);
  
  const cancelBtn = overlay.querySelector('#confirmCancelBtn');
  const confirmBtn = overlay.querySelector('#confirmActionBtn');
  
  cancelBtn.addEventListener('click', () => {
    closeModal(overlay);
  });
  
  confirmBtn.addEventListener('click', () => {
    closeModal(overlay);
    onConfirm();
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  return overlay;
}

// Add danger button style if not already in CSS
if (!document.getElementById('confirm-modal-styles')) {
  const style = document.createElement('style');
  style.id = 'confirm-modal-styles';
  style.textContent = `
    .btn-danger {
      background: #c0392b;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-danger:hover {
      background: #a93226;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(192, 57, 43, 0.3);
    }
    .btn-secondary {
      background: #ecf0f1;
      color: #2c3e50;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-secondary:hover {
      background: #bdc3c7;
    }
  `;
  document.head.appendChild(style);
}
