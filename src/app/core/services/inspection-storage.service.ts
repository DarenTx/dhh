import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

@Injectable({ providedIn: 'root' })
export class InspectionStorageService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  /**
   * Compress an image file client-side (max 1920px, JPEG 85% quality),
   * then upload to the inspection-photos bucket.
   * Path convention: {propertyId}/{inspectionId}/{roomType}/{uuid}.jpg
   * Always stores as image/jpeg regardless of input format (handles HEIC on iOS Safari).
   */
  uploadPhoto(
    propertyId: string,
    inspectionId: string,
    roomType: string,
    file: File,
  ): Observable<{ storagePath: string; fileName: string }> {
    return from(
      this.compressImage(file).then((blob) => {
        const fileName = `${crypto.randomUUID()}.jpg`;
        const storagePath = `${propertyId}/${inspectionId}/${roomType}/${fileName}`;
        return this.supabase.storage
          .from('inspection-photos')
          .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })
          .then(({ data, error }) => {
            if (error) throw error;
            return { storagePath: data!.path, fileName };
          });
      }),
    );
  }

  deletePhoto(storagePath: string): Observable<void> {
    return from(
      this.supabase.storage
        .from('inspection-photos')
        .remove([storagePath])
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  deletePhotos(storagePaths: string[]): Observable<void> {
    if (storagePaths.length === 0) return from(Promise.resolve());
    return from(
      this.supabase.storage
        .from('inspection-photos')
        .remove(storagePaths)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getSignedUrl(storagePath: string, expirySeconds = 3600): Observable<string> {
    return from(
      this.supabase.storage
        .from('inspection-photos')
        .createSignedUrl(storagePath, expirySeconds)
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.signedUrl;
        }),
    );
  }

  getSignedUrls(storagePaths: string[], expirySeconds = 3600): Observable<string[]> {
    if (storagePaths.length === 0) return from(Promise.resolve([]));
    return from(
      this.supabase.storage
        .from('inspection-photos')
        .createSignedUrls(storagePaths, expirySeconds)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((item: any) => item.signedUrl as string);
        }),
    );
  }

  /**
   * Compress an image to max 1920px on the longest side at 85% JPEG quality.
   * On iOS Safari, canvas.drawImage automatically converts HEIC → JPEG.
   */
  private compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob returned null'));
          },
          'image/jpeg',
          0.85,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image for compression'));
      };

      img.src = objectUrl;
    });
  }
}
