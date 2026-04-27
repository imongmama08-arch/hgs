-- ============================================================
-- REWEAR LITE - COMPLETE DATABASE SCHEMA
-- Full marketplace system with all required entities
-- ============================================================

-- ============================================================
-- 1. USERS (Local Auth - stored in localStorage)
-- Note: This table is for reference only, actual users are in localStorage
-- ============================================================
-- Users are managed in localStorage via local-auth.js
-- Fields: id, email, password, name, accountType, verified, createdAt

-- ============================================================
-- 2. SELLER_APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  business_description TEXT,
  years_in_business INTEGER,
  social_media_links JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SELLERS (Verified sellers)
-- ============================================================
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  business_description TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_level TEXT DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'premium')),
  total_sales NUMERIC(10,2) DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_reviews INTEGER DEFAULT 0,
  active_listings INTEGER DEFAULT 0,
  gcash_number TEXT,
  gcash_name TEXT,
  gcash_qr_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. LISTING_FEES (GCash payment tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS listing_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'standard', 'premium')),
  amount_paid NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'gcash' CHECK (payment_method IN ('gcash', 'cash', 'bank_transfer', 'manual')),
  payment_ref TEXT,
  proof_url TEXT,
  status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'proof_submitted', 'verified', 'rejected', 'active', 'expired')),
  rejection_reason TEXT,
  max_listings INTEGER NOT NULL,
  listings_used INTEGER DEFAULT 0,
  paid_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. PRODUCTS (Listings)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2),
  category TEXT NOT NULL CHECK (category IN ('tops_shirts', 'pants_jeans', 'jackets', 'shoes', 'accessories', 'dresses', 'skirts', 'activewear', 'lingerie', 'swimwear')),
  subcategory TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
  size TEXT NOT NULL,
  color TEXT,
  brand TEXT,
  material TEXT,
  images TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'sold', 'archived')),
  rejection_reason TEXT,
  views INTEGER DEFAULT 0,
  favorites INTEGER DEFAULT 0,
  in_stock BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  listing_fee_id UUID REFERENCES listing_fees(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1,
  size_selected TEXT,
  color_selected TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  shipping_address TEXT,
  delivery_method TEXT CHECK (delivery_method IN ('meetup', 'delivery', 'pickup')),
  meetup_location TEXT,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'gcash' CHECK (payment_method IN ('gcash', 'cash', 'bank_transfer')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'submitted', 'verified', 'rejected')),
  payment_proof_url TEXT,
  payment_reference TEXT,
  payment_rejected_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'received', 'cancelled', 'refunded')),
  transaction_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. TRANSACTIONS (Commission tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  gross_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  seller_payout NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'cancelled')),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. CHATS/MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('buyer', 'seller')),
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'offer')),
  offer_amount NUMERIC(10,2),
  offer_status TEXT CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'countered')),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'seller_application_submitted',
    'seller_application_approved',
    'seller_application_rejected',
    'listing_submitted',
    'listing_approved',
    'listing_rejected',
    'payment_submitted',
    'payment_verified',
    'payment_rejected',
    'new_order',
    'order_confirmed',
    'order_shipped',
    'order_delivered',
    'order_cancelled',
    'new_message',
    'new_offer',
    'offer_accepted',
    'offer_rejected',
    'payout_released',
    'system_alert'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. EARNINGS (Platform revenue)
-- ============================================================
CREATE TABLE IF NOT EXISTS earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('listing_fee', 'commission')),
  reference_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  reviewed_id UUID NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('buyer_to_seller', 'seller_to_buyer')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  response TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'reported')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. MARKETPLACE_ACTIVITY_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_type TEXT CHECK (user_type IN ('buyer', 'seller', 'admin', 'system')),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'user_registered',
    'seller_applied',
    'seller_approved',
    'seller_rejected',
    'listing_created',
    'listing_approved',
    'listing_rejected',
    'listing_sold',
    'order_placed',
    'order_confirmed',
    'order_shipped',
    'order_delivered',
    'order_cancelled',
    'payment_submitted',
    'payment_verified',
    'payment_rejected',
    'chat_started',
    'message_sent',
    'offer_made',
    'offer_accepted',
    'offer_rejected',
    'review_posted',
    'payout_released',
    'admin_action'
  )),
  target_id UUID,
  target_type TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. ADMIN_REVIEWS (Audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN (
    'seller_application',
    'listing',
    'payment_proof',
    'listing_fee',
    'user_report',
    'content_moderation'
  )),
  target_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'modify', 'suspend', 'remove')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. WISHLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ============================================================
