// ============================================================
// admin-messaging.js — Admin message monitoring (READ-ONLY)
// Allows admins to view buyer-seller conversations for moderation
// ============================================================

// ---- ADMIN MESSAGE MONITORING TAB ----
async function loadAdminMessaging() {
  const container = document.getElementById('adminMessagingContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-messaging-layout">
      <!-- Conversation List -->
      <div class="messaging-sidebar">
        <div class="messaging-sidebar-header">
          <h3>Buyer-Seller Messages</h3>
          <input type="text" id="messageSearchInput" placeholder="Search conversations..." 
                 style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-top:8px;">
        </div>
        <div class="messaging-user-list" id="messagingConversationList">
          <p style="padding:20px;color:#aaa;font-size:13px;">Loading conversations...</p>
        </div>
      </div>

      <!-- Message View -->
      <div class="messaging-main">
        <div class="messaging-empty-state" id="messagingEmptyState">
          <div style="text-align:center;padding:60px 20px;color:#888;">
            <div style="font-size:48px;margin-bottom:16px;">💬</div>
            <h3>Message Monitoring</h3>
            <p>Select a conversation to view buyer-seller messages</p>
            <p style="font-size:13px;color:#aaa;margin-top:8px;">Read-only view for moderation purposes</p>
          </div>
        </div>
        
        <div class="messaging-active" id="messagingActive" style="display:none;">
          <div class="messaging-header" id="messagingHeader"></div>
          <div class="messaging-messages" id="messagingMessages"></div>
          <div style="padding:16px;background:#f8f9fa;border-top:1px solid #e0e0e0;text-align:center;color:#666;font-size:13px;">
            <span style="color:#c8a96e;">ℹ️</span> Read-only view • Admins cannot send messages in buyer-seller conversations
          </div>
        </div>
      </div>
    </div>
  `;

  // Load conversations
  await loadConversations();

  // Add search functionality
  document.getElementById('messageSearchInput')?.addEventListener('input', (e) => {
    filterConversations(e.target.value);
  });
}

let allConversations = [];
let selectedMessageId = null;

async function loadConversations() {
  const convList = document.getElementById('messagingConversationList');
  if (!convList) return;

  try {
    // Get all buyer-seller messages
    const { data: messages, error } = await messagesDb
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('[admin] Loaded messages:', messages?.length || 0);

    if (!messages || messages.length === 0) {
      convList.innerHTML = '<p style="padding:20px;color:#aaa;font-size:13px;">No conversations yet</p>';
      return;
    }

    // Get seller info
    const sellerIds = [...new Set(messages.map(m => m.seller_id).filter(Boolean))];
    let sellerMap = {};
    
    if (sellerIds.length > 0) {
      const { data: sellers } = await db
        .from('sellers')
        .select('id, business_name, email')
        .in('id', sellerIds);
      
      if (sellers) {
        sellers.forEach(s => { sellerMap[s.id] = s; });
      }
    }

    // Attach seller info to messages
    allConversations = messages.map(m => ({
      ...m,
      seller_name: sellerMap[m.seller_id]?.business_name || 'Unknown Seller',
      seller_email: sellerMap[m.seller_id]?.email || ''
    }));

    renderConversationList(allConversations);

  } catch (error) {
    console.error('[admin] loadConversations error:', error);
    convList.innerHTML = '<p style="padding:20px;color:#e74c3c;">Could not load conversations</p>';
  }
}

function renderConversationList(conversations) {
  const convList = document.getElementById('messagingConversationList');
  if (!convList) return;

  if (!conversations.length) {
    convList.innerHTML = '<p style="padding:20px;color:#aaa;font-size:13px;">No conversations found</p>';
    return;
  }

  convList.innerHTML = conversations.map(msg => {
    const hasReply = !!msg.reply;
    const isUnread = hasReply && !msg.is_read;
    const lastMessage = msg.reply || msg.message;
    const time = formatMessageTime(msg.reply ? msg.replied_at : msg.created_at);
    
    return `
      <div class="messaging-user-item ${selectedMessageId === msg.id ? 'active' : ''}" 
           onclick="viewConversation('${msg.id}')" data-msg-id="${msg.id}">
        <div class="user-avatar">${msg.buyer_name.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${escapeHtml(msg.buyer_name)} → ${escapeHtml(msg.seller_name)}</div>
          <div class="user-email" style="font-size:11px;color:#888;">
            ${escapeHtml(msg.buyer_email)}
          </div>
          <div class="message-preview" style="font-size:12px;color:#666;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${lastMessage.substring(0, 50)}${lastMessage.length > 50 ? '...' : ''}
          </div>
          <div class="user-meta" style="margin-top:4px;">
            <span style="font-size:11px;color:#888;">${time}</span>
            ${hasReply ? '<span style="margin-left:8px;color:#27ae60;font-size:11px;">✓ Replied</span>' : '<span style="margin-left:8px;color:#c8a96e;font-size:11px;">⏳ Pending</span>'}
            ${isUnread ? '<span style="margin-left:8px;color:#e74c3c;font-size:11px;">● Unread</span>' : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function filterConversations(query) {
  if (!query.trim()) {
    renderConversationList(allConversations);
    return;
  }

  const filtered = allConversations.filter(conv => 
    conv.buyer_name.toLowerCase().includes(query.toLowerCase()) ||
    conv.buyer_email.toLowerCase().includes(query.toLowerCase()) ||
    conv.seller_name.toLowerCase().includes(query.toLowerCase()) ||
    conv.message.toLowerCase().includes(query.toLowerCase()) ||
    (conv.reply && conv.reply.toLowerCase().includes(query.toLowerCase()))
  );
  
  renderConversationList(filtered);
}

async function viewConversation(messageId) {
  selectedMessageId = messageId;
  
  // Update UI
  document.querySelectorAll('.messaging-user-item').forEach(item => {
    item.classList.toggle('active', item.dataset.msgId === messageId);
  });

  const conversation = allConversations.find(c => c.id === messageId);
  if (!conversation) return;

  // Show messaging area
  document.getElementById('messagingEmptyState').style.display = 'none';
  document.getElementById('messagingActive').style.display = 'flex';

  // Update header
  const header = document.getElementById('messagingHeader');
  if (header) {
    header.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #eee;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:#3498db;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">
            ${conversation.buyer_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight:700;font-size:16px;">${escapeHtml(conversation.buyer_name)} (Buyer)</div>
            <div style="font-size:13px;color:#666;">${escapeHtml(conversation.buyer_email)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#c8a96e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">
              ${conversation.seller_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600;font-size:14px;">${escapeHtml(conversation.seller_name)} (Seller)</div>
              <div style="font-size:12px;color:#666;">${escapeHtml(conversation.seller_email || '')}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // Display conversation
  const messagesContainer = document.getElementById('messagingMessages');
  if (messagesContainer) {
    const bubbles = [];

    // Buyer's message
    bubbles.push(`
      <div class="message-bubble from-user">
        <div class="message-sender" style="font-weight:600;font-size:12px;margin-bottom:4px;color:#3498db;">
          ${escapeHtml(conversation.buyer_name)} (Buyer)
        </div>
        <div class="message-content">${escapeHtml(conversation.message)}</div>
        <div class="message-meta">${formatMessageTime(conversation.created_at)}</div>
      </div>`);

    // Seller's reply (if any)
    if (conversation.reply) {
      bubbles.push(`
        <div class="message-bubble to-user">
          <div class="message-sender" style="font-weight:600;font-size:12px;margin-bottom:4px;color:#c8a96e;">
            ${escapeHtml(conversation.seller_name)} (Seller)
          </div>
          <div class="message-content">${escapeHtml(conversation.reply)}</div>
          <div class="message-meta">${formatMessageTime(conversation.replied_at)}</div>
        </div>`);
    } else {
      bubbles.push(`
        <div style="text-align:center;padding:20px;color:#888;font-size:13px;">
          <span style="color:#c8a96e;">⏳</span> Waiting for seller to reply
        </div>`);
    }

    messagesContainer.innerHTML = bubbles.join('');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Make functions globally accessible
window.loadAdminMessaging = loadAdminMessaging;
window.viewConversation = viewConversation;