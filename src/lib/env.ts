import "server-only";
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing environment variable: ${name}`); return value; }
export const serverEnv = () => ({ supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"), supabaseSecretKey: required("SUPABASE_SECRET_KEY"), telegramBotToken: required("TELEGRAM_BOT_TOKEN"), initDataMaxAge: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? 3600) });
