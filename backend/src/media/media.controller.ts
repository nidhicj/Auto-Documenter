import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  SetMetadata,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3Service } from './s3.service';

// Decorator to mark endpoints as public
const Public = () => SetMetadata('isPublic', true);

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Get signed URL for screenshot upload
   */
  @Post('signed-url')
  @UseGuards(JwtAuthGuard)
  async getSignedUrl(
    @Body() body: { key?: string; contentType: string; expiresIn?: number },
    @Request() req: any,
  ) {
    const { signedUrl, key } = await this.mediaService.getSignedUrl(
      body.contentType,
      body.expiresIn || 3600,
      req.user?.organizationId,
    );
    return { signedUrl, key };
  }

  /**
   * Notify backend that upload is complete
   */
  @Post('upload-complete')
  @UseGuards(JwtAuthGuard)
  async uploadComplete(
    @Body() body: { key: string; stepIndex: number; timestamp: number; domEvent: any },
  ) {
    // Store upload metadata
    return { success: true, key: body.key };
  }

  /**
   * Get media URL or serve media file
   * Public for development - allows accessing screenshots
   */
  @Get(':key(*)')
  @Public()
  async getMedia(@Param('key') key: string, @Res() res: Response) {
    try {
      // Decode the key (it might be URL encoded)
      const decodedKey = decodeURIComponent(key);
      
      // Try to get signed URL first (works even if bucket is private)
      try {
        const signedUrl = await this.s3Service.getSignedDownloadUrl(decodedKey, 3600 * 24 * 7); // 7 days
        res.redirect(signedUrl);
        return;
      } catch (signedError) {
        // If signed URL fails, use public URL (bucket is public)
        const endpoint = process.env.S3_PUBLIC_ENDPOINT || 'http://localhost:9000';
        const bucket = process.env.S3_BUCKET || 'autodoc-bucket';
        const publicUrl = `${endpoint}/${bucket}/${decodedKey}`;
        res.redirect(publicUrl);
      }
    } catch (error: any) {
      console.error('[MediaController] Error getting media:', error.message);
      res.status(404).json({ error: 'Media not found', key });
    }
  }
}
