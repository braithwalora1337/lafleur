"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Category, Product, ProductImage } from "@/lib/database.types";

declare global { interface Window { Telegram?: { WebApp?: { initData: string; ready(): void; expand(): void } } } }
type SessionResponse = { admin: { display_name: string | null }; telegram: { first_name: string } };
type DataResponse<T> = { data?: T; error?: string };
type ProductDraft = { name: string; slug: string; description: string; price: string; category_id: string; is_published: boolean; is_available: boolean };
const emptyDraft: ProductDraft = { name: "", slug: "", description: "", price: "", category_id: "", is_published: true, is_available: true };
const slugify = (value: string) => value.toLowerCase().trim().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");
const publicImageUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;

function loadTelegramSdk() {
  if (window.Telegram?.WebApp) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-telegram-sdk]");
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Не удалось загрузить Telegram SDK")), { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.dataset.telegramSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить Telegram SDK"));
    document.head.appendChild(script);
  });
}

export default function AdminShell() {
  const initData = useRef("");
  const [status, setStatus] = useState("Проверяем доступ…");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [uploadingProduct, setUploadingProduct] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", "x-telegram-init-data": initData.current, ...options.headers } });
    if (response.status === 204) return undefined as T;
    const json = await response.json() as DataResponse<T>;
    if (!response.ok) throw new Error(json.error ?? "Ошибка запроса");
    return json.data as T;
  }, []);

  const refresh = useCallback(async () => {
    const [productData, categoryData, imageData] = await Promise.all([
      request<Product[]>("/api/admin/products"),
      request<Category[]>("/api/admin/categories"),
      request<ProductImage[]>("/api/admin/product_images"),
    ]);
    setProducts(productData);
    setCategories(categoryData.sort((a, b) => a.sort_order - b.sort_order));
    setImages(imageData.sort((a, b) => a.sort_order - b.sort_order));
  }, [request]);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        await loadTelegramSdk();
        if (!active) return;
        const app = window.Telegram?.WebApp;
        app?.ready(); app?.expand();
        if (!app?.initData) { setStatus("Откройте эту страницу через кнопку Mini App внутри Telegram."); return; }
        initData.current = app.initData;
        const session = await request<SessionResponse>("/api/admin/session", { method: "POST" });
        if (!active) return;
        setStatus(`Здравствуйте, ${session.admin.display_name || session.telegram.first_name}`);
        setReady(true);
        await refresh();
      } catch (error) { if (active) setStatus(error instanceof Error ? error.message : "Ошибка доступа"); }
    }
    void boot();
    return () => { active = false; };
  }, [refresh, request]);

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    const price = Number(draft.price.replace(",", "."));
    if (!draft.name.trim() || !draft.slug.trim() || !Number.isFinite(price) || price < 0) { setStatus("Заполните название, slug и корректную цену"); return; }
    setBusy(true);
    try {
      await request<Product>("/api/admin/products", { method: "POST", body: JSON.stringify({ name: draft.name.trim(), slug: draft.slug.trim(), description: draft.description.trim(), price_minor: Math.round(price * 100), currency: "RUB", category_id: draft.category_id || null, is_published: draft.is_published, is_available: draft.is_available }) });
      setDraft(emptyDraft); await refresh(); setStatus("Товар добавлен. Теперь загрузите его фотографии ниже.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Не удалось добавить товар"); } finally { setBusy(false); }
  }

  async function patchProduct(id: string, changes: Partial<Product>) {
    setBusy(true);
    try { await request<Product>(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(changes) }); await refresh(); setStatus("Изменения сохранены"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка сохранения"); } finally { setBusy(false); }
  }

  async function editProduct(product: Product) {
    const name = window.prompt("Название товара", product.name); if (name === null) return;
    const price = window.prompt("Цена в рублях", String(product.price_minor / 100)); if (price === null) return;
    const parsed = Number(price.replace(",", "."));
    if (!name.trim() || !Number.isFinite(parsed) || parsed < 0) { setStatus("Проверьте название и цену"); return; }
    await patchProduct(product.id, { name: name.trim(), price_minor: Math.round(parsed * 100) });
  }

  async function uploadImage(product: Product, file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setStatus("Выберите JPG, PNG или WebP"); return; }
    if (file.size > 8 * 1024 * 1024) { setStatus("Фотография должна быть не больше 8 МБ"); return; }
    setUploadingProduct(product.id);
    try {
      const form = new FormData(); form.set("productId", product.id); form.set("file", file);
      const response = await fetch("/api/admin/uploads/product-image", { method: "POST", headers: { "x-telegram-init-data": initData.current }, body: form });
      const json = await response.json() as DataResponse<ProductImage>;
      if (!response.ok) throw new Error(json.error ?? "Не удалось загрузить фотографию");
      await refresh(); setStatus(`Фотография для «${product.name}» загружена`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка загрузки"); } finally { setUploadingProduct(null); }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Удалить «${product.name}»?`)) return;
    setBusy(true);
    try { await request<never>(`/api/admin/products/${product.id}`, { method: "DELETE" }); await refresh(); setStatus("Товар удалён"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Ошибка удаления"); } finally { setBusy(false); }
  }

  return <main className="admin"><div className="adminbar"><div className="wrap brand">LAFLEUR · ADMIN</div></div><div className="wrap"><section className="panel"><h1>Управление магазином</h1><p className="status">{status}</p></section>{ready && <><section className="panel"><div className="panel-title"><h2>Новый товар</h2></div><form className="admin-form" onSubmit={createProduct}><label>Название<input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value, slug: value.slug || slugify(event.target.value) }))} placeholder="Букет Лаванда" required /></label><label>Slug<input value={draft.slug} onChange={(event) => setDraft((value) => ({ ...value, slug: slugify(event.target.value) }))} placeholder="buket-lavanda" required /></label><label>Цена, ₽<input inputMode="decimal" value={draft.price} onChange={(event) => setDraft((value) => ({ ...value, price: event.target.value }))} placeholder="4990" required /></label><label>Категория<select value={draft.category_id} onChange={(event) => setDraft((value) => ({ ...value, category_id: event.target.value }))}><option value="">Без категории</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="full">Описание<textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Состав и настроение букета" rows={3} /></label><label className="check"><input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft((value) => ({ ...value, is_published: event.target.checked }))} /> Опубликовать</label><label className="check"><input type="checkbox" checked={draft.is_available} onChange={(event) => setDraft((value) => ({ ...value, is_available: event.target.checked }))} /> В наличии</label><button className="button full" disabled={busy}>{busy ? "Сохраняем…" : "Добавить товар"}</button></form></section><section className="panel"><div className="panel-title"><h2>Каталог товаров</h2><span className="chip active">{products.length}</span></div><p className="admin-help">Добавьте товар, затем загрузите до 8 фотографий. Первая фотография станет главной в каталоге.</p><div className="product-list">{products.map((product) => { const productImages = images.filter((image) => image.product_id === product.id); return <article className="admin-product" key={product.id}><div className="admin-product-info"><div className="admin-thumbs">{productImages.length ? productImages.slice(0, 4).map((image) => <Image key={image.id} src={publicImageUrl(image.storage_path)} alt={image.alt_text || product.name} width={58} height={68} />) : <div className="admin-no-photo">✤</div>}</div><div><strong>{product.name}</strong><div className="muted">{(product.price_minor / 100).toLocaleString("ru-RU")} ₽ · {product.slug}</div><div className="photo-count">Фото: {productImages.length}/8</div></div></div><div className="admin-actions"><label className={`upload-button ${uploadingProduct === product.id ? "disabled" : ""}`}>{uploadingProduct === product.id ? "Загрузка…" : "＋ Фото"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingProduct !== null} onChange={(event) => { void uploadImage(product, event.target.files?.[0]); event.target.value = ""; }} /></label><button disabled={busy} onClick={() => void editProduct(product)}>Изменить</button><button disabled={busy} onClick={() => void patchProduct(product.id, { is_published: !product.is_published })}>{product.is_published ? "Скрыть" : "Опубликовать"}</button><button disabled={busy} onClick={() => void patchProduct(product.id, { is_available: !product.is_available })}>{product.is_available ? "Нет в наличии" : "В наличии"}</button><button className="danger" disabled={busy} onClick={() => void removeProduct(product)}>Удалить</button></div></article>; })}</div></section></>}</div></main>;
}
