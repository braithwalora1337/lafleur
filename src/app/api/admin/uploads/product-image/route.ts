import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const allowedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const maxSize = 8 * 1024 * 1024;
const startSchema = z.object({ productId: z.string().uuid(), fileType: z.string(), fileSize: z.number().int().positive().max(maxSize) });
const completeSchema = z.object({ productId: z.string().uuid(), storagePath: z.string().min(1).max(500) });

export async function POST(request: NextRequest) {
  try {
    const { db } = await requireAdmin(request);
    const input = startSchema.parse(await request.json());
    const extension = allowedTypes.get(input.fileType);
    if (!extension) throw new Error("Допустимы JPG, PNG и WebP");

    const { data: product, error: productError } = await db.from("products").select("id").eq("id", input.productId).maybeSingle();
    if (productError || !product) throw new Error("Товар не найден");
    const { count, error: countError } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", input.productId);
    if (countError) throw countError;
    if ((count ?? 0) >= 8) throw new Error("Для одного товара можно загрузить до 8 фотографий");

    const storagePath = `${input.productId}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await db.storage.from("product-images").createSignedUploadUrl(storagePath);
    if (error) throw error;
    return NextResponse.json({ data: { storagePath, token: data.token } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось подготовить загрузку" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { db } = await requireAdmin(request);
    const input = completeSchema.parse(await request.json());
    if (!input.storagePath.startsWith(`${input.productId}/`)) throw new Error("Некорректный путь фотографии");

    const { data: product, error: productError } = await db.from("products").select("id,name").eq("id", input.productId).maybeSingle();
    if (productError || !product) throw new Error("Товар не найден");
    const { count, error: countError } = await db.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", input.productId);
    if (countError) throw countError;
    if ((count ?? 0) >= 8) { await db.storage.from("product-images").remove([input.storagePath]); throw new Error("Для одного товара можно загрузить до 8 фотографий"); }

    const { data: image, error: imageError } = await db.from("product_images").insert({ product_id: input.productId, storage_path: input.storagePath, alt_text: product.name, sort_order: count ?? 0 }).select().single();
    if (imageError || !image) { await db.storage.from("product-images").remove([input.storagePath]); throw imageError ?? new Error("Не удалось сохранить фотографию"); }
    return NextResponse.json({ data: image }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось завершить загрузку" }, { status: 400 });
  }
}
