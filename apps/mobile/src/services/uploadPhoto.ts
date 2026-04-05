/**
 * uploadPhoto — Uploads a photo to Supabase Storage from mobile.
 *
 * Flow:
 * 1. Read file as base64 from local URI
 * 2. Upload to field-reports bucket: {areaId}/{timestamp}.jpg
 * 3. Return public URL
 *
 * Offline resilience: returns local URI if upload fails.
 * Requires authenticated Supabase client (passes user JWT to storage RLS).
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';

const BUCKET = 'field-reports';

type UploadResult = {
  url: string;
  isLocal: boolean;
};

/**
 * Uploads a photo to Supabase Storage using the authenticated client.
 * Falls back to local URI if offline or upload fails.
 */
export async function uploadPhoto(
  localUri: string,
  supabase: SupabaseClient,
  areaId: string,
): Promise<UploadResult> {
  try {
    const timestamp = Date.now();
    const path = `${areaId}/${timestamp}.jpg`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert to Uint8Array for upload
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.warn('[uploadPhoto] Storage upload failed, using local URI:', error.message);
      return { url: localUri, isLocal: true };
    }

    const { data: publicUrl } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return { url: publicUrl.publicUrl, isLocal: false };
  } catch (err) {
    console.warn('[uploadPhoto] Failed, using local URI:', err);
    return { url: localUri, isLocal: true };
  }
}
