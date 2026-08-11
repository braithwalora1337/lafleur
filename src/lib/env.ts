import "server-only";

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const serverEnv = () => ({
  // NEXT_PUBLIC variables must use static property access so Next.js can inline
  // them during the Cloudflare production build.
  supabaseUrl: required(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  ),
  supabaseSecretKey: required(
    process.env.SUPABASE_SECRET_KEY,
    "SUPABASE_SECRET_KEY",
  ),
  telegramBotToken: required(
    process.env.TELEGRAM_BOT_TOKEN,
    "TELEGRAM_BOT_TOKEN",
  ),
  initDataMaxAge: Number(
    process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? 3600,
  ),
});
