"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createAuthClient } from "@/lib/supabase/auth-client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => { void createAuthClient().auth.getSession().then(({ data, error: sessionError }) => { if (sessionError || !data.session) setError(sessionError?.message || "Не удалось подтвердить вход"); else { router.replace("/"); router.refresh(); } }); }, [router]);
  return <main className="auth-callback"><div><Link className="brand" href="/">LA<span>FLEUR</span></Link><h1>{error ? "Что-то пошло не так" : "Подтверждаем вход…"}</h1><p>{error || "Пожалуйста, подождите несколько секунд."}</p>{error && <Link className="button" href="/auth/login">Вернуться ко входу</Link>}</div></main>;
}
