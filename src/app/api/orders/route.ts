import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const ids = [...new Set(input.items.map((item) => item.productId))];
    const db = createAdminClient();
    const { data: products, error: productError } = await db.from("products").select("id,name,price_minor,currency,is_available,is_published").in("id", ids).eq("is_available", true).eq("is_published", true);
    if (productError) throw productError;
    if (!products || products.length !== ids.length) return NextResponse.json({ error: "Один из товаров больше недоступен" }, { status: 409 });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const items = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return { product_id: product.id, product_name: product.name, unit_price_minor: product.price_minor, quantity: item.quantity, line_total_minor: product.price_minor * item.quantity };
    });
    const subtotal = items.reduce((sum, item) => sum + item.line_total_minor, 0);
    const deliveryAt = new Date(input.deliveryAt).toISOString();
    const { data: order, error: orderError } = await db.from("orders").insert({ status: "new", payment_status: "pending", payment_provider: null, payment_external_id: null, customer_name: input.name, customer_phone: input.phone, recipient_name: input.name, recipient_phone: input.phone, delivery_address: input.fulfillment === "delivery" ? input.address : "Самовывоз", delivery_at: deliveryAt, is_anonymous: false, customer_comment: `${input.fulfillment === "delivery" ? "Доставка" : "Самовывоз"}${input.comment ? ` · ${input.comment}` : ""}`, card_text: "", currency: "RUB", subtotal_minor: subtotal, delivery_price_minor: 0, discount_minor: 0, total_minor: subtotal, promo_code: null }).select("id,public_number").single();
    if (orderError || !order) throw orderError ?? new Error("Не удалось создать заказ");
    const { error: itemError } = await db.from("order_items").insert(items.map((item) => ({ ...item, order_id: order.id })));
    if (itemError) { await db.from("orders").delete().eq("id", order.id); throw itemError; }
    return NextResponse.json({ data: { publicNumber: order.public_number } }, { status: 201 });
  } catch (error) {
    console.error("order_create_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Не удалось оформить заказ. Попробуйте ещё раз." }, { status: 500 });
  }
}
