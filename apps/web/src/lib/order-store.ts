"use client";
import { useEffect, useState, useCallback } from "react";
import type { AdminOrder, OrderStatus } from "./admin-data";
import { ADMIN_ORDERS } from "./admin-data";
import type { CartLine } from "./data";

const STORAGE_KEY = "uo:orders:v1";
const STUDENT_KEY = "uo:student:v1";

export interface StudentDetails {
  studentName: string;
  rollClass: string;
  year: string;
  parentName: string;
  mobile: string;
  email: string;
}

function readOrders(): AdminOrder[] {
  if (typeof window === "undefined") return ADMIN_ORDERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ADMIN_ORDERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminOrder[]) : ADMIN_ORDERS;
  } catch {
    return ADMIN_ORDERS;
  }
}

function writeOrders(orders: AdminOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
}

export function readStudentDetails(): StudentDetails | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudentDetails;
  } catch {
    return null;
  }
}

export function writeStudentDetails(details: StudentDetails): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STUDENT_KEY, JSON.stringify(details));
  } catch {
    // ignore
  }
}

let _nextId = 4299;
function nextOrderId(tenantId: string): string {
  const prefix = tenantId.toUpperCase();
  return `${prefix}-${String(_nextId++).padStart(5, "0")}`;
}

export function useOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>(ADMIN_ORDERS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOrders(readOrders());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeOrders(orders);
  }, [orders, hydrated]);

  const updateStatus = useCallback((id: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
  }, []);

  const placeOrder = useCallback(
    (
      tenantId: string,
      lines: CartLine[],
      student: StudentDetails,
      delivery: "pickup" | "ship",
      total: number
    ): string => {
      const id = nextOrderId(tenantId);
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const newOrder: AdminOrder = {
        id,
        tenantId: tenantId as import("./data").TenantId,
        status: "new",
        delivery,
        placedAt: `${dateStr} · ${timeStr}`,
        kid: student.studentName,
        year: student.year,
        rollClass: student.rollClass,
        parent: student.parentName,
        mobile: student.mobile,
        email: student.email,
        items: lines,
        total,
        stripeRef: `pi_demo_${Math.random().toString(36).slice(2, 8)}`,
      };
      setOrders((prev) => [newOrder, ...prev]);
      return id;
    },
    []
  );

  return { orders, hydrated, updateStatus, placeOrder };
}