-- 15. REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'listing',
    'seller',
    'buyer',
    'message',
    'review',
    'payment',
    'other'
  )),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Seller applications
CREATE INDEX idx_seller_applications_status ON seller_applications(status);
CREATE INDEX idx_seller_applications_user_id ON seller_applications(user_id);

-- Sellers
CREATE INDEX idx_sellers_verified ON sellers(verified);
CREATE INDEX idx_sellers_user_id ON sellers(user_id);

-- Listing fees
CREATE INDEX idx_listing_fees_seller_id ON listing_fees(seller_id);
CREATE INDEX idx_listing_fees_status ON listing_fees(status);

-- Products
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_in_stock ON products(in_stock) WHERE in_stock = TRUE;
CREATE INDEX idx_products_approved ON products(status) WHERE status = 'approved';

-- Orders
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- Transactions
CREATE INDEX idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Chats
CREATE INDEX idx_chats_buyer_id ON chats(buyer_id);
CREATE INDEX idx_chats_seller_id ON chats(seller_id);

-- Messages
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE read = FALSE;

-- Activity logs
CREATE INDEX idx_activity_logs_user_id ON marketplace_activity_logs(user_id);
CREATE INDEX idx_activity_logs_action_type ON marketplace_activity_logs(action_type);
CREATE INDEX idx_activity_logs_created_at ON marketplace_activity_logs(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Public policies (read-only for approved content)
CREATE POLICY "Public can view approved products" ON products FOR SELECT 
  USING (status = 'approved' AND in_stock = TRUE);

CREATE POLICY "Public can view verified sellers" ON sellers FOR SELECT 
  USING (verified = TRUE);

-- User-specific policies (users can only see their own data)
CREATE POLICY "Users can manage their own seller applications" ON seller_applications FOR ALL 
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Sellers can manage their own data" ON sellers FOR ALL 
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage their own listing fees" ON listing_fees FOR ALL 
  USING (auth.uid()::text = seller_id::text);

CREATE POLICY "Sellers can manage their own products" ON products FOR ALL 
  USING (auth.uid()::text = seller_id::text);

CREATE POLICY "Buyers can manage their own orders" ON orders FOR ALL 
  USING (auth.uid()::text = buyer_id::text);

CREATE POLICY "Users can manage their own transactions" ON transactions FOR ALL 
  USING (auth.uid()::text = seller_id::text);

CREATE POLICY "Users can manage their own chats" ON chats FOR ALL 
  USING (auth.uid()::text = buyer_id::text OR auth.uid()::text = seller_id::text);

CREATE POLICY "Users can manage their own messages" ON messages FOR ALL 
  USING (EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND 
    (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())));

CREATE POLICY "Users can manage their own notifications" ON notifications FOR ALL 
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage their own reviews" ON reviews FOR ALL 
  USING (auth.uid()::text = reviewer_id::text);

CREATE POLICY "Users can manage their own wishlists" ON wishlists FOR ALL 
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can manage their own reports" ON reports FOR ALL 
  USING (auth.uid()::text = reporter_id::text);

-- Admin policies (full access)
CREATE POLICY "Admins have full access" ON seller_applications FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON sellers FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON listing_fees FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON products FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON orders FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON transactions FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON chats FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON messages FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON notifications FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON earnings FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON reviews FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON marketplace_activity_logs FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON admin_reviews FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON wishlists FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

