import { NextResponse } from "next/server";
import { createAuthenticatedClient, createPublicClient } from "@/lib/supabase/public";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const { data: authData, error: authError } = await createPublicClient().auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Сессия истекла. Войдите снова." }, { status: 401 });

    const db = createAuthenticatedClient(token);
    const { data: orders, error } = await db.from("orders").select("*").eq("user_id", authData.user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const orderIds = orders.map((order) => order.id);
    const { data: items, error: itemError } = orderIds.length ? await db.from("order_items").select("*").in("order_id", orderIds).order("created_at") : { data: [], error: null };
    if (itemError) throw itemError;
    return NextResponse.json({ data: { orders, items } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("account_orders_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Не удалось загрузить заказы. Обновите страницу через несколько секунд." }, { status: 500 });
  }
}
