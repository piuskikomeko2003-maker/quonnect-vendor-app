import { Product, Customer, Sale, SaleItem } from '@/types/database.types';

export interface SampleCategoryInfo {
  id: string;
  name: string;
  iconName: string;
  description: string;
  sampleProducts: Array<{
    name: string;
    price: number;
    cost: number;
    stock: number;
    quantity_unit: string;
    category: string;
  }>;
}

export const ONBOARDING_CATEGORIES: SampleCategoryInfo[] = [
  {
    id: 'grocery',
    name: 'Grocery / Kirana',
    iconName: 'ShoppingBag',
    description: 'Packaged foods, flours, cooking oil, rice, and dry goods',
    sampleProducts: [
      { name: 'Supreme Wheat Flour (2kg)', price: 9500, cost: 7200, stock: 40, quantity_unit: 'packet', category: 'Grocery' },
      { name: 'Fortune Cooking Oil (1L)', price: 11000, cost: 8800, stock: 24, quantity_unit: 'litre', category: 'Grocery' },
      { name: 'Pearl White Rice (5kg)', price: 26000, cost: 21000, stock: 15, quantity_unit: 'bag', category: 'Grocery' },
      { name: 'Kakira White Sugar (1kg)', price: 5000, cost: 3900, stock: 50, quantity_unit: 'kg', category: 'Grocery' },
      { name: 'Cowbell Milk Powder (400g)', price: 14000, cost: 11500, stock: 20, quantity_unit: 'tin', category: 'Grocery' },
    ],
  },
  {
    id: 'fashion',
    name: 'Clothing & Fashion',
    iconName: 'Shirt',
    description: 'Apparel, shoes, accessories, fabrics, and children\'s wear',
    sampleProducts: [
      { name: 'Men Classic Cotton Shirt', price: 45000, cost: 28000, stock: 18, quantity_unit: 'piece', category: 'Fashion' },
      { name: 'Women Kitenge Maxi Dress', price: 85000, cost: 52000, stock: 10, quantity_unit: 'piece', category: 'Fashion' },
      { name: 'Denim Casual Jeans (Blue)', price: 55000, cost: 35000, stock: 25, quantity_unit: 'piece', category: 'Fashion' },
      { name: 'Leather Formal Belt', price: 20000, cost: 11000, stock: 30, quantity_unit: 'piece', category: 'Fashion' },
      { name: 'Children Sneakers (Size 28-34)', price: 38000, cost: 24000, stock: 16, quantity_unit: 'pair', category: 'Fashion' },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant & Cafe',
    iconName: 'Utensils',
    description: 'Prepared meals, snacks, coffee, takeaway food, and beverages',
    sampleProducts: [
      { name: 'Beef Luwombo Combo Special', price: 25000, cost: 14000, stock: 30, quantity_unit: 'plate', category: 'Restaurant' },
      { name: 'Chicken Pilau with Salad', price: 18000, cost: 10000, stock: 40, quantity_unit: 'plate', category: 'Restaurant' },
      { name: 'Special Rolex (2 eggs + Veg)', price: 6000, cost: 3000, stock: 80, quantity_unit: 'unit', category: 'Restaurant' },
      { name: 'Fresh Passion Fruit Juice (500ml)', price: 5000, cost: 2200, stock: 50, quantity_unit: 'bottle', category: 'Restaurant' },
      { name: 'African Spiced Milk Tea', price: 4000, cost: 1500, stock: 60, quantity_unit: 'cup', category: 'Restaurant' },
    ],
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy & Drug Shop',
    iconName: 'Pill',
    description: 'Medicines, supplements, personal hygiene, and first-aid supplies',
    sampleProducts: [
      { name: 'Paracetamol Tablets 500mg (10x10)', price: 6000, cost: 3500, stock: 50, quantity_unit: 'box', category: 'Pharmacy' },
      { name: 'Multivitamin Syrup (200ml)', price: 16000, cost: 10500, stock: 20, quantity_unit: 'bottle', category: 'Pharmacy' },
      { name: 'First Aid Antiseptic Liquid (250ml)', price: 12000, cost: 7800, stock: 25, quantity_unit: 'bottle', category: 'Pharmacy' },
      { name: 'Vitamin C Effervescent 1000mg', price: 18000, cost: 12000, stock: 30, quantity_unit: 'tube', category: 'Pharmacy' },
      { name: 'Surgical Face Masks (50 pcs)', price: 10000, cost: 5500, stock: 40, quantity_unit: 'box', category: 'Pharmacy' },
    ],
  },
  {
    id: 'electronics',
    name: 'Mobile & Electronics',
    iconName: 'Smartphone',
    description: 'Phones, chargers, cables, audio, accessories, and repairs',
    sampleProducts: [
      { name: 'Fast Charger 20W Type-C', price: 30000, cost: 16000, stock: 35, quantity_unit: 'unit', category: 'Electronics' },
      { name: 'Braided Lightning / Type-C Cable', price: 15000, cost: 7000, stock: 50, quantity_unit: 'piece', category: 'Electronics' },
      { name: 'Bluetooth Wireless Earbuds', price: 65000, cost: 38000, stock: 20, quantity_unit: 'pair', category: 'Electronics' },
      { name: 'Powerbank 10,000mAh Dual USB', price: 75000, cost: 48000, stock: 15, quantity_unit: 'unit', category: 'Electronics' },
      { name: 'Tempered Glass Screen Guard', price: 10000, cost: 3500, stock: 60, quantity_unit: 'piece', category: 'Electronics' },
    ],
  },
  {
    id: 'fresh_produce',
    name: 'Fresh Produce / Market Stall',
    iconName: 'Apple',
    description: 'Vegetables, fruits, roots, fresh greens, and market staples',
    sampleProducts: [
      { name: 'Sweet Apple Bananas (Gonja / Sukali)', price: 5000, cost: 3000, stock: 40, quantity_unit: 'bunch', category: 'Fresh Produce' },
      { name: 'Red Fresh Tomatoes (1kg basin)', price: 7000, cost: 4200, stock: 30, quantity_unit: 'basin', category: 'Fresh Produce' },
      { name: 'Fresh Green Bell Peppers (1kg)', price: 6000, cost: 3500, stock: 25, quantity_unit: 'kg', category: 'Fresh Produce' },
      { name: 'Matooke Fresh Fingers (Heap)', price: 12000, cost: 7500, stock: 20, quantity_unit: 'heap', category: 'Fresh Produce' },
      { name: 'Irish Potatoes (Nakawa 5kg bucket)', price: 20000, cost: 13500, stock: 18, quantity_unit: 'bucket', category: 'Fresh Produce' },
    ],
  },
  {
    id: 'wholesale',
    name: 'Wholesale & Distribution',
    iconName: 'Truck',
    description: 'Bulk cartons, beverage crates, supplies, and redistribution',
    sampleProducts: [
      { name: 'Mineral Water (24 x 500ml Crate)', price: 18000, cost: 13500, stock: 60, quantity_unit: 'carton', category: 'Wholesale' },
      { name: 'Laundry Bar Soap (Carton of 24)', price: 78000, cost: 62000, stock: 35, quantity_unit: 'carton', category: 'Wholesale' },
      { name: 'Energy Drink (24 cans x 300ml)', price: 48000, cost: 37000, stock: 40, quantity_unit: 'carton', category: 'Wholesale' },
      { name: 'Baking Powder Bulk Tin (1kg)', price: 22000, cost: 16000, stock: 25, quantity_unit: 'tin', category: 'Wholesale' },
      { name: 'Refined Salt (Box of 40 x 500g)', price: 42000, cost: 32000, stock: 30, quantity_unit: 'box', category: 'Wholesale' },
    ],
  },
  {
    id: 'services',
    name: 'Salon & Services',
    iconName: 'Scissors',
    description: 'Haircuts, styling, spa treatments, tailoring, and services',
    sampleProducts: [
      { name: 'Executive Haircut & Beard Trim', price: 20000, cost: 2000, stock: 999, quantity_unit: 'session', category: 'Services' },
      { name: 'Braids & Hair Styling Special', price: 60000, cost: 15000, stock: 999, quantity_unit: 'session', category: 'Services' },
      { name: 'Pedicure & Manicure Spa Set', price: 35000, cost: 8000, stock: 999, quantity_unit: 'session', category: 'Services' },
      { name: 'Hair Treatment & Steam', price: 25000, cost: 6000, stock: 999, quantity_unit: 'session', category: 'Services' },
      { name: 'Express Facial Cleansing', price: 30000, cost: 7000, stock: 999, quantity_unit: 'session', category: 'Services' },
    ],
  },
  {
    id: 'other',
    name: 'Something Else',
    iconName: 'Store',
    description: 'Any other business, retail shop, hardware, or craft stall',
    sampleProducts: [
      { name: 'Standard Product A', price: 15000, cost: 9000, stock: 25, quantity_unit: 'unit', category: 'General' },
      { name: 'Premium Product B', price: 35000, cost: 21000, stock: 15, quantity_unit: 'unit', category: 'General' },
      { name: 'Daily Essential Item C', price: 8000, cost: 4800, stock: 40, quantity_unit: 'unit', category: 'General' },
      { name: 'Value Bundle D', price: 50000, cost: 32000, stock: 10, quantity_unit: 'set', category: 'General' },
      { name: 'Quick Pickup E', price: 5000, cost: 2500, stock: 50, quantity_unit: 'piece', category: 'General' },
    ],
  },
];

export const SAMPLE_CUSTOMERS = [
  { name: 'Sarah Namagembe', phone: '+256 772 100 200', notes: 'Frequent customer from Bugolobi' },
  { name: 'David Mukasa', phone: '+256 701 345 678', notes: 'Weekly wholesale buyer' },
  { name: 'Grace Achieng', phone: '+256 788 901 234', notes: 'Walk-in cash customer' },
];
