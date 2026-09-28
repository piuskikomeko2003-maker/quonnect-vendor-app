import { supabase } from '@/lib/supabaseClient';

export interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Uploads a product photo to Supabase Storage `vendor-assets` bucket
 * with automatic retries for intermittent mobile network connections.
 */
export async function uploadProductPhotoWithRetry(
  file: File,
  vendorId: string,
  productId: string,
  maxRetries: number = 3,
  isDemo: boolean = false
): Promise<UploadResult> {
  // If demo mode or test without real session, convert to local object URL or Data URL
  if (isDemo || vendorId.startsWith('demo-')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ url: reader.result as string, error: null });
      };
      reader.onerror = () => {
        resolve({ url: null, error: 'Failed to read image locally.' });
      };
      reader.readAsDataURL(file);
    });
  }

  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${vendorId}/products/${productId}.${fileExt}`;

  let attempts = 0;
  let lastErrorMessage: string | null = null;

  while (attempts < maxRetries) {
    attempts++;
    try {
      const { data, error } = await supabase.storage
        .from('vendor-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        lastErrorMessage = error.message;
        console.warn(`Upload attempt ${attempts} failed:`, error.message);
        // Wait before retrying (exponential backoff: 500ms, 1500ms, etc.)
        if (attempts < maxRetries) {
          await new Promise((r) => setTimeout(r, attempts * 750));
        }
        continue;
      }

      if (data) {
        const { data: publicData } = supabase.storage
          .from('vendor-assets')
          .getPublicUrl(filePath);

        return { url: publicData.publicUrl, error: null };
      }
    } catch (err) {
      lastErrorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`Upload attempt ${attempts} exception:`, err);
      if (attempts < maxRetries) {
        await new Promise((r) => setTimeout(r, attempts * 750));
      }
    }
  }

  return {
    url: null,
    error: lastErrorMessage || `Upload failed after ${maxRetries} attempts. Check your internet connection.`,
  };
}
