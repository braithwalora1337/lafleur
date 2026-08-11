import { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase/admin";
export async function requireAdmin(request:NextRequest){ const raw=request.headers.get("x-telegram-init-data")??request.headers.get("authorization")?.replace(/^tma\s+/i,""); if(!raw) throw new Error("Telegram initData required"); const env=serverEnv(); const telegram=validateTelegramInitData(raw,env.telegramBotToken,env.initDataMaxAge); const db=createAdminClient(); const {data,error}=await db.from("admins").select("id,telegram_user_id,display_name,role,is_active").eq("telegram_user_id",telegram.user.id).eq("is_active",true).maybeSingle(); if(error) throw error; if(!data) throw new Error("Admin access denied"); return {admin:data,telegram:telegram.user,db}; }
