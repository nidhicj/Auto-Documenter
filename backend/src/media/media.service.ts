import { Injectable } from '@nestjs/common';
import { S3Service } from './s3.service';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaService {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * Generate signed URL for upload
   */
  async getSignedUrl(
    contentType: string,
    expiresIn: number = 3600,
    organizationId?: string,
  ): Promise<{ signedUrl: string; key: string }> {
    const key = this.generateKey(organizationId);
    const signedUrl = await this.s3Service.getSignedUploadUrl(key, contentType, expiresIn);
    return { signedUrl, key };
  }

  /**
   * Process uploaded screenshot: compress and store
   */
  async processScreenshot(
    key: string,
    imageBuffer: Buffer,
    organizationId?: string,
  ): Promise<string> {
    // Compress image using sharp
    const compressed = await sharp(imageBuffer)
      .png({ quality: 90, compressionLevel: 9 })
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    // Upload to S3
    const finalKey = organizationId
      ? `orgs/${organizationId}/${key}`
      : key;

    await this.s3Service.upload(finalKey, compressed, 'image/png');

    return finalKey;
  }

  /**
   * Get public URL for media
   */
  async getMediaUrl(key: string): Promise<string> {
    return await this.s3Service.getPublicUrl(key);
  }

  /**
   * Generate unique key for media
   */
  private generateKey(organizationId?: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    const baseKey = `screenshots/${timestamp}-${uuid}.png`;
    return organizationId ? `orgs/${organizationId}/${baseKey}` : baseKey;
  }
}




