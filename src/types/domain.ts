export type VendorStatus = "OFFLINE" | "ACTIVE" | "BUSY" | "PAUSED";

export interface VendorLocation {
  vendor_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

export interface VendorWithLocation {
  id: string;
  code: string;
  name: string;
  status: VendorStatus;
  vehicle_label: string | null;
  description: string | null;
  is_active: boolean;
  location: VendorLocation | null;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  is_available: boolean;
}

export interface ProductAddon {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

export interface ProductListItem {
  id: string;
  category_id: string | null;
  category: { id: string; name: string; slug: string } | null;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  base_price: number;
  sweetness_options: string[];
  ice_options: string[];
  is_available: boolean;
  effectiveAvailable: boolean;
  variants: ProductVariant[];
  addons: ProductAddon[];
  avgRating: number | null;
  reviewCount: number;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
}

export interface ProductDetail extends ProductListItem {
  reviews: ProductReview[];
  eligibleOrderId: string | null;
}

export interface CartAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  lineId: string;
  productId: string;
  slug: string;
  productName: string;
  imageUrl: string | null;
  variantId: string | null;
  variantName: string | null;
  sweetness: string | null;
  ice: string | null;
  addons: CartAddon[];
  unitPrice: number;
  quantity: number;
}

export interface CustomerLocation {
  lat: number;
  lng: number;
  label: string;
  source: "gps" | "manual";
  accuracy?: number | null;
}

export interface CustomerPreferences {
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  defaultLatitude: number | null;
  defaultLongitude: number | null;
  searchRadiusKm: number;
  pointsBalance: number;
  lifetimePoints: number;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "ACCEPTED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

export type MovementType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "ORDER_DEDUCTION"
  | "ADJUSTMENT";

export type BaristaVendor = VendorWithLocation;

export interface BaristaOrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  sweetness: string | null;
  ice: string | null;
  addons: { name: string; price: number }[];
  line_total: number;
}

export interface BaristaOrderSummary {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  vendor_id: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  note: string | null;
  inventory_deducted: boolean;
  created_at: string;
  updated_at: string;
  items: BaristaOrderItem[];
  payment: {
    status: PaymentStatus;
    payment_type: string | null;
    gross_amount: number;
    paid_at: string | null;
  } | null;
}

export type BaristaOrderDetail = BaristaOrderSummary;

export interface BaristaProductAvailability {
  id: string;
  name: string;
  slug: string;
  category_name: string;
  base_price: number;
  image_url: string | null;
  global_available: boolean;
  vendor_available: boolean;
}

export interface BaristaInventoryItem {
  inventory_id: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  is_low: boolean;
  updated_at: string;
}

export interface InventoryMovementItem {
  id: string;
  ingredient_name: string;
  unit: string;
  type: MovementType;
  quantity: number;
  note: string | null;
  created_at: string;
}

export interface VendorStatusHistoryItem {
  id: string;
  status: VendorStatus;
  created_at: string;
}

export interface BaristaRevenueSummary {
  todayCompletedRevenue: number;
  todayOrderCount: number;
  totalCompletedRevenue: number;
  completedCount: number;
  avgOrderValue: number;
  transactions: BaristaOrderSummary[];
}
