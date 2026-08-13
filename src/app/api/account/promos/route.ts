import { NextResponse } from "next/server";
import { createAuthenticatedClient, createPublicClient } from "@/lib/supabase/public";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  const { data: authData, error: authError } = await createPublicClient().auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Сессия истекла" }, { status: 401 });
  const { data, error } = await createAuthenticatedClient(token).from("promo_codes").select("*").eq("user_id", authData.user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Не удалось загрузить промокоды" }, { status: 500 });
  return NextResponse.json({ data });
}
