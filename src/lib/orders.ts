import type { OrderStatus } from "@/types/domain";

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
];

export const ALLOWED_BARISTA_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PAID: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["PREPARING", "REJECTED"],
  PREPARING: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid (Incoming)",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  "default" | "active" | "busy" | "offline" | "caramel" | "outline"
> = {
  PENDING_PAYMENT: "outline",
  PAID: "caramel",
  ACCEPTED: "busy",
  PREPARING: "busy",
  READY_FOR_PICKUP: "active",
  COMPLETED: "default",
  REJECTED: "offline",
  CANCELLED: "offline",
  REFUNDED: "offline",
};

export const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  ACCEPTED: "Accept Order",
  PREPARING: "Start Preparing",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Complete & Handover",
  REJECTED: "Reject Order",
};