CREATE POLICY "Admins have full access" ON reports FOR ALL 
  USING (EXISTS (SELECT 1 FROM admin_sessions WHERE admin_sessions.id = auth.uid()));

-- ============================================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update seller stats when product is sold
CREATE OR REPLACE FUNCTION update_seller_stats_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sold' AND OLD.status != 'sold' THEN
    UPDATE sellers 
    SET 
      total_sales = total_sales + 1,
      active_listings = active_listings - 1,
      updated_at = NOW()
    WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_seller_stats AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_seller_stats_on_sale();

-- Auto-create transaction when order is confirmed
CREATE OR REPLACE FUNCTION create_transaction_on_order_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate NUMERIC(5,4);
  v_commission_amount NUMERIC(10,2);
  v_seller_payout NUMERIC(10,2);
  v_tier TEXT;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Get seller's tier from active listing fee
    SELECT tier INTO v_tier
    FROM listing_fees 
    WHERE seller_id = NEW.seller_id 
      AND status = 'active'
      AND expires_at > NOW()
    LIMIT 1;
    
    -- Default to basic if no active fee
    v_tier := COALESCE(v_tier, 'basic');
    
    -- Calculate commission (10% for basic, 8% for premium)
    v_commission_rate := CASE 
      WHEN v_tier = 'premium' THEN 0.08
      ELSE 0.10
    END;
    
    v_commission_amount := NEW.total_price * v_commission_rate;
    v_seller_payout := NEW.total_price - v_commission_amount;
    
    -- Insert transaction
    INSERT INTO transactions (
      order_id, seller_id, gross_amount, 
      commission_rate, commission_amount, seller_payout, status
    ) VALUES (
      NEW.id, NEW.seller_id, NEW.total_price,
      v_commission_rate, v_commission_amount, v_seller_payout, 'pending'
    );
    
    -- Update order with transaction_id
    UPDATE orders 
    SET transaction_id = (SELECT id FROM transactions WHERE order_id = NEW.id ORDER BY created_at DESC LIMIT 1)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_transaction_trigger AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION create_transaction_on_order_confirmation();

-- ============================================================
-- SEED DATA FOR TESTING
-- ============================================================

-- Insert sample verified seller
INSERT INTO sellers (id, user_id, business_name, email, verified, verified_at, gcash_number, gcash_name)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Fashion Finds PH',
  'seller@example.com',
  TRUE,
  NOW(),
  '09171234567',
  'Juan Dela Cruz'
) ON CONFLICT (id) DO NOTHING;

-- Insert active listing fee for sample seller
INSERT INTO listing_fees (seller_id, tier, amount_paid, status, max_listings, paid_at, expires_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'basic',
  99.00,
  'active',
  10,
  NOW(),
  NOW() + INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- Insert sample approved products
INSERT INTO products (seller_id, name, description, price, category, condition, size, brand, images, status, in_stock)
VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  'Vintage Denim Jacket',
  'Classic vintage denim jacket in excellent condition. Perfect for casual outings.',
  1299.00,
  'jackets',
  'like_new',
  'M',
  'Levis',
  ARRAY['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80'],
  'approved',
  TRUE
),
(
  '11111111-1111-1111-1111-111111111111',
  'Leather Sneakers',
  'Premium leather sneakers, barely worn. Comfortable and stylish.',
  899.00,
  'shoes',
  'good',
  '42',
  'Adidas',
  ARRAY['https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=600&q=80'],
  'approved',
  TRUE
),
(
  '11111111-1111-1111-1111-111111111111',
  'Linen Blend Shirt',
  'Lightweight linen blend shirt, perfect for summer. Neutral color goes with everything.',
  499.00,
  'tops_shirts',
  'new',
  'L',
  'Uniqlo',
  ARRAY['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80'],
  'approved',
  TRUE
) ON CONFLICT DO NOTHING;

-- Insert sample pending seller application
INSERT INTO seller_applications (user_id, business_name, email, phone, business_description, status)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'New Fashion Store',
  'newstore@example.com',
  '09178889999',
  'We sell premium preloved fashion items with quality assurance.',
  'pending'
) ON CONFLICT DO NOTHING;

