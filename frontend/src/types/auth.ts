// ─── User Roles ──────────────────────────────────────────────────────────────

export type UserRole = "FARMER" | "VENDOR" | "ADMIN" | "DELIVERY";

export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";

// ─── User Object ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  languagePref: string;
  deviceType: string | null;
  referralCode: string;
  createdAt: string;
  lastLoginAt: string | null;
  farmerProfile?: FarmerProfile | null;
  vendorProfile?: VendorProfile | null;
}

export interface FarmerProfile {
  id: string;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  landAreaAcres?: number | null;
  primaryCrops?: string[];
}

export interface VendorProfile {
  id: string;
  businessName: string;
  gstNumber?: string | null;
  panNumber?: string | null;
  kycStatus?: string;
  commissionRate: number;
  tier?: string | null;
}

// ─── Auth Payloads ───────────────────────────────────────────────────────────

// ─── Address ────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  userId: string;
  label: string | null;
  addressLine1: string;
  addressLine2: string | null;
  village: string | null;
  city: string;
  district: string | null;
  state: string;
  pincode: string;
  geoLat: number | null;
  geoLng: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressPayload {
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  village?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface UpdateAddressPayload {
  label?: string;
  addressLine1?: string;
  addressLine2?: string;
  village?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  gstRate?: number;
  commissionAmount?: number;
  itemStatus?: string;
  returnRequested?: boolean;
  variant: {
    sku: string;
    variantName: string | null;
    product: {
      name: string;
    };
  };
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  subtotal: number;
  gstAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  paymentMethod: string;
  channel?: string | null;
  cancellationReason?: string | null;
  expectedDelivery?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
    phoneNumber: string;
  };
  items: OrderItem[];
  _count: {
    shipments: number;
    payments: number;
  };
}

export interface OrderDetail extends Omit<OrderListItem, '_count'> {
  addressId: string;
  couponCode?: string | null;
  khataAccountId?: string | null;
  address: Address;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
    transactionId?: string | null;
    createdAt: string;
  }>;
  shipments: Array<{
    id: string;
    logisticsPartner?: string | null;
    awbNumber?: string | null;
    currentStatus?: string | null;
    deliveryEta?: string | null;
    events: Array<{
      id: string;
      eventStatus: string;
      location?: string | null;
      eventTime: string;
    }>;
  }>;
  statusHistory: Array<{
    id: string;
    oldStatus?: string | null;
    newStatus: string;
    remarks?: string | null;
    changedBy?: string | null;
    changedAt: string;
  }>;
  returns: Array<{
    id: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
    reason?: string | null;
    createdAt: string;
  }>;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED"
  | "REFUNDED";

export interface OrderStatusHistoryItem {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  remarks: string | null;
  changedBy: string | null;
  changedAt: string;
}

// ─── Products & Categories ────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  nameHi: string | null;
  slug: string;
  parentId: string | null;
  iconUrl: string | null;
  sortOrder: number;
  parent?: { id: string; name: string; slug: string } | null;
  children?: Category[];
  _count?: { products: number; children: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  variantName: string | null;
  mrp: number;
  sellingPrice: number;
  stockQuantity: number;
  reorderThreshold?: number | null;
  weightGrams?: number | null;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  nameHi: string | null;
  slug: string;
  description: string | null;
  hsnCode: string | null;
  gstRate: number | null;
  unitOfMeasure: string | null;
  applicableCrops: string[];
  seasonalFlag: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  vendor: {
    id: string;
    businessName: string;
  };
  variants: ProductVariant[];
  images: { imageUrl: string }[];
  _count: { reviews: number };
}

export interface ProductDetail extends Omit<ProductListItem, 'images' | '_count'> {
  descriptionHi: string | null;
  moderationStatus: string;
  category: {
    id: string;
    name: string;
    slug: string;
    nameHi: string | null;
  };
  vendor: {
    id: string;
    businessName: string;
    kycStatus: string;
    user: { fullName: string };
  };
  images: ProductImage[];
  attributes: Array<{
    id: string;
    name: string;
    value: string;
    nameHi: string | null;
  }>;
  _count: { reviews: number; views: number };
}

// ─── Cart ───────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    sku: string;
    variantName: string | null;
    mrp: number;
    sellingPrice: number;
    stockQuantity: number;
    reservedQty: number;
    weightGrams: number | null;
    product: {
      id: string;
      name: string;
      slug: string;
      images: { imageUrl: string }[];
    };
  };
}

export interface CartWithItems {
  id: string;
  items: CartItem[];
}

export interface CreateOrderPayload {
  addressId: string;
  paymentMethod: string;
  khataAccountId?: string | null;
  couponCode?: string;
  deliveryCharge?: number;
  channel?: string;
}

// ─── KhataBook ───────────────────────────────────────────────────────────────

export interface KhataAccount {
  id: string;
  vendorId: string;
  farmerId: string;
  creditLimitAmount: number;
  interestRatePct: number;
  creditPeriodDays: number;
  outstandingAmount: number;
  status: KhataAccountStatus;
  lastTransactionAt: string | null;
  dueDateNextPayment: string | null;
  createdAt: string;
  updatedAt: string;
  vendor?: { businessName: string };
  farmer?: {
    user: { fullName: string; phoneNumber: string };
  };
}

export type KhataAccountStatus =
  | "ACTIVE"
  | "SETTLED"
  | "OVERDUE"
  | "SUSPENDED"
  | "WRITTEN_OFF";

export interface KhataTransaction {
  id: string;
  khataAccountId: string;
  type: KhataTransactionType;
  amount: number;
  balanceAfter: number;
  linkedOrderId: string | null;
  remarks: string | null;
  proofImageUrl: string | null;
  upiTransactionId: string | null;
  createdAt: string;
}

