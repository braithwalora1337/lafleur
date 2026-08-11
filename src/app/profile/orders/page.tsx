"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Order, OrderItem, OrderStatus } from "@/lib/database.types";
import { createAuthClient } from "@/lib/supabase/auth-client";

const statusLabels: Record<OrderStatus, string> = { new: "Новый", accepted: "Принят", in_progress: "В работе", assembled: "Собран", ready_for_pickup: "Готов к самовывозу", ready_for_delivery: "Готов к доставке", delivering: "В доставке", completed: "Завершён", cancelled: "Отменён" };
const statusSteps: OrderStatus[] = ["new", "accepted", "in_progress", "assembled", "ready_for_delivery", "delivering", "completed"];
const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value / 100);

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const db = createAuthClient();
    const token = (await db.auth.getSession()).data.session?.access_token;
    await db.auth.dispose();
    if (!token) return;
    const response = await fetch("/api/account/orders", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    const raw = await response.text();
    let result: { data?: { orders: Order[]; items: OrderItem[] }; error?: string } = {};
    if (raw) {
      try { result = JSON.parse(raw) as typeof result; }
      catch { throw new Error("Сервис заказов временно недоступен. Обновите страницу."); }
    }
    if (!response.ok || !result.data) throw new Error(result.error || "Не удалось загрузить заказы");
    setOrders(result.data.orders); setItems(result.data.items); setError(""); setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh().catch((reason) => { setError(reason instanceof Error ? reason.message : "Ошибка загрузки"); setLoading(false); }));
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return <section className="profile-section"><div className="profile-section-head"><div><span className="eyebrow">История покупок</span><h2>Мои заказы</h2></div><button onClick={() => void refresh()}>Обновить</button></div>{loading ? <div className="profile-empty">Загружаем заказы…</div> : error ? <div className="profile-empty">{error}</div> : orders.length === 0 ? <div className="profile-empty">Заказов пока нет<br /><Link href="/#catalog">Выбрать первый букет →</Link></div> : <div className="customer-orders">{orders.map((order) => { const orderItems = items.filter((item) => item.order_id === order.id); const pickup = order.delivery_address.toLowerCase() === "самовывоз"; const flow = pickup ? statusSteps.map((status) => status === "ready_for_delivery" ? "ready_for_pickup" as OrderStatus : status).filter((status) => status !== "delivering") : statusSteps; const current = flow.indexOf(order.status); return <article className={`customer-order status-${order.status}`} key={order.id}><header><div><small>{new Date(order.created_at).toLocaleDateString("ru-RU")}</small><h3>Заказ №{order.public_number}</h3></div><strong>{statusLabels[order.status]}</strong></header><div className="customer-order-progress">{flow.map((status, index) => <div className={index <= current ? "done" : ""} key={status}><i /><small>{statusLabels[status]}</small></div>)}</div><div className="customer-order-body"><div>{orderItems.map((item) => <p key={item.id}><span>{item.quantity} × {item.product_name}</span><b>{money(item.line_total_minor)}</b></p>)}</div><aside><small>{pickup ? "Самовывоз" : "Доставка"}</small><p>{order.delivery_address}</p><strong>{money(order.total_minor)}</strong></aside></div></article>; })}</div>}</section>;
}
