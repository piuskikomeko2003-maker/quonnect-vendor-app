import { supabase } from '@/lib/supabaseClient';
import { ONBOARDING_CATEGORIES, SAMPLE_CUSTOMERS } from '@/lib/sampleData';
import { ProductInsert, CustomerInsert, SaleInsert, SaleItemInsert } from '@/types/database.types';

/**
 * Seeds sample products, customers, and sales for a newly onboarded shop.
 * All rows are stamped with `is_sample = true` so they can be identified,
 * tagged with SAMPLE badges in the UI, and purged with one tap without touching real data.
 */
export async function seedSampleDataForVendor(
  vendorId: string,
  categoryId: string,
  isDemo: boolean = false
) {
  const categoryInfo =
    ONBOARDING_CATEGORIES.find((c) => c.id === categoryId) || ONBOARDING_CATEGORIES[0];

  if (isDemo || vendorId.startsWith('demo-')) {
    // Store in demo localStorage for instant offline demo experience
    if (typeof window !== 'undefined') {
      const demoProducts = categoryInfo.sampleProducts.map((p, idx) => ({
        id: `sample-prod-${idx + 1}`,
        vendor_id: vendorId,
        name: p.name,
        description: `Sample product for ${categoryInfo.name}`,
        price: p.price,
        cost: p.cost,
        photo_url: null,
        stock: p.stock,
        is_service: false,
        min_stock_alert: 3,
        sku: `SMP-${idx + 1}`,
        barcode: null,
        expiry_date: null,
        category: p.category,
        quantity_unit: p.quantity_unit,
        is_sample: true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }));

      const demoCustomers = SAMPLE_CUSTOMERS.map((c, idx) => ({
        id: `sample-cust-${idx + 1}`,
        vendor_id: vendorId,
        name: c.name,
        phone: c.phone,
        email: null,
        address: 'Kampala',
        notes: c.notes,
        total_orders: 1,
        total_spent: 35000,
        due_amount: 0,
        is_sample: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }));

      localStorage.setItem('quonnect_demo_products', JSON.stringify(demoProducts));
      localStorage.setItem('quonnect_demo_customers', JSON.stringify(demoCustomers));
    }
    return { success: true };
  }

  try {
    // 1. Insert sample products
    const productsToInsert: ProductInsert[] = categoryInfo.sampleProducts.map((p, idx) => ({
      vendor_id: vendorId,
      name: p.name,
      description: `Sample product for ${categoryInfo.name}`,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      quantity_unit: p.quantity_unit,
      category: p.category,
      is_sample: true,
      is_active: true,
      sku: `SMP-${idx + 1}`,
      min_stock_alert: 3,
    }));

    const { data: insertedProducts, error: prodErr } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select('id, name, price, cost');

    if (prodErr) {
      console.warn('Error inserting sample products:', prodErr);
    }

    // 2. Insert sample customers
    const customersToInsert: CustomerInsert[] = SAMPLE_CUSTOMERS.map((c) => ({
      vendor_id: vendorId,
      name: c.name,
      phone: c.phone,
      address: 'Kampala',
      notes: c.notes,
      is_sample: true,
    }));

    const { data: insertedCustomers, error: custErr } = await supabase
      .from('customers')
      .insert(customersToInsert)
      .select('id, name');

    if (custErr) {
      console.warn('Error inserting sample customers:', custErr);
    }

    // 3. Insert 2 sample sales if products were inserted
    if (insertedProducts && insertedProducts.length > 0) {
      const p1 = insertedProducts[0];
      const p2 = insertedProducts[1] || insertedProducts[0];
      const cust = insertedCustomers?.[0];

      const saleTotal = p1.price * 2 + p2.price;
      const saleCost = (p1.cost || 0) * 2 + (p2.cost || 0);
      const saleProfit = saleTotal - saleCost;

      const { data: insertedSale } = await supabase
        .from('sales')
        .insert({
          vendor_id: vendorId,
          order_no: `ORD-${Date.now().toString().slice(-4)}`,
          customer_id: cust?.id || null,
          customer_name: cust?.name || 'Walk-in Customer',
          subtotal: saleTotal,
          total: saleTotal,
          paid_amount: saleTotal,
          due_amount: 0,
          profit: saleProfit,
          status: 'completed',
          payment_method: 'Cash',
          sale_date: new Date().toISOString().split('T')[0],
          is_sample: true,
        })
        .select('id')
        .maybeSingle();

      if (insertedSale) {
        await supabase.from('sale_items').insert([
          {
            sale_id: insertedSale.id,
            vendor_id: vendorId,
            product_id: p1.id,
            product_name: p1.name,
            quantity: 2,
            unit_price: p1.price,
            unit_cost: p1.cost || 0,
            total: p1.price * 2,
            profit: (p1.price - (p1.cost || 0)) * 2,
          },
          {
            sale_id: insertedSale.id,
            vendor_id: vendorId,
            product_id: p2.id,
            product_name: p2.name,
            quantity: 1,
            unit_price: p2.price,
            unit_cost: p2.cost || 0,
            total: p2.price,
            profit: p2.price - (p2.cost || 0),
          },
        ]);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to seed sample data:', err);
    return { success: false, error: err };
  }
}

/**
 * Purges strictly `is_sample = true` rows for the vendor across all business tables.
 * Guaranteed never to delete real vendor data.
 */
export async function clearSampleDataForVendor(vendorId: string, isDemo: boolean = false) {
  if (isDemo || vendorId.startsWith('demo-')) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quonnect_demo_products');
      localStorage.removeItem('quonnect_demo_customers');
      localStorage.removeItem('quonnect_demo_sales');
      localStorage.setItem('quonnect_sample_cleared', 'true');
    }
    return { success: true };
  }

  try {
    // Delete sample sales & sale items
    await supabase.from('sales').delete().eq('vendor_id', vendorId).eq('is_sample', true);
    // Delete sample products
    await supabase.from('products').delete().eq('vendor_id', vendorId).eq('is_sample', true);
    // Delete sample customers
    await supabase.from('customers').delete().eq('vendor_id', vendorId).eq('is_sample', true);
    // Delete sample finance entries
    await supabase.from('finance_entries').delete().eq('vendor_id', vendorId).eq('is_sample', true);

    return { success: true };
  } catch (err) {
    console.error('Error clearing sample data:', err);
    return { success: false, error: err };
  }
}