export type KhataTransactionType =
  | "UDHAR_DIYA"
  | "WAPSI_MILI"
  | "INTEREST_LAGA"
  | "WAIVER"
  | "ORDER_LINKED";

export interface KhataRequest {
  id: string;
  khataAccountId: string;
  requestedLimit: number;
  currentLimit: number;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt: string | null;
  createdAt: string;
}

// ─── Payments & Wallet ───────────────────────────────────────────────────────

export interface PaymentListItem {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  gateway: string | null;
  transactionId: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  createdAt: string;
  paidAt: string | null;
  order?: { orderNumber: string };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "ORDER_UPDATE" | "KHATA_REMINDER" | "OFFER" | "SYSTEM";
  isRead: boolean;
  deepLink: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = "ORDER_UPDATE" | "KHATA_REMINDER" | "OFFER" | "SYSTEM";

// ─── Support Tickets ─────────────────────────────────────────────────────────

export interface SupportTicket {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED";
  category: "ORDER" | "PAYMENT" | "KHATA" | "PRODUCT" | "OTHER" | null;
  referenceId: string | null;
  createdAt: string;
  updatedAt: string;
  user: { fullName: string };
  messageCount?: number;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  priority?: string;
  category?: string;
  referenceId?: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface VendorDashboardData {
  totalSales: number;
  totalOrders: number;
  topProducts: Array<{
    variantId: string;
    variantName: string;
    productName: string;
    productSlug: string;
    totalSold: number;
  }>;
  khataSummary: {
    totalOutstanding: number;
    totalCreditLimit: number;
    activeAccounts: number;
    overdueAccounts: number;
  };
  commissions: {
    totalGrossAmount: number;
    totalCommissionAmount: number;
    totalNetAmount: number;
    count: number;
  };
}

export interface AdminDashboardData {
  gmv: number;
  platformRevenue: number;
  users: { total: number; farmers: number; vendors: number };
  khata: { totalAccounts: number; overdueAccounts: number; defaultRate: string };
  orders: { total: number; delivered: number; cancelled: number; conversionRate: string };
  recentRegistrations: Array<{ id: string; fullName: string; role: string; createdAt: string }>;
}

// ─── Vendor: Inventory ───────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  sku: string;
  variantName: string | null;
  mrp: number;
  sellingPrice: number;
  stockQuantity: number;
  reservedQty: number;
  reorderThreshold: number;
  weightGrams: number | null;
  product: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface InventoryLog {
  id: string;
  variantId: string;
  quantityChange: number;
  quantityAfter: number;
  reason: "SALE" | "RESTOCK" | "RETURN" | "ADJUSTMENT" | "DAMAGED";
  referenceId: string | null;
  performedById: string | null;
  createdAt: string;
  variant?: {
    sku: string;
    variantName: string | null;
    product: { name: string };
  };
}

// ─── Vendor: Commissions & Settlements ───────────────────────────────────────

export interface CommissionItem {
  id: string;
  vendorId: string;
  orderId: string;
  commissionRate: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  createdAt: string;
  order?: { orderNumber: string; totalAmount: number };
}

export interface CommissionSummary {
  totalGrossAmount: number;
  totalCommissionAmount: number;
  totalNetAmount: number;
  count: number;
}

export interface SettlementItem {
  id: string;
  vendorId: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  commissionAmount: number;
  tdsDeducted: number;
  payableAmount: number;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  paidAt: string | null;
  utrNumber: string | null;
  createdAt: string;
}

// ─── Admin: User Management ──────────────────────────────────────────────────

export interface UserListItem {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  isPhoneVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  farmerProfile?: { id: string; village?: string | null } | null;
  vendorProfile?: { id: string; businessName: string } | null;
}

export interface CreateCategoryPayload {
  name: string;
  nameHi?: string;
  slug?: string;
  parentId?: string | null;
  iconUrl?: string;
  sortOrder?: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  nameHi?: string;
  slug?: string;
  parentId?: string | null;
  iconUrl?: string;
  sortOrder?: number;
}

// ─── Admin: Audit Logs ───────────────────────────────────────────────────────

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Admin: Coupons ───────────────────────────────────────────────────────────

export interface CouponItem {
  id: string;
  code: string;
  title: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";
  value: number;
  minimumAmount: number | null;
  maximumDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  applicableTo: "ALL" | "CATEGORY" | "VENDOR";
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponPayload {
  code: string;
  title: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_DELIVERY";
  value: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  applicableTo?: string;
  startsAt: string;
  expiresAt: string;
  isActive?: boolean;
}

export interface SalesReportItem {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  user: { fullName: string };
  items: Array<{
    variant: {
      product: { name: string; slug: string };
    };
  }>;
}

export interface ProductPerformanceItem {
  id: string;
  name: string;
  totalSold: number;
  inStock: number;
  category: { name: string };
  vendor: { businessName: string };
  variants: Array<{ sku: string; stockQuantity: number; reservedQty: number }>;
}

export interface KhataOverdueItem {
  id: string;
  outstandingAmount: number;
  creditLimitAmount: number;
  dueDateNextPayment: string | null;
  status: string;
  vendor: { businessName: string };
  farmer: { user: { fullName: string; phoneNumber: string } };
}

export interface LoginPayload {
  phoneNumber: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  role: UserRole;
  referralCode?: string;
  languagePref?: string;
}

export interface VerifyOtpPayload {
  phoneNumber: string;
  otp: string;
}

// ─── Auth Responses ──────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string | null;
    role: UserRole;
    isPhoneVerified: boolean;
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export interface RegisterResponse {
  userId: string;
  phoneNumber: string;
  role: UserRole;
}
