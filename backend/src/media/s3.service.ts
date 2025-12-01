import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private publicS3Client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'autodoc-bucket';

    // Internal S3 client for uploads (uses Docker network endpoint)
    this.s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true, // Required for MinIO
    });

    // Public S3 client for generating signed URLs (uses public endpoint accessible from browser)
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT;
    this.publicS3Client = new S3Client({
      endpoint: publicEndpoint,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true, // Required for MinIO
    });

    console.log('[S3Service] Initialized with endpoints:', {
      internal: process.env.S3_ENDPOINT,
      public: publicEndpoint,
    });
  }

  /**
   * Get signed URL for upload
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Upload file to S3
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  /**
   * Get public URL for object
   * Returns a URL accessible from the browser (not internal Docker network)
   * For MinIO, we need to use signed URLs or make bucket public
   */
  async getPublicUrl(key: string): Promise<string> {
    // Try to get a signed URL first (works even if bucket is private)
    try {
      return await this.getSignedDownloadUrl(key, 3600 * 24 * 7); // 7 days
    } catch (error) {
      // Fallback to public URL if signed URL fails
      const endpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT?.replace('minio:', 'localhost:') || 'http://localhost:9000';
      return `${endpoint}/${this.bucket}/${key}`;
    }
  }

  /**
   * Get signed URL for download
   * Uses public S3 client to ensure URLs are accessible from browser
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    // Use publicS3Client to generate URLs with public endpoint
    return getSignedUrl(this.publicS3Client, command, { expiresIn });
  }
}




