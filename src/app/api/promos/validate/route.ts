import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

const schema = z.object({ code: z.string().trim().min(2).max(40), subtotalMinor: z.number().int().positive() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = token ? (await createPublicClient().auth.getUser(token)).data.user : null;
    const db = createAdminClient();
    const now = new Date().toISOString();
    const { data: promo, error } = await db.from("promo_codes").select("*").eq("code", input.code.toUpperCase()).eq("is_active", true).maybeSingle();
    if (error) throw error;
    const valid = promo && (!promo.user_id || promo.user_id === user?.id) && (!promo.starts_at || promo.starts_at <= now) && (!promo.ends_at || promo.ends_at >= now) && (promo.max_uses === null || promo.uses_count < promo.max_uses);
    if (!valid) return NextResponse.json({ error: "Промокод недействителен или доступен другому пользователю" }, { status: 400 });
    const discountMinor = Math.floor(input.subtotalMinor * promo.discount_percent / 100);
    return NextResponse.json({ data: { code: promo.code, discountPercent: promo.discount_percent, discountMinor, totalMinor: input.subtotalMinor - discountMinor } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось проверить промокод";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
