
/**
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'scribe-media';
    
    this.s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  // Get signed URL for upload
 
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

  // Upload file to S3

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }


  //Get public URL for object

  getPublicUrl(key: string): string {
    const endpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'http://localhost:9000';
    return `${endpoint}/${this.bucket}/${key}`;
  }


  //Get signed URL for download

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
 
*/

import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3ClientInternal: S3Client;
  private s3ClientPublic: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'scribe-media';

    const region = process.env.S3_REGION || 'us-east-1';
    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    };

    // Backend -> MinIO (Docker network)
    const internalEndpoint = process.env.S3_ENDPOINT || 'http://minio:9000';

    // Browser/Next -> MinIO (host-reachable)
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || 'http://localhost:9000';

    this.s3ClientInternal = new S3Client({
      endpoint: internalEndpoint,
      region,
      credentials,
      forcePathStyle: true,
    });

    this.s3ClientPublic = new S3Client({
      endpoint: publicEndpoint,
      region,
      credentials,
      forcePathStyle: true,
    });
  }

/**
   * Signed URL for upload (client-side PUT)
   * Must use PUBLIC endpoint, otherwise the URL contains "minio:9000" and the browser can't reach it.
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

    return getSignedUrl(this.s3ClientPublic, command, { expiresIn });
  }

  /**
   * Upload bytes from backend to S3/MinIO
   * Must use INTERNAL endpoint.
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3ClientInternal.send(command);
  }

  /**
   * Public URL (only works if bucket/object is public).
   * Prefer signed URLs for private buckets.
   */
  getPublicUrl(key: string): string {
    const endpoint = (process.env.S3_PUBLIC_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '');
    return `${endpoint}/${this.bucket}/${key}`;
  }

  /**
   * Signed URL for download
   * Must use PUBLIC endpoint, otherwise Next/browser can't fetch it.
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3ClientPublic, command, { expiresIn });
  }
}


