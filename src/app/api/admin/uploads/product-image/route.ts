import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maxSize = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let uploadedPath = "";
  try {
    const { db } = await requireAdmin(request);
    const form = await request.formData();
    const file = form.get("file");
    const productId = String(form.get("productId") ?? "");
    if (!(file instanceof File)) throw new Error("Выберите фотографию");
    if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new Error("Некорректный товар");
    const extension = allowedTypes.get(file.type);
    if (!extension) throw new Error("Допустимы JPG, PNG и WebP");
    if (file.size < 1 || file.size > maxSize) throw new Error("Размер фотографии должен быть до 8 МБ");

    const { data: product, error: productError } = await db.from("products").select("id,name").eq("id", productId).maybeSingle();
    if (productError || !product) throw new Error("Товар не найден");
    const { count, error: countError } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
    if (countError) throw countError;
    if ((count ?? 0) >= 8) throw new Error("Для одного товара можно загрузить до 8 фотографий");

    uploadedPath = `${productId}/${crypto.randomUUID()}.${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await db.storage.from("product-images").upload(uploadedPath, bytes, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;

    const { data: image, error: imageError } = await db.from("product_images").insert({ product_id: productId, storage_path: uploadedPath, alt_text: product.name, sort_order: count ?? 0 }).select().single();
    if (imageError || !image) {
      await db.storage.from("product-images").remove([uploadedPath]);
      throw imageError ?? new Error("Не удалось сохранить фотографию");
    }
    return NextResponse.json({ data: image }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить фотографию" }, { status: 400 });
  }
}
