"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState<Checkout>(initialCheckout);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price_minor * item.quantity, 0), [cart]);
  const visibleProducts = activeCategory === "all" ? products : products.filter((product) => product.category_id === activeCategory);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".promise-strip,.catalog-section,.story,.delivery");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("lux-visible"); observer.unobserve(entry.target); } }), { threshold: 0.12 });
    elements.forEach((element) => { element.classList.add("lux-reveal"); observer.observe(element); });
    return () => observer.disconnect();
  }, []);

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
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    <header className="site-header"><div className="wrap nav"><a className="brand" href="#top">LA<span>FLEUR</span></a><nav className="navlinks"><a href="#catalog">Букеты</a><a href="#service">Сервис</a><a href="#delivery">Доставка</a></nav><button className="nav-order" onClick={() => setCartOpen(true)}>Корзина <span>{totalQuantity || ""}</span></button></div></header>
    <main id="top">
      <section className="wrap hero">
        <Image className="hero-photo" src="/images/lafleur-hero-luxury-v2.png" alt="Бордовые и молочные розы на льняной ткани" fill priority quality={95} sizes="100vw" />
        <div className="hero-shade" />
        <div className="hero-copy"><span className="eyebrow">Цветочная мастерская · Екатеринбург</span><h1>Цветы как<br />личное послание</h1><p>Авторские букеты, собранные как личное послание. Без лишнего — только форма, оттенок и чувство.</p><div className="hero-actions"><a className="button hero-catalog-button" href="#catalog" onClick={(event) => event.currentTarget.blur()}>Смотреть коллекцию</a></div></div>
        <div className="hero-note">Доставим сегодня<br />при заказе до 18:00</div>
      </section>
      <section className="promise-strip"><div className="wrap promise-grid"><div><span>01</span><strong>Свежие цветы</strong><small>Ежедневные поставки</small></div><div><span>02</span><strong>Фото перед доставкой</strong><small>Вы увидите готовый букет</small></div><div><span>03</span><strong>Бережная доставка</strong><small>Точно к нужному времени</small></div></div></section>
      <section className="wrap section catalog-section" id="catalog"><div className="section-heading"><div><span className="eyebrow">Коллекция LaFleur</span><h2>Найдите свой букет</h2></div><p>Каждый букет собирается флористом вручную. Возможны лёгкие изменения состава с сохранением настроения и палитры.</p></div><div className="mobile-section-guide"><span>1</span><p><strong>Выберите категорию</strong><small>Затем листайте букеты в сторону</small></p><b>→</b></div><div className="catalog-toolbar"><div className="categories"><button className={`chip ${activeCategory === "all" ? "active" : ""}`} onClick={() => setActiveCategory("all")}>Все букеты</button>{categories.map((category) => <button className={`chip ${activeCategory === category.id ? "active" : ""}`} onClick={() => setActiveCategory(category.id)} key={category.id}>{category.name}</button>)}</div><div className="catalog-arrows"><button onClick={() => scrollCatalog(-1)} aria-label="Предыдущие букеты">←</button><button onClick={() => scrollCatalog(1)} aria-label="Следующие букеты">→</button></div></div>{warning && <p className="status">{warning}</p>}<div className="grid product-grid" ref={catalogRef}>{visibleProducts.map((product, index) => <article className="card" key={product.id}><ProductGallery product={product} tone={(index % 4) + 1} /><div className="cardbody"><div><h3>{product.name}</h3><p>{product.description || "Нежная композиция от флористов LaFleur"}</p></div><div className="card-bottom"><strong className="price">{money(product.price_minor, product.currency)}</strong><button onClick={() => addToCart(product)} aria-label={`Добавить ${product.name} в корзину`}>＋</button></div></div></article>)}</div>{!warning && visibleProducts.length === 0 && <div className="catalog-empty">В этой категории скоро появятся букеты.</div>}</section>
      <section className="wrap story" id="service"><div className="story-art"><Image src="/images/lafleur-studio-roses.png" alt="Розы на столе флориста" fill sizes="(max-width: 650px) 100vw, 50vw" /></div><div className="story-copy"><span className="eyebrow">Особенный подход</span><h2>Красота — в заботе о деталях</h2><p>Подберём цветы под повод, характер и настроение. Подпишем открытку, согласуем время и пришлём фотографию букета перед отправкой.</p><blockquote>«Мы создаём не просто букеты, а маленькие воспоминания»</blockquote></div></section>
      <section className="delivery" id="delivery"><div className="wrap delivery-inner"><div><span className="eyebrow">Доставка и забота</span><h2>Ваши чувства<br />приедут вовремя</h2></div><div className="delivery-copy"><p>Доставляем по Режу и ближайшим районам. При заказе от 5 000 ₽ доставка бесплатная. Перед отправкой бережно упакуем букет и согласуем детали.</p><a className="button light" href="/delivery">Условия доставки</a></div></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-inner"><a className="brand" href="#top">LA<span>FLEUR</span></a><p>Цветочная мастерская в Екатеринбурге</p><small>© {new Date().getFullYear()} LaFleur</small></div></footer>
    <nav className="mobile-dock" aria-label="Навигация по магазину"><a href="#top"><span><DockIcon name="home" /></span><small>Главная</small></a><a href="#catalog"><span><DockIcon name="catalog" /></span><small>Каталог</small></a><a href="/delivery"><span><DockIcon name="delivery" /></span><small>Доставка</small></a><button onClick={() => setCartOpen(true)}><span className="dock-cart"><DockIcon name="cart" />{totalQuantity > 0 && <b>{totalQuantity}</b>}</span><small>Корзина</small></button></nav>

    {cartOpen && <div className="cart-layer" role="dialog" aria-modal="true" aria-label="Корзина"><button className="cart-backdrop" onClick={closeCart} aria-label="Закрыть корзину" /><aside className="cart-drawer"><div className="cart-head"><div><span className="eyebrow">LaFleur</span><h2>{orderNumber ? "Заказ оформлен" : "Ваша корзина"}</h2></div><button className="cart-close" onClick={closeCart}>×</button></div>{orderNumber ? <div className="order-success"><div className="success-mark">✓</div><h3>Спасибо за заказ №{orderNumber}</h3><p>Мы скоро позвоним по указанному номеру, чтобы подтвердить состав, стоимость доставки и время.</p><button className="button" onClick={closeCart}>Вернуться в магазин</button></div> : <>{cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}>{item.image_url ? <Image src={item.image_url} alt="" width={72} height={82} /> : <div className="cart-thumb">✤</div>}<div className="cart-item-copy"><strong>{item.name}</strong><small>{money(item.price_minor, item.currency)}</small><div className="quantity"><button onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item.id, item.quantity + 1)}>＋</button></div></div></div>)}</div><div className="cart-total"><span>Итого без доставки</span><strong>{money(subtotal)}</strong></div><form className="checkout-form" onSubmit={submitOrder}><h3>Оформление заказа</h3><label>Ваше имя<input required maxLength={80} autoComplete="name" value={checkout.name} onChange={(e) => setCheckout({ ...checkout, name: e.target.value })} placeholder="Анна" /></label><label>Телефон<input required maxLength={30} autoComplete="tel" inputMode="tel" value={checkout.phone} onChange={(e) => setCheckout({ ...checkout, phone: e.target.value })} placeholder="+7 999 000-00-00" /></label><fieldset><legend>Как получить заказ?</legend><label className="radio"><input type="radio" name="fulfillment" checked={checkout.fulfillment === "delivery"} onChange={() => setCheckout({ ...checkout, fulfillment: "delivery" })} /> Доставка</label><label className="radio"><input type="radio" name="fulfillment" checked={checkout.fulfillment === "pickup"} onChange={() => setCheckout({ ...checkout, fulfillment: "pickup", address: "" })} /> Самовывоз</label></fieldset>{checkout.fulfillment === "delivery" && <label>Адрес доставки<input required maxLength={240} value={checkout.address} onChange={(e) => setCheckout({ ...checkout, address: e.target.value })} placeholder="Улица, дом, квартира" /></label>}<label>К какому времени<input required type="datetime-local" value={checkout.deliveryAt} onChange={(e) => setCheckout({ ...checkout, deliveryAt: e.target.value })} /></label><label>Комментарий<textarea maxLength={500} rows={3} value={checkout.comment} onChange={(e) => setCheckout({ ...checkout, comment: e.target.value })} placeholder="Пожелания к заказу" /></label><div className="call-note"><span>☎</span><p><strong>После оформления мы позвоним</strong><br />Уточним детали, доставку и подтвердим итоговую стоимость.</p></div>{checkoutError && <p className="checkout-error">{checkoutError}</p>}<button className="button checkout-button" disabled={submitting}>{submitting ? "Оформляем…" : "Оформить заказ"}</button></form></> : <div className="empty-cart"><span>✤</span><h3>Корзина пока пуста</h3><p>Добавьте понравившийся букет из каталога.</p><button className="button" onClick={() => { setCartOpen(false); document.getElementById("catalog")?.scrollIntoView(); }}>Выбрать букет</button></div>}</>}</aside></div>}
  </>;
}
