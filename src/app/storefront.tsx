"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/auth-client";

export type StorefrontProduct = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  price_minor: number;
  currency: string;
  is_hit: boolean;
  is_new: boolean;
  image_url: string | null;
  image_alt: string;
  images: { url: string; alt: string }[];
};

type CartItem = StorefrontProduct & { quantity: number };
type Checkout = { name: string; phone: string; fulfillment: "delivery" | "pickup"; address: string; deliveryAt: string; comment: string };
const initialCheckout: Checkout = { name: "", phone: "", fulfillment: "delivery", address: "", deliveryAt: "", comment: "" };
const money = (value: number, currency = "RUB") => new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);

function DockIcon({ name }: { name: "home" | "catalog" | "delivery" | "cart" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3.5 10.5 12 3.7l8.5 6.8" /><path {...common} d="M5.5 9.3v10.2h13V9.3M9.5 19.5v-6h5v6" /></svg>;
  if (name === "catalog") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 20.5v-9.2M12 12c-3.7-.2-5.8-2.2-5.8-5.8 3.7.1 5.7 2.1 5.8 5.8ZM12 15c3.7-.2 5.8-2.2 5.8-5.8-3.7.1-5.7 2.1-5.8 5.8Z" /><path {...common} d="M7 20.5h10" /></svg>;
  if (name === "delivery") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 6.5h11v10H3zM14 10h3.6l3.4 3.6v2.9h-7z" /><circle {...common} cx="7" cy="18" r="1.7" /><circle {...common} cx="18" cy="18" r="1.7" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 8h16l-1.2 12H5.2L4 8Z" /><path {...common} d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9" /></svg>;
}

function ContactIcon({ name }: { name: "whatsapp" | "telegram" }) {
  if (name === "whatsapp") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.4-4.4a8.4 8.4 0 1 1 15.6-4.4Z" /><path d="M8.1 7.5c.2-.4.4-.4.7-.4h.4c.2 0 .4 0 .5.4l.8 2c.1.3.1.5-.1.7l-.6.8c-.2.2-.2.4 0 .7.5 1 1.3 1.8 2.2 2.4.3.2.5.2.7 0l.9-1.1c.2-.2.4-.3.7-.1l2.1 1c.3.1.4.3.4.5 0 .3-.2 1.5-1 2.1-.7.6-1.6.7-2.2.6-.5-.1-1.1-.2-1.8-.5-3.1-1.3-5.1-4.5-5.3-4.8-.2-.3-1.2-1.6-1.2-3.1 0-1.5.8-2.3 1.1-2.6Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.2 11.4 16.2-6.2c.8-.3 1.4.2 1.1 1.5l-2.8 13c-.2.9-.8 1.1-1.6.7l-4.2-3.1-2 1.9c-.2.2-.4.4-.8.4l.3-4.3 7.8-7.1c.3-.3-.1-.5-.5-.2l-9.6 6.1-4.2-1.4c-.9-.3-.9-.9.3-1.3Z" /></svg>;
}

function ProductGallery({ product, tone }: { product: StorefrontProduct; tone: number }) {
  const [activeImage, setActiveImage] = useState(0);
  const images = product.images.length ? product.images : product.image_url ? [{ url: product.image_url, alt: product.image_alt }] : [];
  const canBrowse = images.length > 1;

  function move(direction: -1 | 1) {
    if (!canBrowse) return;
    setActiveImage((current) => (current + direction + images.length) % images.length);
  }

  return <div className={`photo product-gallery flower-placeholder tone-${tone}`}>
    {images.length ? <Image key={images[activeImage].url} src={images[activeImage].url} alt={images[activeImage].alt} width={700} height={820} sizes="(max-width: 650px) 88vw, 32vw" /> : <><span className="flower-mark">✤</span><small>Фото скоро появится</small></>}
    <button className="gallery-arrow gallery-prev" type="button" disabled={!canBrowse} onClick={() => move(-1)} aria-label="Предыдущее фото">←</button>
    <button className="gallery-arrow gallery-next" type="button" disabled={!canBrowse} onClick={() => move(1)} aria-label="Следующее фото">→</button>
    {canBrowse && <div className="gallery-counter">{activeImage + 1} / {images.length}</div>}
    <div className="badges">{product.is_hit && <span>Хит</span>}{product.is_new && <span>Новинка</span>}</div>
  </div>;
}

export default function Storefront({ products, categories, warning }: { products: StorefrontProduct[]; categories: { id: string; name: string; slug: string }[]; warning: string }) {
  const catalogRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState<Checkout>(initialCheckout);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [user, setUser] = useState<User | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price_minor * item.quantity, 0), [cart]);
  const visibleProducts = activeCategory === "all" ? products : products.filter((product) => product.category_id === activeCategory);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".promise-strip,.catalog-section,.story,.delivery");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("lux-visible"); observer.unobserve(entry.target); } }), { threshold: 0.12 });
    elements.forEach((element) => { element.classList.add("lux-reveal"); observer.observe(element); });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    const db = createAuthClient();
    void db.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: authListener } = db.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => {
      authListener.subscription.unsubscribe();
      void db.auth.dispose();
    };
  }, []);

  const profileName = user
    ? String(user.user_metadata?.name || user.email?.split("@")[0] || "Профиль")
    : "";

  async function signOut() {
    const db = createAuthClient();
    await db.auth.signOut();
    setProfileMenuOpen(false);
    setUser(null);
  }

  function addToCart(product: StorefrontProduct) {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      return existing ? items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function setQuantity(id: string, quantity: number) {
    setCart((items) => quantity < 1 ? items.filter((item) => item.id !== id) : items.map((item) => item.id === id ? { ...item, quantity } : item));
  }

  function scrollCatalog(direction: -1 | 1) {
    const catalog = catalogRef.current;
    if (!catalog) return;
    const card = catalog.querySelector<HTMLElement>(".card");
    catalog.scrollBy({ left: direction * ((card?.offsetWidth ?? 340) + 18), behavior: "smooth" });
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    if (!cart.length) return;
    setSubmitting(true);
    setCheckoutError("");
    try {
      let accessToken = "";
      if (user) {
        const authDb = createAuthClient();
        accessToken = (await authDb.auth.getSession()).data.session?.access_token ?? "";
        await authDb.auth.dispose();
      }
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ ...checkout, items: cart.map(({ id, quantity }) => ({ productId: id, quantity })) }),
      });
      const result = await response.json() as { data?: { publicNumber: number }; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Не удалось оформить заказ");
      setOrderNumber(result.data.publicNumber);
      setCart([]);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Не удалось оформить заказ");
    } finally {
      setSubmitting(false);
    }
  }

  function closeCart() {
    setCartOpen(false);
    if (orderNumber) { setOrderNumber(null); setCheckout(initialCheckout); }
  }

  return <>
    <div className="contact-strip"><div className="wrap contact-strip-inner"><span>Цветочная мастерская · Реж</span><div><a className="contact-phone" href="tel:+79122978416" aria-label="Позвонить в LaFleur">+7 912 297-84-16</a><a className="contact-social whatsapp" href="https://wa.me/79122978416" target="_blank" rel="noreferrer" aria-label="Написать в WhatsApp"><ContactIcon name="whatsapp" /></a><a className="contact-social telegram" href="https://t.me/o17l701" target="_blank" rel="noreferrer" aria-label="Написать в Telegram пользователю o17l701"><ContactIcon name="telegram" /></a></div></div></div>
    <header className="site-header"><div className="wrap nav"><a className="brand" href="#top">LA<span>FLEUR</span></a><nav className="navlinks"><a href="#catalog">Букеты</a><a href="#service">Сервис</a><a href="#delivery">Доставка</a></nav><div className="nav-actions">{user ? <div className="profile-menu-wrap" ref={profileMenuRef}><button className="nav-profile" type="button" aria-expanded={profileMenuOpen} aria-haspopup="menu" onClick={() => setProfileMenuOpen((open) => !open)}><span>{profileName.slice(0, 1).toUpperCase()}</span><b>{profileName}</b><i>⌄</i></button>{profileMenuOpen && <div className="profile-menu" role="menu"><div className="profile-menu-head"><span>{profileName.slice(0, 1).toUpperCase()}</span><div><strong>{profileName}</strong><small>{user.email}</small></div></div><div className="profile-menu-links"><a href="/profile#orders" role="menuitem"><span>□</span><div><b>Мои заказы</b><small>История и статусы</small></div><i>›</i></a><a href="/profile#discount" role="menuitem"><span>％</span><div><b>Моя скидка</b><small>Уровень привилегий</small></div><i>›</i></a><a href="/profile#promos" role="menuitem"><span>◇</span><div><b>Мои промокоды</b><small>Доступные предложения</small></div><i>›</i></a></div><button className="profile-logout" role="menuitem" type="button" onClick={() => void signOut()}><span>↪</span>Выйти из аккаунта</button></div>}</div> : <a className="nav-login" href="/auth/login">Войти</a>}<button className="nav-order" onClick={() => setCartOpen(true)}>Корзина <span>{totalQuantity || ""}</span></button></div></div></header>
    <main id="top">
      <section className="wrap hero">
        <Image className="hero-photo" src="/images/lafleur-hero-luxury-v2.png" alt="Бордовые и молочные розы на льняной ткани" fill priority quality={95} sizes="100vw" />
        <div className="hero-shade" />
        <div className="hero-copy"><span className="eyebrow">Цветочная мастерская · Реж</span><h1>Цветы как<br />личное послание</h1><p>Авторские букеты, собранные как личное послание. Без лишнего — только форма, оттенок и чувство.</p><div className="hero-actions"><a className="button hero-catalog-button" href="#catalog" onClick={(event) => event.currentTarget.blur()}>Смотреть коллекцию</a></div></div>
        <div className="hero-note">Доставим сегодня<br />при заказе до 18:00</div>
      </section>
      <section className="promise-strip"><div className="wrap promise-grid"><div><span>01</span><strong>Свежие цветы</strong><small>Ежедневные поставки</small></div><div><span>02</span><strong>Фото перед доставкой</strong><small>Вы увидите готовый букет</small></div><div><span>03</span><strong>Бережная доставка</strong><small>Точно к нужному времени</small></div></div></section>
      <section className="wrap section catalog-section" id="catalog"><div className="section-heading"><div><span className="eyebrow">Коллекция LaFleur</span><h2>Найдите свой букет</h2></div><p>Каждый букет собирается флористом вручную. Возможны лёгкие изменения состава с сохранением настроения и палитры.</p></div><div className="mobile-section-guide"><span>1</span><p><strong>Выберите категорию</strong><small>Затем листайте букеты в сторону</small></p><b>→</b></div><div className="catalog-toolbar"><div className="categories"><button className={`chip ${activeCategory === "all" ? "active" : ""}`} onClick={() => setActiveCategory("all")}>Все букеты</button>{categories.map((category) => <button className={`chip ${activeCategory === category.id ? "active" : ""}`} onClick={() => setActiveCategory(category.id)} key={category.id}>{category.name}</button>)}</div><div className="catalog-arrows"><button onClick={() => scrollCatalog(-1)} aria-label="Предыдущие букеты">←</button><button onClick={() => scrollCatalog(1)} aria-label="Следующие букеты">→</button></div></div>{warning && <p className="status">{warning}</p>}<div className="grid product-grid" ref={catalogRef}>{visibleProducts.map((product, index) => <article className="card" key={product.id}><ProductGallery product={product} tone={(index % 4) + 1} /><div className="cardbody"><div><h3>{product.name}</h3><p>{product.description || "Нежная композиция от флористов LaFleur"}</p></div><div className="card-bottom"><strong className="price">{money(product.price_minor, product.currency)}</strong><button onClick={() => addToCart(product)} aria-label={`Добавить ${product.name} в корзину`}>＋</button></div></div></article>)}</div>{!warning && visibleProducts.length === 0 && <div className="catalog-empty">В этой категории скоро появятся букеты.</div>}</section>
      <section className="wrap story" id="service"><div className="story-art"><Image src="/images/lafleur-studio-roses.png" alt="Розы на столе флориста" fill sizes="(max-width: 650px) 100vw, 50vw" /></div><div className="story-copy"><span className="eyebrow">Особенный подход</span><h2>Красота — в заботе о деталях</h2><p>Подберём цветы под повод, характер и настроение. Подпишем открытку, согласуем время и пришлём фотографию букета перед отправкой.</p><blockquote>«Мы создаём не просто букеты, а маленькие воспоминания»</blockquote></div></section>
      <section className="delivery" id="delivery"><div className="wrap delivery-inner"><div><span className="eyebrow">Доставка и забота</span><h2>Ваши чувства<br />приедут вовремя</h2></div><div className="delivery-copy"><p>Доставляем по Режу и ближайшим районам. При заказе от 5 000 ₽ доставка бесплатная. Перед отправкой бережно упакуем букет и согласуем детали.</p><a className="button light" href="/delivery">Условия доставки</a></div></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-inner"><div className="footer-brand"><a className="brand" href="#top">LA<span>FLEUR</span></a><p>Цветочная мастерская в Реже</p></div><div className="footer-contacts"><a href="tel:+79122978416"><small>Позвонить</small><strong>+7 912 297-84-16</strong></a><div><a href="https://wa.me/79122978416" target="_blank" rel="noreferrer" aria-label="Написать в WhatsApp"><ContactIcon name="whatsapp" /><span>WhatsApp</span></a><a href="https://t.me/o17l701" target="_blank" rel="noreferrer" aria-label="Написать в Telegram пользователю o17l701"><ContactIcon name="telegram" /><span>Telegram</span></a></div></div><small>© {new Date().getFullYear()} LaFleur</small></div></footer>
    <nav className="mobile-dock" aria-label="Навигация по магазину"><a href="#top"><span><DockIcon name="home" /></span><small>Главная</small></a><a href="#catalog"><span><DockIcon name="catalog" /></span><small>Каталог</small></a><a href="/delivery"><span><DockIcon name="delivery" /></span><small>Доставка</small></a><button onClick={() => setCartOpen(true)}><span className="dock-cart"><DockIcon name="cart" />{totalQuantity > 0 && <b>{totalQuantity}</b>}</span><small>Корзина</small></button></nav>

    {cartOpen && <div className="cart-layer" role="dialog" aria-modal="true" aria-label="Корзина"><button className="cart-backdrop" onClick={closeCart} aria-label="Закрыть корзину" /><aside className="cart-drawer"><div className="cart-head"><div><span className="eyebrow">LaFleur</span><h2>{orderNumber ? "Заказ оформлен" : "Ваша корзина"}</h2></div><button className="cart-close" onClick={closeCart}>×</button></div>{orderNumber ? <div className="order-success"><div className="success-mark">✓</div><h3>Спасибо за заказ №{orderNumber}</h3><p>Мы скоро позвоним по указанному номеру, чтобы подтвердить состав, стоимость доставки и время.</p><button className="button" onClick={closeCart}>Вернуться в магазин</button></div> : <>{cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}>{item.image_url ? <Image src={item.image_url} alt="" width={72} height={82} /> : <div className="cart-thumb">✤</div>}<div className="cart-item-copy"><strong>{item.name}</strong><small>{money(item.price_minor, item.currency)}</small><div className="quantity"><button onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item.id, item.quantity + 1)}>＋</button></div></div></div>)}</div><div className="cart-total"><span>Итого без доставки</span><strong>{money(subtotal)}</strong></div><form className="checkout-form" onSubmit={submitOrder}><h3>Оформление заказа</h3><label>Ваше имя<input required maxLength={80} autoComplete="name" value={checkout.name} onChange={(e) => setCheckout({ ...checkout, name: e.target.value })} placeholder="Анна" /></label><label>Телефон<input required maxLength={30} autoComplete="tel" inputMode="tel" value={checkout.phone} onChange={(e) => setCheckout({ ...checkout, phone: e.target.value })} placeholder="+7 999 000-00-00" /></label><fieldset><legend>Как получить заказ?</legend><label className="radio"><input type="radio" name="fulfillment" checked={checkout.fulfillment === "delivery"} onChange={() => setCheckout({ ...checkout, fulfillment: "delivery" })} /> Доставка</label><label className="radio"><input type="radio" name="fulfillment" checked={checkout.fulfillment === "pickup"} onChange={() => setCheckout({ ...checkout, fulfillment: "pickup", address: "" })} /> Самовывоз</label></fieldset>{checkout.fulfillment === "delivery" && <label>Адрес доставки<input required maxLength={240} value={checkout.address} onChange={(e) => setCheckout({ ...checkout, address: e.target.value })} placeholder="Улица, дом, квартира" /></label>}<label>К какому времени<input required type="datetime-local" value={checkout.deliveryAt} onChange={(e) => setCheckout({ ...checkout, deliveryAt: e.target.value })} /></label><label>Комментарий<textarea maxLength={500} rows={3} value={checkout.comment} onChange={(e) => setCheckout({ ...checkout, comment: e.target.value })} placeholder="Пожелания к заказу" /></label><div className="call-note"><span>☎</span><p><strong>После оформления мы позвоним</strong><br />Уточним детали, доставку и подтвердим итоговую стоимость.</p></div>{checkoutError && <p className="checkout-error">{checkoutError}</p>}<button className="button checkout-button" disabled={submitting}>{submitting ? "Оформляем…" : "Оформить заказ"}</button></form></> : <div className="empty-cart"><span>✤</span><h3>Корзина пока пуста</h3><p>Добавьте понравившийся букет из каталога.</p><button className="button" onClick={() => { setCartOpen(false); document.getElementById("catalog")?.scrollIntoView(); }}>Выбрать букет</button></div>}</>}</aside></div>}
  </>;
}
