import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

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
   * Upload screenshot via backend (proxies to MinIO to avoid CORS issues)
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for screenshots
    },
  }))
  async uploadScreenshot(
    @UploadedFile() file: any,
    @Body() body: { key?: string; stepIndex?: string; timestamp?: string; domEvent?: string },
    @Request() req: any,
  ) {
    console.log('[MediaController] Upload request received:', {
      hasFile: !!file,
      fileSize: file?.size,
      body,
      userId: req.user?.id,
      hasUser: !!req.user,
      userEmail: req.user?.email,
    });
    console.log('[MediaController] Request headers:', {
      authorization: req.headers?.authorization ? 'PRESENT' : 'MISSING',
      contentType: req.headers?.['content-type'],
    });

    if (!file) {
      console.error('[MediaController] No file provided in request');
      throw new Error('No file provided');
    }
    
    const key = body.key || `screenshots/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const finalKey = req.user?.organizationId
      ? `orgs/${req.user.organizationId}/${key}`
      : key;
    
    console.log('[MediaController] Uploading to MinIO with key:', finalKey);
    
    try {
      await this.mediaService.uploadScreenshot(finalKey, file.buffer);
      const url = await this.mediaService.getMediaUrl(finalKey);
      
      console.log('[MediaController] Upload successful:', { key: finalKey, url });
      
      return {
        url,
        key: finalKey,
      };
    } catch (error) {
      console.error('[MediaController] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Get media URL
   */
  @Get(':key')
  @UseGuards(JwtAuthGuard)
  async getMediaUrl(@Param('key') key: string) {
    const url = await this.mediaService.getMediaUrl(key);
    return { url };
  }
}



