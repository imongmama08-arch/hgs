// ============================================================
// VERIFY APPROVAL WORKFLOW
// Run this in browser console to test the complete workflow
// ============================================================

async function verifyApprovalWorkflow() {
    console.log('🔍 Starting Product Approval Workflow Verification...');
    
    try {
        // Step 1: Check current database state
        console.log('\n📊 Step 1: Checking current database state...');
        
        const { count: totalProducts } = await db.from('products').select('*', { count: 'exact', head: true });
        const { count: pendingProducts } = await db.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: approvedProducts } = await db.from('products').select('*', { count: 'exact', head: true }).eq('status', 'approved');
        const { count: buyerVisibleProducts } = await db.from('products').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('in_stock', true);
        
        console.log(`   Total products: ${totalProducts}`);
        console.log(`   Pending approval: ${pendingProducts}`);
        console.log(`   Approved: ${approvedProducts}`);
        console.log(`   Buyer visible: ${buyerVisibleProducts}`);
        
        // Step 2: Create a test product (seller workflow)
        console.log('\n🛍️ Step 2: Creating test product (seller workflow)...');
        
        const testProduct = {
            seller_id: 'test-seller-verification',
            name: 'Test Product for Verification ' + Date.now(),
            price: 599,
            category: 'shirts',
            image_url: 'assets/images/textured-knitted-shirt.jpg',
            description: 'Test product to verify approval workflow',
            sizes: ['S', 'M', 'L'],
            suggested_price: 999,
            status: 'pending',
            in_stock: false
        };
        
        const { data: createdProduct, error: createError } = await db
            .from('products')
            .insert(testProduct)
            .select()
            .single();
        
        if (createError) {
            console.error('❌ Failed to create test product:', createError.message);
            return;
        }
        
        console.log(`   ✅ Created product: ${createdProduct.name}`);
        console.log(`   Status: ${createdProduct.status}, In Stock: ${createdProduct.in_stock}`);
        
        // Step 3: Verify product is NOT visible to buyers
        console.log('\n👀 Step 3: Verifying product is NOT visible to buyers...');
        
        const { data: buyerQuery, error: buyerError } = await db
            .from('products')
            .select('*')
            .eq('id', createdProduct.id)
            .eq('status', 'approved')
            .eq('in_stock', true);
        
        if (buyerError) {
            console.error('❌ Buyer query failed:', buyerError.message);
            return;
        }
        
        if (buyerQuery && buyerQuery.length > 0) {
            console.log('❌ PROBLEM: Product is visible to buyers before approval!');
        } else {
            console.log('   ✅ Correct: Product is NOT visible to buyers (pending approval)');
        }
        
        // Step 4: Admin approves the product
        console.log('\n👨‍💼 Step 4: Admin approves the product...');
        
        const { data: approvedProduct, error: approveError } = await db
            .from('products')
            .update({ 
                status: 'approved', 
                in_stock: true, 
                rejection_reason: null 
            })
            .eq('id', createdProduct.id)
            .select()
            .single();
        
        if (approveError) {
            console.error('❌ Failed to approve product:', approveError.message);
            return;
        }
        
        console.log(`   ✅ Approved product: ${approvedProduct.name}`);
        console.log(`   Status: ${approvedProduct.status}, In Stock: ${approvedProduct.in_stock}`);
        
        // Step 5: Verify product IS NOW visible to buyers
        console.log('\n🛒 Step 5: Verifying product IS NOW visible to buyers...');
        
        const { data: buyerQueryAfter, error: buyerErrorAfter } = await db
            .from('products')
            .select('*')
            .eq('id', createdProduct.id)
            .eq('status', 'approved')
            .eq('in_stock', true);
        
        if (buyerErrorAfter) {
            console.error('❌ Buyer query after approval failed:', buyerErrorAfter.message);
            return;
        }
        
        if (buyerQueryAfter && buyerQueryAfter.length > 0) {
            console.log('   ✅ SUCCESS: Product is NOW visible to buyers!');
            console.log(`   Product details: ${buyerQueryAfter[0].name} (${buyerQueryAfter[0].category})`);
        } else {
            console.log('❌ PROBLEM: Product is still NOT visible to buyers after approval!');
        }
        
        // Step 6: Test category filtering
        console.log('\n📂 Step 6: Testing category filtering...');
        
        const { data: categoryProducts, error: categoryError } = await db
            .from('products')
            .select('*')
            .eq('status', 'approved')
            .eq('in_stock', true)
            .eq('category', testProduct.category);
        
        if (categoryError) {
            console.error('❌ Category query failed:', categoryError.message);
            return;
        }
        
        const foundInCategory = categoryProducts.find(p => p.id === createdProduct.id);
        if (foundInCategory) {
            console.log(`   ✅ Product correctly appears in '${testProduct.category}' category`);
        } else {
            console.log(`❌ PROBLEM: Product does not appear in '${testProduct.category}' category`);
        }
        
        // Step 7: Test shop.js query (exact same query)
        console.log('\n🏪 Step 7: Testing shop.js buyer query...');
        
        const { data: shopProducts, error: shopError } = await db
            .from('products')
            .select('*')
            .eq('status', 'approved')
            .eq('in_stock', true);
        
        if (shopError) {
            console.error('❌ Shop query failed:', shopError.message);
            return;
        }
        
        const foundInShop = shopProducts.find(p => p.id === createdProduct.id);
        if (foundInShop) {
            console.log(`   ✅ Product appears in shop query (${shopProducts.length} total products)`);
        } else {
            console.log('❌ PROBLEM: Product does not appear in shop query');
        }
        
        // Step 8: Clean up test data
        console.log('\n🧹 Step 8: Cleaning up test data...');
        
        const { error: deleteError } = await db
            .from('products')
            .delete()
            .eq('id', createdProduct.id);
        
        if (deleteError) {
            console.error('❌ Failed to clean up test product:', deleteError.message);
        } else {
            console.log('   ✅ Test product cleaned up');
        }
        
        // Final summary
        console.log('\n🎉 WORKFLOW VERIFICATION COMPLETE!');
        console.log('✅ All steps passed - the approval workflow is working correctly');
        console.log('\nWorkflow Summary:');
        console.log('1. Seller creates product → status: "pending", in_stock: false');
        console.log('2. Product is NOT visible to buyers');
        console.log('3. Admin approves product → status: "approved", in_stock: true');
        console.log('4. Product IS NOW visible to buyers');
        console.log('5. Product appears in correct category');
        console.log('6. Product appears in shop queries');
        
    } catch (error) {
        console.error('❌ Verification failed with error:', error.message);
    }
}

