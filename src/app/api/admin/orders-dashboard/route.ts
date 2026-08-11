import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { db } = await requireAdmin(request);
    const { data: orders, error: ordersError } = await db
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (ordersError) throw ordersError;

    const ids = orders.map((order) => order.id);
    const { data: items, error: itemsError } = ids.length
      ? await db.from("order_items").select("*").in("order_id", ids).order("created_at")
      : { data: [], error: null };
    if (itemsError) throw itemsError;

    return NextResponse.json({ data: { orders, items } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить заказы";
    return NextResponse.json({ error: message }, { status: /access|initData|required/i.test(message) ? 401 : 500 });
  }
}
