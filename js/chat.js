// ============================================================
// chat.js — Chat System for Buyers and Sellers
// ============================================================

// Feature flag: set to true after running SQL migration that creates chats table
const CHAT_ENABLED = false;

class ChatManager {
    constructor() {
        this.currentChat = null;
        this.chats = [];
        this.messages = [];
        this.unreadCount = 0;
        this.pollingInterval = null;
        if (CHAT_ENABLED) {
            this.init();
        } else {
            console.log('[chat.js] Chat feature disabled - tables not yet created');
        }
    }

    init() {
        // Check if user is authenticated
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            return;
        }

        // Load existing chats
        this.loadChats();

        // Start polling for new messages
        this.startPolling();

        // Listen for auth state changes
        document.addEventListener('authStateChanged', () => {
            if (window.authManager.isAuthenticated()) {
                this.loadChats();
                this.startPolling();
            } else {
                this.stopPolling();
                this.clearChats();
            }
        });
    }

    async loadChats() {
        try {
            const userId = window.authManager.getCurrentUser()?.id;
            if (!userId) return;

            // Load chats from Supabase
            const { data, error } = await db
                .from('chats')
                .select('*, sellers(business_name, email), products(name, price, images)')
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
                .order('last_message_at', { ascending: false });

            if (error) throw error;

            this.chats = data || [];
            this.updateUnreadCount();
            this.renderChatList();
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    async startChat(sellerId, productId = null) {
        try {
            const buyerId = window.authManager.getCurrentUser()?.id;
            if (!buyerId) {
                window.authManager.redirectToLogin('Please log in to chat with sellers');
                return;
            }

            // Check if chat already exists
            const existingChat = this.chats.find(chat => 
                chat.buyer_id === buyerId && 
                chat.seller_id === sellerId && 
                (!productId || chat.product_id === productId)
            );

            if (existingChat) {
                this.openChat(existingChat.id);
                return;
            }

            // Create new chat
            const { data, error } = await db
                .from('chats')
                .insert({
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    product_id: productId,
                    last_message: 'Chat started',
                    last_message_at: new Date().toISOString(),
                    status: 'active'
                })
                .select('*, sellers(business_name, email), products(name, price, images)')
                .single();

            if (error) throw error;

            // Add to local chats
            this.chats.unshift(data);
            this.openChat(data.id);

            // Log activity
            await db.from('marketplace_activity_logs').insert({
                user_id: buyerId,
                user_type: 'buyer',
                action_type: 'chat_started',
                target_id: sellerId,
                target_type: 'seller',
                details: {
                    product_id: productId
                }
            });

        } catch (error) {
            console.error('Error starting chat:', error);
            showError('Chat Error', 'Failed to start chat. Please try again.');
        }
    }

    async openChat(chatId) {
        try {
            // Load chat details
            const { data: chat, error: chatError } = await db
                .from('chats')
                .select('*, sellers(business_name, email), products(name, price, images)')
                .eq('id', chatId)
                .single();

            if (chatError) throw chatError;

            this.currentChat = chat;

            // Load messages
            await this.loadMessages(chatId);

            // Mark messages as read
            await this.markMessagesAsRead(chatId);

            // Show chat modal
            this.showChatModal();

        } catch (error) {
            console.error('Error opening chat:', error);
            showError('Chat Error', 'Failed to open chat.');
        }
    }

    async loadMessages(chatId) {
        try {
            const { data, error } = await db
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            this.messages = data || [];
            this.renderMessages();
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    async sendMessage(message, messageType = 'text', offerAmount = null) {
        try {
            if (!this.currentChat) return;

            const userId = window.authManager.getCurrentUser()?.id;
            const userType = window.authManager.isSeller() ? 'seller' : 'buyer';

            const messageData = {
                chat_id: this.currentChat.id,
                sender_id: userId,
                sender_type: userType,
                message: message,
                message_type: messageType,
                read: false
            };

            if (messageType === 'offer' && offerAmount) {
                messageData.offer_amount = offerAmount;
                messageData.offer_status = 'pending';
            }

            const { data, error } = await db
                .from('messages')
                .insert(messageData)
                .select()
                .single();

            if (error) throw error;

            // Add to local messages
            this.messages.push(data);

            // Update chat last message
            await db
                .from('chats')
                .update({
                    last_message: message,
                    last_message_at: new Date().toISOString(),
                    unread_count: this.currentChat.unread_count + 1
                })
                .eq('id', this.currentChat.id);

            // Render new message
            this.renderMessage(data);

            // Scroll to bottom
            this.scrollToBottom();

            // Send notification to other user
            await this.sendNotification(data);

        } catch (error) {
            console.error('Error sending message:', error);
            showError('Message Error', 'Failed to send message.');
        }
    }

    async sendNotification(message) {
        try {
            const otherUserId = window.authManager.isSeller() 
                ? this.currentChat.buyer_id 
                : this.currentChat.seller_id;

            const notificationType = 'new_message';
            const title = 'New Message';
            const notificationMessage = `You have a new message from ${window.authManager.getCurrentUser()?.name || 'a user'}`;

            await db.from('notifications').insert({
                user_id: otherUserId,
                notification_type: notificationType,
                title: title,
                message: notificationMessage,
                data: {
                    chat_id: this.currentChat.id,
                    message_id: message.id,
                    sender_name: window.authManager.getCurrentUser()?.name || 'Unknown'
                }
            });

        } catch (error) {
            console.error('Error sending notification:', error);
            // Non-fatal error
        }
    }

    async markMessagesAsRead(chatId) {
        try {
            const userId = window.authManager.getCurrentUser()?.id;
            const userType = window.authManager.isSeller() ? 'seller' : 'buyer';

            // Mark all unread messages from other user as read
            await db
                .from('messages')
                .update({
                    read: true,
                    read_at: new Date().toISOString()
                })
                .eq('chat_id', chatId)
                .eq('sender_type', userType === 'seller' ? 'buyer' : 'seller')
                .eq('read', false);

            // Reset unread count for this chat
            await db
                .from('chats')
                .update({ unread_count: 0 })
                .eq('id', chatId);

            // Update local unread count
            this.updateUnreadCount();

        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    startPolling() {
        // Poll for new messages every 10 seconds
        this.pollingInterval = setInterval(() => {
            this.checkNewMessages();
        }, 10000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async checkNewMessages() {
        try {
            const userId = window.authManager.getCurrentUser()?.id;
            if (!userId) return;

            // Check for new messages in all chats
            const { data, error } = await db
                .from('chats')
                .select('id, unread_count')
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

            if (error) throw error;

            // Update unread count
            let totalUnread = 0;
            data.forEach(chat => {
                totalUnread += chat.unread_count || 0;
            });

            this.unreadCount = totalUnread;
            this.updateUnreadBadge();

            // If current chat is open, check for new messages
            if (this.currentChat) {
                const currentChatData = data.find(chat => chat.id === this.currentChat.id);
                if (currentChatData && currentChatData.unread_count > 0) {
                    await this.loadMessages(this.currentChat.id);
                    await this.markMessagesAsRead(this.currentChat.id);
                }
            }

        } catch (error) {
            console.error('Error checking new messages:', error);
        }
    }

    updateUnreadCount() {
        this.unreadCount = this.chats.reduce((total, chat) => total + (chat.unread_count || 0), 0);
        this.updateUnreadBadge();
    }

    updateUnreadBadge() {
        const badge = document.getElementById('chatUnreadBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    clearChats() {
        this.chats = [];
        this.messages = [];
        this.currentChat = null;
        this.unreadCount = 0;
        this.updateUnreadBadge();
    }

    // UI Rendering Methods
    renderChatList() {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;

        if (this.chats.length === 0) {
            chatList.innerHTML = '<div class="empty-chats"><p>No chats yet</p><p>Start a conversation with a seller!</p></div>';
            return;
        }

        chatList.innerHTML = this.chats.map(chat => {
            const otherUser = window.authManager.isSeller() 
                ? { name: 'Buyer', email: 'buyer@example.com' } // In real app, get buyer info
                : { name: chat.sellers?.business_name || 'Seller', email: chat.sellers?.email || '' };

            const lastMessageTime = chat.last_message_at 
                ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

            const unreadBadge = chat.unread_count > 0 
                ? `<span class="chat-unread-badge">${chat.unread_count}</span>` 
                : '';

            const productInfo = chat.products 
                ? `<div class="chat-product-info">${chat.products.name} · ₱${parseFloat(chat.products.price || 0).toFixed(2)}</div>`
                : '';

            return `
                <div class="chat-list-item" data-chat-id="${chat.id}">
                    <div class="chat-avatar">${otherUser.name.charAt(0)}</div>
                    <div class="chat-info">
                        <div class="chat-header">
                            <div class="chat-name">${otherUser.name}</div>
                            <div class="chat-time">${lastMessageTime}</div>
                        </div>
                        ${productInfo}
                        <div class="chat-preview">${chat.last_message || 'Chat started'}</div>
                    </div>
                    ${unreadBadge}
                </div>
            `;
        }).join('');

        // Add click listeners
        chatList.querySelectorAll('.chat-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.openChat(chatId);
            });
        });
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = this.messages.map(msg => {
            const isOwnMessage = msg.sender_id === window.authManager.getCurrentUser()?.id;
            const messageClass = isOwnMessage ? 'message-own' : 'message-other';
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let messageContent = msg.message;
            if (msg.message_type === 'offer') {
                messageContent = `
                    <div class="offer-message">
                        <div class="offer-label">Price Offer</div>
                        <div class="offer-amount">₱${parseFloat(msg.offer_amount || 0).toFixed(2)}</div>
                        ${msg.offer_status === 'pending' ? '<div class="offer-status pending">Pending</div>' : ''}
                        ${msg.offer_status === 'accepted' ? '<div class="offer-status accepted">Accepted ✓</div>' : ''}
                        ${msg.offer_status === 'rejected' ? '<div class="offer-status rejected">Rejected ✗</div>' : ''}
                        ${msg.offer_status === 'countered' ? '<div class="offer-status countered">Countered</div>' : ''}
                    </div>
                `;
            }

            return `
                <div class="message ${messageClass}">
                    <div class="message-content">${messageContent}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }).join('');

        this.scrollToBottom();
    }

    renderMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        const isOwnMessage = message.sender_id === window.authManager.getCurrentUser()?.id;
        const messageClass = isOwnMessage ? 'message-own' : 'message-other';
        const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let messageContent = message.message;
        if (message.message_type === 'offer') {
            messageContent = `
                <div class="offer-message">
                    <div class="offer-label">Price Offer</div>
                    <div class="offer-amount">₱${parseFloat(message.offer_amount || 0).toFixed(2)}</div>
                    ${message.offer_status === 'pending' ? '<div class="offer-status pending">Pending</div>' : ''}
                    ${message.offer_status === 'accepted' ? '<div class="offer-status accepted">Accepted ✓</div>' : ''}
                    ${message.offer_status === 'rejected' ? '<div class="offer-status rejected">Rejected ✗</div>' : ''}
                    ${message.offer_status === 'countered' ? '<div class="offer-status countered">Countered</div>' : ''}
                </div>
            `;
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageClass}`;
        messageElement.innerHTML = `
            <div class="message-content">${messageContent}</div>
            <div class="message-time">${time}</div>
        `;

        messagesContainer.appendChild(messageElement);
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    showChatModal() {
        // Create or show chat modal
        let modal = document.getElementById('chatModal');
        if (!modal) {
            modal = this.createChatModal();
        }

        // Update modal content
        this.updateChatModal();

        // Show modal
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Focus on message input
        setTimeout(() => {
            const input = document.getElementById('chatMessageInput');
            if (input) input.focus();
        }, 100);
    }

    createChatModal() {
        const modal = document.createElement('div');
        modal.id = 'chatModal';
        modal.className = 'chat-modal hidden';
        modal.innerHTML = `
            <div class="chat-modal-overlay" id="chatModalOverlay"></div>
            <div class="chat-modal-content">
                <div class="chat-modal-header">
                    <div class="chat-header-info">
                        <h3 id="chatPartnerName">—</h3>
                        <p id="chatProductInfo">—</p>
                    </div>
                    <button class="chat-close-btn" id="chatCloseBtn">✕</button>
                </div>
                <div class="chat-modal-body">
                    <div class="chat-messages" id="chatMessages"></div>
                </div>
                <div class="chat-modal-footer">
                    <div class="chat-input-container">
                        <input type="text" id="chatMessageInput" placeholder="Type your message..." autocomplete="off">
                        <button class="chat-send-btn" id="chatSendBtn">Send</button>
                    </div>
                    <div class="chat-actions">
                        <button class="chat-action-btn" id="makeOfferBtn">Make Offer</button>
                        <button class="chat-action-btn" id="requestMeetupBtn">Request Meetup</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('chatModalOverlay').addEventListener('click', () => this.hideChatModal());
        document.getElementById('chatCloseBtn').addEventListener('click', () => this.hideChatModal());
        document.getElementById('chatSendBtn').addEventListener('click', () => this.handleSendMessage());
        document.getElementById('chatMessageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
        document.getElementById('makeOfferBtn').addEventListener('click', () => this.showOfferModal());
        document.getElementById('requestMeetupBtn').addEventListener('click', () => this.showMeetupModal());

        return modal;
    }

    updateChatModal() {
        if (!this.currentChat) return;

        const partnerName = window.authManager.isSeller()
            ? 'Buyer' // In real app, get buyer name
            : this.currentChat.sellers?.business_name || 'Seller';

        const productInfo = this.currentChat.products
            ? `${this.currentChat.products.name} · ₱${parseFloat(this.currentChat.products.price || 0).toFixed(2)}`
            : 'General Inquiry';

        document.getElementById('chatPartnerName').textContent = partnerName;
        document.getElementById('chatProductInfo').textContent = productInfo;

        // Render messages
        this.renderMessages();
    }

    hideChatModal() {
        const modal = document.getElementById('chatModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        this.currentChat = null;
        this.messages = [];
    }

    async handleSendMessage() {
        const input = document.getElementById('chatMessageInput');
        const message = input.value.trim();

        if (!message) return;

        await this.sendMessage(message);
        input.value = '';
        input.focus();
    }

    showOfferModal() {
        showConfirmModal({
            title: 'Make Price Offer',
            message: 'Enter your offer amount:',
            inputType: 'number',
            inputPlaceholder: 'Amount in PHP',
            confirmText: 'Send Offer',
            cancelText: 'Cancel',
            onConfirm: async (offerAmount) => {
                if (!offerAmount || isNaN(offerAmount) || offerAmount <= 0) {
                    showError('Invalid Offer', 'Please enter a valid amount.');
                    return;
                }

                const message = `I'd like to offer ₱${parseFloat(offerAmount).toFixed(2)} for this item.`;
                await this.sendMessage(message, 'offer', parseFloat(offerAmount));
            }
        });
    }

    showMeetupModal() {
        showConfirmModal({
            title: 'Request Meetup',
            message: 'Suggest a meetup location and time:',
            inputType: 'text',
            inputPlaceholder: 'e.g., SM Megamall, Saturday 2PM',
            confirmText: 'Send Request',
            cancelText: 'Cancel',
            onConfirm: async (meetupDetails) => {
                if (!meetupDetails.trim()) {
                    showError('Invalid Request', 'Please enter meetup details.');
                    return;
                }

                const message = `I'd like to meet up: ${meetupDetails}`;
                await this.sendMessage(message);
            }
        });
    }

    // Product page integration
    addChatButtonToProduct(productId, sellerId, productName) {
        // This method is called from product pages to add chat button
        const chatBtn = document.createElement('button');
        chatBtn.className = 'btn-primary chat-product-btn';
        chatBtn.innerHTML = '💬 Chat with Seller';
        chatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.startChat(sellerId, productId);
        });

        // Add to product page
        const productActions = document.querySelector('.product-actions');
        if (productActions) {
            productActions.appendChild(chatBtn);
        }
    }

    // Global chat button in navigation
    addGlobalChatButton() {
        const navActions = document.querySelector('.nav-actions');
        if (!navActions) return;

        // Check if chat button already exists
        if (document.getElementById('globalChatBtn')) return;

        const chatBtn = document.createElement('button');
        chatBtn.id = 'globalChatBtn';
        chatBtn.className = 'nav-chat-btn';
        chatBtn.innerHTML = `
            <span>💬</span>
            <span class="chat-badge" id="chatUnreadBadge" style="display: none;">0</span>
        `;
        chatBtn.title = 'Messages';
        chatBtn.addEventListener('click', () => {
            this.showChatListModal();
        });

        // Insert after auth nav
        const authNav = document.querySelector('.auth-nav, .user-nav');
        if (authNav) {
            authNav.parentNode.insertBefore(chatBtn, authNav.nextSibling);
        } else {
            navActions.appendChild(chatBtn);
        }

        // Update badge
        this.updateUnreadBadge();
    }

    showChatListModal() {
        // Create chat list modal
        let modal = document.getElementById('chatListModal');
        if (!modal) {
            modal = this.createChatListModal();
        }

        // Update chat list
        this.renderChatList();

        // Show modal
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    createChatListModal() {
        const modal = document.createElement('div');
        modal.id = 'chatListModal';
        modal.className = 'chat-modal hidden';
        modal.innerHTML = `
            <div class="chat-modal-overlay" id="chatListModalOverlay"></div>
            <div class="chat-modal-content chat-list-modal">
                <div class="chat-modal-header">
                    <h3>Your Messages</h3>
                    <button class="chat-close-btn" id="chatListCloseBtn">✕</button>
                </div>
                <div class="chat-modal-body">
                    <div class="chat-list" id="chatList"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('chatListModalOverlay').addEventListener('click', () => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        });
        document.getElementById('chatListCloseBtn').addEventListener('click', () => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        });

        return modal;
    }
}

// Global instance
window.chatManager = new ChatManager();

// Initialize chat on page load
document.addEventListener('DOMContentLoaded', () => {
    // Add global chat button if user is authenticated
    if (window.authManager && window.authManager.isAuthenticated()) {
        setTimeout(() => {
            window.chatManager.addGlobalChatButton();
        }, 1000);
    }
});

// Export functions for product pages
window.startChatWithSeller = function(sellerId, productId) {
    if (window.chatManager) {
        window.chatManager.startChat(sellerId, productId);
    }
};

window.showChatList = function() {
    if (window.chatManager) {
        window.chatManager.showChatListModal();
    }
};