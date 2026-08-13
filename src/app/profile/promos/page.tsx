"use client";

import { useEffect, useState } from "react";
import type { PromoCode } from "@/lib/database.types";
import { createAuthClient } from "@/lib/supabase/auth-client";

export default function PromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const db = createAuthClient();
        const token = (await db.auth.getSession()).data.session?.access_token;
        await db.auth.dispose();
        if (!token) throw new Error("Войдите в аккаунт снова");
        const response = await fetch("/api/account/promos", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json() as { data?: PromoCode[]; error?: string };
        if (!response.ok || !result.data) throw new Error(result.error || "Не удалось загрузить промокоды");
        setPromos(result.data); setLoadedAt(Date.now());
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить промокоды"); }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  const active = promos.filter((promo) => promo.is_active && (!promo.ends_at || new Date(promo.ends_at).getTime() > loadedAt) && (promo.max_uses === null || promo.uses_count < promo.max_uses));
  return <section className="profile-section"><span className="eyebrow">Персональные предложения</span><h2>Мои промокоды</h2><p>Используйте код в корзине перед оформлением заказа.</p>{loading ? <div className="profile-empty">Загружаем предложения…</div> : error ? <div className="profile-empty">{error}</div> : active.length ? <div className="profile-promos">{active.map((promo) => <article key={promo.id}><div><span>Ваша скидка</span><strong>{promo.discount_percent}%</strong></div><code>{promo.code}</code><small>{promo.ends_at ? `Действует до ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(promo.ends_at))}` : "Без ограничения по дате"}</small><button onClick={() => void navigator.clipboard.writeText(promo.code)}>Скопировать код</button></article>)}</div> : <div className="profile-empty">Активных промокодов пока нет</div>}</section>;
}
