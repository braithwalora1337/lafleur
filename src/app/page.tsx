import { createPublicClient } from "@/lib/supabase/public";
import Storefront, { type StorefrontProduct } from "./storefront";

export const revalidate = 60;

type ProductRow = Omit<StorefrontProduct, "image_url" | "image_alt"> & {
  product_images: { storage_path: string; alt_text: string; sort_order: number }[];
};

export default async function Home() {
  let products: StorefrontProduct[] = [];
  let categories: { id: string; name: string; slug: string }[] = [];
  let warning = "";

  try {
    const db = createPublicClient();
    const [productResult, categoryResult] = await Promise.all([
      db.from("products").select("id,category_id,name,slug,description,price_minor,currency,is_hit,is_new,product_images(storage_path,alt_text,sort_order)").eq("is_published", true).order("sort_order"),
      db.from("categories").select("id,name,slug").eq("is_active", true).order("sort_order"),
    ]);
    if (productResult.error) throw productResult.error;
    if (categoryResult.error) throw categoryResult.error;
    products = ((productResult.data ?? []) as ProductRow[]).map((product) => {
      const image = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      return {
        id: product.id,
        category_id: product.category_id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price_minor: product.price_minor,
        currency: product.currency,
        is_hit: product.is_hit,
        is_new: product.is_new,
        image_url: image ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${image.storage_path}` : null,
        image_alt: image?.alt_text || product.name,
      };
    });
    categories = categoryResult.data ?? [];
  } catch {
    warning = "Каталог временно обновляется";
  }

  return <Storefront products={products} categories={categories} warning={warning} />;
}
