import { S3UploadService } from './s3Upload';
import { storage } from '../storage';
import type { MediaAsset, InsertMediaAsset } from '@shared/schema';
import { randomUUID } from 'crypto';

export type MediaType = 'photo' | 'video' | 'avatar' | 'document' | 'audio';
export type MediaSource = 'upload' | 'heygen' | 'library' | 'ai_generated' | 'kling';

interface UploadResult {
  url: string;
  key: string;
  mediaAsset: MediaAsset;
}

interface UploadOptions {
  userId: string;
  type: MediaType;
  source: MediaSource;
  title?: string;
  description?: string;
  avatarId?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
}

const s3Service = new S3UploadService();

export async function uploadAndRecord(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string,
  options: UploadOptions
): Promise<UploadResult> {
  const key = `user-${options.userId}/${folder}/${fileName}`;
  const url = await s3Service.uploadBuffer(fileBuffer, key, contentType);
  
  const mediaAsset = await storage.createMediaAsset({
    userId: options.userId,
    type: options.type,
    source: options.source,
    url,
    title: options.title,
    description: options.description,
    mimeType: contentType,
    fileSize: fileBuffer.length,
    avatarId: options.avatarId,
    durationSeconds: options.durationSeconds,
    width: options.width,
    height: options.height,
    metadata: options.metadata,
  });

  console.log(`✅ Media asset uploaded to S3 and recorded in database: ${mediaAsset.id}`);
  
  return { url, key, mediaAsset };
}

export async function persistImageFromUrlAndRecord(
  imageUrl: string,
  fileName: string,
  folder: string,
  options: UploadOptions
): Promise<UploadResult | null> {
  try {
    console.log(`📥 Downloading image to persist to S3: ${fileName}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to download image: ${response.status}`);
      return null;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return await uploadAndRecord(imageBuffer, fileName, contentType, folder, options);
  } catch (error) {
    console.error('Failed to persist image to S3:', error);
    return null;
  }
}

export async function persistVideoFromUrlAndRecord(
  videoUrl: string,
  fileName: string,
  folder: string,
  options: UploadOptions
): Promise<UploadResult | null> {
  try {
    console.log(`📥 Downloading video to persist to S3: ${fileName}`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error(`Failed to download video: ${response.status}`);
      return null;
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'video/mp4';

    return await uploadAndRecord(videoBuffer, fileName, contentType, folder, options);
  } catch (error) {
    console.error('Failed to persist video to S3:', error);
    return null;
  }
}

export { s3Service };