-- Insert sample pending listing
INSERT INTO products (seller_id, name, description, price, category, condition, size, brand, images, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Designer Handbag',
  'Authentic designer handbag in mint condition. Comes with dust bag.',
  2999.00,
  'accessories',
  'like_new',
  'One Size',
  'Coach',
  ARRAY['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80'],
  'pending'
) ON CONFLICT DO NOTHING;

-- Insert sample pending payment proof
INSERT INTO orders (buyer_id, buyer_name, buyer_email, product_id, seller_id, quantity, unit_price, total_price, payment_status, status)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Maria Santos',
  'buyer@example.com',
  (SELECT id FROM products WHERE name = 'Vintage Denim Jacket' LIMIT 1),
  '11111111-1111-1111-1111-111111111111',
  1,
  1299.00,
  1299.00,
  'submitted',
  'pending'
) ON CONFLICT DO NOTHING;

-- Insert sample pending listing fee payment
INSERT INTO listing_fees (seller_id, tier, amount_paid, status, max_listings, payment_ref)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'standard',
  249.00,
  'proof_submitted',
  20,
  'GCASH-20250426-001'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- VIEWS FOR REPORTING
-- ============================================================

-- Dashboard summary view
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
  (SELECT COUNT(*) FROM seller_applications WHERE status = 'pending') AS pending_sellers,
  (SELECT COUNT(*) FROM products WHERE status = 'pending') AS pending_listings,
  (SELECT COUNT(*) FROM orders WHERE payment_status = 'submitted') AS pending_payments,
  (SELECT COUNT(*) FROM listing_fees WHERE status = 'proof_submitted') AS pending_fees,
  (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending_orders,
  (SELECT COUNT(*) FROM transactions WHERE status = 'pending') AS pending_payouts,
  (SELECT COUNT(*) FROM sellers WHERE verified = TRUE) AS active_sellers,
  (SELECT COUNT(*) FROM products WHERE status = 'approved' AND in_stock = TRUE) AS active_listings,
  (SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE status IN ('confirmed', 'shipped', 'delivered', 'received')) AS total_sales,
  (SELECT COALESCE(SUM(amount), 0) FROM earnings) AS platform_revenue;

-- Seller performance view
CREATE OR REPLACE VIEW seller_performance AS
SELECT 
  s.id,
  s.business_name,
  s.email,
  s.verified,
  s.total_sales,
  s.total_earnings,
  s.rating,
  s.total_reviews,
  s.active_listings,
  COUNT(DISTINCT o.id) AS total_orders,
  COALESCE(SUM(o.total_price), 0) AS lifetime_sales,
  COALESCE(AVG(r.rating), 0) AS avg_rating
FROM sellers s
LEFT JOIN orders o ON o.seller_id = s.id AND o.status IN ('confirmed', 'shipped', 'delivered', 'received')
LEFT JOIN reviews r ON r.reviewed_id = s.id AND r.review_type = 'buyer_to_seller'
GROUP BY s.id, s.business_name, s.email, s.verified, s.total_sales, s.total_earnings, s.rating, s.total_reviews, s.active_listings;

-- Product performance view
CREATE OR REPLACE VIEW product_performance AS
SELECT 
  p.id,
  p.name,
  p.category,
  p.price,
  p.condition,
  p.status,
  p.in_stock,
  p.views,
  p.favorites,
  s.business_name AS seller_name,
  COUNT(DISTINCT o.id) AS times_sold,
  COALESCE(SUM(o.total_price), 0) AS total_revenue
FROM products p
LEFT JOIN sellers s ON s.id = p.seller_id
LEFT JOIN orders o ON o.product_id = p.id AND o.status IN ('confirmed', 'shipped', 'delivered', 'received')
GROUP BY p.id, p.name, p.category, p.price, p.condition, p.status, p.in_stock, p.views, p.favorites, s.business_name;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================
SELECT '✅ REWEAR LITE database schema created successfully!' AS message;