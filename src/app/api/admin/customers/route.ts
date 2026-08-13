import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const promoSchema = z.object({ userId: z.string().uuid(), discountPercent: z.number().int().min(1).max(50), duration: z.enum(["day", "week", "month", "unlimited"]) });

export async function GET(request: NextRequest) {
  try {
    const { db } = await requireAdmin(request);
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const { data: orders, error: ordersError } = await db.from("orders").select("*").not("user_id", "is", null).order("created_at", { ascending: false }).limit(1000);
    if (ordersError) throw ordersError;
    return NextResponse.json({ data: { users: data.users.map((user) => ({ id: user.id, email: user.email ?? "", name: String(user.user_metadata?.name || user.email?.split("@")[0] || "Клиент"), phone: String(user.user_metadata?.phone || ""), created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null })), orders } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить клиентов";
    return NextResponse.json({ error: message }, { status: /access|initData|required/i.test(message) ? 401 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await requireAdmin(request);
    const input = promoSchema.parse(await request.json());
    const suffix = input.userId.replace(/-/g, "").slice(0, 6).toUpperCase();
    const code = `LF${input.discountPercent}-${suffix}`;
    const endsAt = input.duration === "unlimited" ? null : new Date(Date.now() + ({ day: 1, week: 7, month: 30 }[input.duration]) * 86_400_000).toISOString();
    const { data, error } = await db.from("promo_codes").upsert({ user_id: input.userId, code, discount_percent: input.discountPercent, max_uses: 1, uses_count: 0, is_active: true, starts_at: new Date().toISOString(), ends_at: endsAt }, { onConflict: "code" }).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать промокод";
    return NextResponse.json({ error: message }, { status: /access|initData|required/i.test(message) ? 401 : 400 });
  }
}
