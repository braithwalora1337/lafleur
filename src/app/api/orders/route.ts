import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient, createPublicClient } from "@/lib/supabase/public";

const orderSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30).regex(/^[+\d\s()\-]+$/),
  fulfillment: z.enum(["delivery", "pickup"]),
  address: z.string().trim().max(240),
  deliveryAt: z.string().min(1).max(40),
  comment: z.string().trim().max(500).default(""),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(20),
}).superRefine((value, context) => {
  if (value.fulfillment === "delivery" && value.address.length < 5) context.addIssue({ code: "custom", path: ["address"], message: "Укажите адрес доставки" });
  const deliveryDate = new Date(value.deliveryAt);
  if (!Number.isFinite(deliveryDate.getTime()) || deliveryDate.getTime() < Date.now() - 60_000) context.addIssue({ code: "custom", path: ["deliveryAt"], message: "Выберите корректное время" });
});

export async function POST(request: Request) {
  try {
    const parsed = orderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Проверьте данные заказа" }, { status: 400 });
    const input = parsed.data;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const db = token ? createAuthenticatedClient(token) : createPublicClient();
    const { data: publicNumber, error } = await db.rpc("create_storefront_order", {
      p_name: input.name,
      p_phone: input.phone,
      p_fulfillment: input.fulfillment,
      p_address: input.address,
      p_delivery_at: new Date(input.deliveryAt).toISOString(),
      p_comment: input.comment,
      p_items: input.items,
    });
    if (error) {
      if (/unavailable|product/i.test(error.message)) return NextResponse.json({ error: "Один из товаров больше недоступен" }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ data: { publicNumber } }, { status: 201 });
  } catch (error) {
    console.error("order_create_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Не удалось оформить заказ. Попробуйте ещё раз." }, { status: 500 });
  }
}
