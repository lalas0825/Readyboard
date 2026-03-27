/**
 * uploadPhoto — Uploads a photo to Supabase Storage from mobile.
 *
 * Flow:
 * 1. Read file as blob from local URI
 * 2. Upload to field-reports bucket: {projectId}/{areaId}/{timestamp}.jpg
 * 3. Return public URL
 *
 * Offline resilience: returns local URI if upload fails.
 * PowerSync will sync the field_report row; photo URL works either way.
 */

import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'field-reports';

type UploadResult = {
  url: string;
  isLocal: boolean;
};

/**
 * Uploads a photo to Supabase Storage.
 * Falls back to local URI if offline or upload fails.
 */
export async function uploadPhoto(
  localUri: string,
  projectId: string,
  areaId: string,
): Promise<UploadResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { url: localUri, isLocal: true };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const timestamp = Date.now();
    const path = `${projectId}/${areaId}/${timestamp}.jpg`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert to ArrayBuffer
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

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return { url: publicUrl.publicUrl, isLocal: false };
  } catch (err) {
    console.warn('[uploadPhoto] Failed, using local URI:', err);
    return { url: localUri, isLocal: true };
  }
}
