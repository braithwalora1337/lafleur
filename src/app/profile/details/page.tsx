"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/auth-client";

function DetailIcon({ name }: { name: "name" | "phone" | "email" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "name") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="8" r="3" /><path {...common} d="M6 19c.6-3.6 2.6-5.4 6-5.4s5.4 1.8 6 5.4" /></svg>;
  if (name === "phone") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7.1 3.8 10 7.5 8.3 9.4c1.4 2.9 3.4 5 6.3 6.3l1.9-1.7 3.7 2.9c.3.2.4.6.2.9-.7 1.7-2 2.7-3.7 2.5-6.5-.7-12.3-6.5-13-13-.2-1.7.8-3 2.5-3.7.3-.2.7-.1.9.2Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="3.5" y="5.5" width="17" height="13" rx="2" /><path {...common} d="m5 7 7 5 7-5" /></svg>;
}

export default function ProfileDetailsPage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const db = createAuthClient();
    void db.auth.getUser().then(({ data }) => setUser(data.user));
    return () => { void db.auth.dispose(); };
  }, []);
  if (!user) return <section className="profile-section"><p>Загружаем данные профиля…</p></section>;

  const name = String(user.user_metadata?.name || user.email?.split("@")[0] || "Не указано");
  const phone = String(user.user_metadata?.phone || "Не указан");
  const email = user.email || "Не указана";
  return <section className="profile-section profile-details-section">
    <div className="profile-section-head"><div><span className="eyebrow">Личные данные</span><h2>Мой профиль</h2><p>Ваши контактные данные для оформления и подтверждения заказов.</p></div><span className="profile-details-mark">LF</span></div>
    <div className="profile-details-layout">
      <article className="profile-identity-card"><div className="profile-identity-avatar">{name.slice(0, 1).toUpperCase()}</div><span>Покупатель LaFleur</span><h3>{name}</h3><p>Здесь собрана основная информация вашего аккаунта.</p></article>
      <div className="profile-data-list">
        <div className="profile-data-row"><span><DetailIcon name="name" /></span><div><small>Имя</small><strong>{name}</strong></div></div>
        <div className="profile-data-row"><span><DetailIcon name="phone" /></span><div><small>Номер телефона</small><strong>{phone}</strong></div></div>
        <div className="profile-data-row"><span><DetailIcon name="email" /></span><div><small>Электронная почта</small><strong>{email}</strong></div></div>
      </div>
    </div>
  </section>;
}
