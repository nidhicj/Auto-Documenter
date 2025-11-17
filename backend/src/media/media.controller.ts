import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
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
   * Get media URL
   */
  @Get(':key')
  @UseGuards(JwtAuthGuard)
  async getMediaUrl(@Param('key') key: string) {
    const url = await this.mediaService.getMediaUrl(key);
    return { url };
  }
}



