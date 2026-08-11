"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

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
};

type CartItem = StorefrontProduct & { quantity: number };
type Checkout = { name: string; phone: string; fulfillment: "delivery" | "pickup"; address: string; deliveryAt: string; comment: string };
const initialCheckout: Checkout = { name: "", phone: "", fulfillment: "delivery", address: "", deliveryAt: "", comment: "" };
const money = (value: number, currency = "RUB") => new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);

export default function Storefront({ products, categories, warning }: { products: StorefrontProduct[]; categories: { id: string; name: string; slug: string }[]; warning: string }) {
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
        <Image className="hero-photo" src="/images/lafleur-hero-roses.png" alt="Белые и красные розы на светлой ткани" fill priority sizes="(max-width: 1200px) 100vw, 1180px" />
        <div className="hero-shade" />
        <div className="hero-copy"><span className="eyebrow">Цветочная мастерская · Екатеринбург</span><h1>Букеты с&nbsp;нежным характером</h1><p>Собираем свежие цветы в выразительные композиции, чтобы ваши чувства звучали без лишних слов.</p><div className="hero-actions"><a className="button" href="#catalog">Выбрать букет</a><a className="text-link" href="#service">Как мы работаем <span>↘</span></a></div></div>
        <div className="hero-note">Доставим сегодня<br />при заказе до 18:00</div>
      </section>
      <section className="promise-strip"><div className="wrap promise-grid"><div><span>01</span><strong>Свежие цветы</strong><small>Ежедневные поставки</small></div><div><span>02</span><strong>Фото перед доставкой</strong><small>Вы увидите готовый букет</small></div><div><span>03</span><strong>Бережная доставка</strong><small>Точно к нужному времени</small></div></div></section>
      <section className="wrap section catalog-section" id="catalog"><div className="section-heading"><div><span className="eyebrow">Коллекция LaFleur</span><h2>Найдите свой букет</h2></div><p>Каждый букет собирается флористом вручную. Возможны лёгкие изменения состава с сохранением настроения и палитры.</p></div><div className="categories"><button className={`chip ${activeCategory === "all" ? "active" : ""}`} onClick={() => setActiveCategory("all")}>Все букеты</button>{categories.map((category) => <button className={`chip ${activeCategory === category.id ? "active" : ""}`} onClick={() => setActiveCategory(category.id)} key={category.id}>{category.name}</button>)}</div>{warning && <p className="status">{warning}</p>}<div className="grid product-grid">{visibleProducts.map((product, index) => <article className="card" key={product.id}><div className={`photo flower-placeholder tone-${(index % 4) + 1}`}>{product.image_url ? <Image src={product.image_url} alt={product.image_alt} width={700} height={820} sizes="(max-width: 650px) 100vw, 25vw" /> : <><span className="flower-mark">✤</span><small>Фото скоро появится</small></>}<div className="badges">{product.is_hit && <span>Хит</span>}{product.is_new && <span>Новинка</span>}</div></div><div className="cardbody"><div><h3>{product.name}</h3><p>{product.description || "Нежная композиция от флористов LaFleur"}</p></div><div className="card-bottom"><strong className="price">{money(product.price_minor, product.currency)}</strong><button onClick={() => addToCart(product)} aria-label={`Добавить ${product.name} в корзину`}>＋</button></div></div></article>)}</div>{!warning && visibleProducts.length === 0 && <div className="catalog-empty">В этой категории скоро появятся букеты.</div>}</section>
      <section className="wrap story" id="service"><div className="story-art"><Image src="/images/lafleur-studio-roses.png" alt="Розы на столе флориста" fill sizes="(max-width: 650px) 100vw, 50vw" /></div><div className="story-copy"><span className="eyebrow">Особенный подход</span><h2>Красота — в заботе о деталях</h2><p>Подберём цветы под повод, характер и настроение. Подпишем открытку, согласуем время и пришлём фотографию букета перед отправкой.</p><blockquote>«Мы создаём не просто букеты, а маленькие воспоминания»</blockquote></div></section>
      <section className="delivery" id="delivery"><div className="wrap delivery-inner"><div><span className="eyebrow">Доставка и забота</span><h2>Ваши чувства<br />приедут вовремя</h2></div><div className="delivery-copy"><p>Доставляем по Екатеринбургу день в день. Перед отправкой бережно упакуем букет и согласуем детали с вами.</p><button className="button light" onClick={() => setCartOpen(true)}>Перейти в корзину</button></div></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-inner"><a className="brand" href="#top">LA<span>FLEUR</span></a><p>Цветочная мастерская в Екатеринбурге</p><small>© {new Date().getFullYear()} LaFleur</small></div></footer>

    {cartOpen && <div className="cart-layer" role="dialog" aria-modal="true" aria-label="Корзина"><button className="cart-backdrop" onClick={closeCart} aria-label="Закрыть корзину" /><aside className="cart-drawer"><div className="cart-head"><div><span className="eyebrow">LaFleur</span><h2>{orderNumber ? "Заказ оформлен" : "Ваша корзина"}</h2></div><button className="cart-close" onClick={closeCart}>×</button></div>{orderNumber ? <div className="order-success"><div className="success-mark">✓</div><h3>Спасибо за заказ №{orderNumber}</h3><p>Мы скоро позвоним по указанному номеру, чтобы подтвердить состав, стоимость доставки и время.</p><button className="button" onClick={closeCart}>Вернуться в магазин</button></div> : <>{cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}>{item.image_url ? <Image src={item.image_url} alt="" width={72} height={82} /> : <div className="cart-thumb">✤</div>}<div className="cart-item-copy"><strong>{item.name}</strong><small>{money(item.price_minor, item.currency)}</small><div className="quantity"><button onClick={() => setQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item.id, item.quantity + 1)}>＋</button></div></div></div>)}</div><div className="cart-total"><span>Итого без доставки</span><strong>{money(subtotal)}</strong></div><form className="checkout-form" onSubmit={submitOrder}><h3>Оформление заказа</h3><label>Ваше имя<input required maxLength={80} autoComplete="name" value={checkout.name} onChange={(e) => setCheckout({ ...checkout, name: e.target.value })} placeholder="Анна" /></label><label>Телефон<input required maxLength={30} autoComplete="tel" inputMode="tel" value={checkout.phone} onChange={(e) => setCheckout({ ...checkout, phone: e.target.value })} placeholder="+7 999 000-00-00" /></label><fieldset><legend>Как получить заказ?</legend><label className="radio"><input type="radio" name="fulfillment" checked={checkout.fulfillment === "delivery"} onChange={() => setCheckout({ ...checkout, fulfillment: "delivery" })} /> Доставка</label><label className="radio"><input type="radio" name="fulfillment" checked={checkout.fulfillment === "pickup"} onChange={() => setCheckout({ ...checkout, fulfillment: "pickup", address: "" })} /> Самовывоз</label></fieldset>{checkout.fulfillment === "delivery" && <label>Адрес доставки<input required maxLength={240} value={checkout.address} onChange={(e) => setCheckout({ ...checkout, address: e.target.value })} placeholder="Улица, дом, квартира" /></label>}<label>К какому времени<input required type="datetime-local" value={checkout.deliveryAt} onChange={(e) => setCheckout({ ...checkout, deliveryAt: e.target.value })} /></label><label>Комментарий<textarea maxLength={500} rows={3} value={checkout.comment} onChange={(e) => setCheckout({ ...checkout, comment: e.target.value })} placeholder="Пожелания к заказу" /></label><div className="call-note"><span>☎</span><p><strong>После оформления мы позвоним</strong><br />Уточним детали, доставку и подтвердим итоговую стоимость.</p></div>{checkoutError && <p className="checkout-error">{checkoutError}</p>}<button className="button checkout-button" disabled={submitting}>{submitting ? "Оформляем…" : "Оформить заказ"}</button></form></> : <div className="empty-cart"><span>✤</span><h3>Корзина пока пуста</h3><p>Добавьте понравившийся букет из каталога.</p><button className="button" onClick={() => { setCartOpen(false); document.getElementById("catalog")?.scrollIntoView(); }}>Выбрать букет</button></div>}</>}</aside></div>}
  </>;
}
