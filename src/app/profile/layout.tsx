"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/auth-client";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const db = createAuthClient();
    void db.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/auth/login");
      else setUser(data.user);
    });
    return () => { void db.auth.dispose(); };
  }, [router]);

  if (!user) return <main className="profile-loading">Загружаем личный кабинет…</main>;
  const name = String(user.user_metadata?.name || user.email?.split("@")[0] || "Профиль");

  return <main className="profile-page">
    <header className="profile-header"><Link className="brand" href="/">LA<span>FLEUR</span></Link><Link href="/">← Вернуться в магазин</Link></header>
    <section className="profile-hero"><div className="profile-avatar">{name.slice(0, 1).toUpperCase()}</div><div><span className="eyebrow">Личный кабинет</span><h1>{name}</h1><p>{user.email}</p></div></section>
    <nav className="profile-tabs"><Link className={pathname.endsWith("/orders") ? "active" : ""} href="/profile/orders">Мои заказы</Link><Link className={pathname.endsWith("/discount") ? "active" : ""} href="/profile/discount">Моя скидка</Link><Link className={pathname.endsWith("/promos") ? "active" : ""} href="/profile/promos">Мои промокоды</Link></nav>
    {children}
  </main>;
}
