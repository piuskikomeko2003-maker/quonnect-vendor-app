import { createClient } from "@/lib/supabase/browser";

async function upload(blob: Blob, path: string): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("vendor-assets")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });

  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from("vendor-assets").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export function uploadProductImage(blob: Blob, vendorId: string) {
  const id = crypto.randomUUID();
  return upload(blob, `${vendorId}/products/${id}.jpg`);
}

export function uploadLogo(blob: Blob, vendorId: string) {
  return upload(blob, `${vendorId}/logo.jpg`);
}