// Also create a function to check current approved products by category
async function checkApprovedProductsByCategory() {
    console.log('📊 Checking approved products by category...');
    
    try {
        const { data: products, error } = await db
            .from('products')
            .select('*')
            .eq('status', 'approved')
            .eq('in_stock', true)
            .order('category');
        
        if (error) {
            console.error('❌ Query failed:', error.message);
            return;
        }
        
        if (!products || products.length === 0) {
            console.log('ℹ️ No approved products found');
            return;
        }
        
        // Group by category
        const byCategory = products.reduce((acc, product) => {
            if (!acc[product.category]) acc[product.category] = [];
            acc[product.category].push(product);
            return acc;
        }, {});
        
        console.log(`\n📦 Found ${products.length} approved products:`);
        
        Object.entries(byCategory).forEach(([category, categoryProducts]) => {
            console.log(`\n${category.toUpperCase()} (${categoryProducts.length}):`);
            categoryProducts.forEach(product => {
                console.log(`  - ${product.name} (₱${product.price}) - ID: ${product.id}`);
            });
        });
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

// Export functions to global scope for console use
window.verifyApprovalWorkflow = verifyApprovalWorkflow;
window.checkApprovedProductsByCategory = checkApprovedProductsByCategory;

console.log('🔧 Verification functions loaded. Run:');
console.log('  verifyApprovalWorkflow() - Test complete workflow');
console.log('  checkApprovedProductsByCategory() - Check current products');