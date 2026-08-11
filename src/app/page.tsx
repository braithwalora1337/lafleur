import Image from "next/image";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 60;

type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_minor: number;
  currency: string;
  is_hit: boolean;
  is_new: boolean;
  product_images: { storage_path: string; alt_text: string; sort_order: number }[];
};

type StoreCategory = { id: string; name: string; slug: string };

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);

export default async function Home() {
  let products: StoreProduct[] = [];
  let categories: StoreCategory[] = [];
  let warning = "";

  try {
    const db = createPublicClient();
    const [productResult, categoryResult] = await Promise.all([
      db
        .from("products")
        .select(
          "id,name,slug,description,price_minor,currency,is_hit,is_new,product_images(storage_path,alt_text,sort_order)",
        )
        .eq("is_published", true)
        .order("sort_order"),
      db
        .from("categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    if (productResult.error) throw productResult.error;
    if (categoryResult.error) throw categoryResult.error;
    products = productResult.data ?? [];
    categories = categoryResult.data ?? [];
  } catch {
    warning = "Каталог временно обновляется";
  }

  return (
    <>
      <header className="site-header">
        <div className="wrap nav">
          <a className="brand" href="#top" aria-label="LaFleur — на главную">
            LA<span>FLEUR</span>
          </a>
          <nav className="navlinks" aria-label="Основная навигация">
            <a href="#catalog">Букеты</a>
            <a href="#service">Сервис</a>
            <a href="#delivery">Доставка</a>
          </nav>
          <a className="nav-order" href="https://t.me/MINIAPPADMINKA_bot">
            Заказать
          </a>
        </div>
      </header>

      <main id="top">
        <section className="wrap hero">
          <div className="hero-copy">
            <span className="eyebrow">Цветочная мастерская · Екатеринбург</span>
            <h1>Букеты с&nbsp;нежным характером</h1>
            <p>
              Собираем свежие цветы в выразительные композиции, чтобы ваши
              чувства звучали без лишних слов.
            </p>
            <div className="hero-actions">
              <a className="button" href="#catalog">Выбрать букет</a>
              <a className="text-link" href="#service">Как мы работаем <span>↘</span></a>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="petal petal-one" />
            <div className="petal petal-two" />
            <div className="petal petal-three" />
            <div className="hero-stamp"><span>с любовью</span><strong>LaFleur</strong></div>
          </div>
          <div className="hero-note">Доставим сегодня<br />при заказе до 18:00</div>
        </section>

        <section className="promise-strip" aria-label="Преимущества">
          <div className="wrap promise-grid">
            <div><span>01</span><strong>Свежие цветы</strong><small>Ежедневные поставки</small></div>
            <div><span>02</span><strong>Фото перед доставкой</strong><small>Вы увидите готовый букет</small></div>
            <div><span>03</span><strong>Бережная доставка</strong><small>Точно к нужному времени</small></div>
          </div>
        </section>

        <section className="wrap section catalog-section" id="catalog">
          <div className="section-heading">
            <div><span className="eyebrow">Коллекция LaFleur</span><h2>Найдите свой букет</h2></div>
            <p>Каждый букет собирается флористом вручную. Возможны лёгкие изменения состава с сохранением настроения и палитры.</p>
          </div>
          <div className="categories">
            <span className="chip active">Все букеты</span>
            {categories.map((category) => <span className="chip" key={category.id}>{category.name}</span>)}
          </div>
          {warning && <p className="status">{warning}</p>}
          <div className="grid product-grid">
            {products.map((product, index) => {
              const image = [...(product.product_images ?? [])].sort(
                (a, b) => a.sort_order - b.sort_order,
              )[0];
              const url = image
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${image.storage_path}`
                : null;
              return (
                <article className="card" key={product.id}>
                  <div className={`photo flower-placeholder tone-${(index % 4) + 1}`}>
                    {url ? (
                      <Image src={url} alt={image.alt_text || product.name} width={700} height={820} sizes="(max-width: 650px) 100vw, 33vw" />
                    ) : (
                      <><span className="flower-mark">✤</span><small>Фото скоро появится</small></>
                    )}
                    <div className="badges">
                      {product.is_hit && <span>Хит</span>}
                      {product.is_new && <span>Новинка</span>}
                    </div>
                  </div>
                  <div className="cardbody">
                    <div><h3>{product.name}</h3><p>{product.description || "Нежная композиция от флористов LaFleur"}</p></div>
                    <div className="card-bottom"><strong className="price">{money(product.price_minor, product.currency)}</strong><a href="https://t.me/MINIAPPADMINKA_bot" aria-label={`Заказать ${product.name}`}>＋</a></div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="wrap story" id="service">
          <div className="story-art"><span>LaFleur</span></div>
          <div className="story-copy">
            <span className="eyebrow">Особенный подход</span>
            <h2>Красота — в заботе о деталях</h2>
            <p>Подберём цветы под повод, характер и настроение. Подпишем открытку, согласуем время и пришлём фотографию букета перед отправкой.</p>
            <blockquote>«Мы создаём не просто букеты, а маленькие воспоминания»</blockquote>
          </div>
        </section>

        <section className="delivery" id="delivery">
          <div className="wrap delivery-inner">
            <div><span className="eyebrow">Доставка и забота</span><h2>Ваши чувства<br />приедут вовремя</h2></div>
            <div className="delivery-copy"><p>Доставляем по Екатеринбургу день в день. Перед отправкой бережно упакуем букет и согласуем детали с вами.</p><a className="button light" href="https://t.me/MINIAPPADMINKA_bot">Написать в Telegram</a></div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner"><a className="brand" href="#top">LA<span>FLEUR</span></a><p>Цветочная мастерская в Екатеринбурге</p><small>© {new Date().getFullYear()} LaFleur</small></div>
      </footer>
    </>
  );
}
