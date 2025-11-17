import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RedactionService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Process redaction for a step
   * Calls AI service for OCR and PII detection
   */
  async processRedaction(stepId: string, screenshotUri: string): Promise<any> {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${aiServiceUrl}/redaction/process`, {
          stepId,
          screenshotUri,
        }),
      );

      return response.data;
    } catch (error) {
      console.error('[Redaction] Failed to process:', error);
      throw error;
    }
  }

  /**
   * Apply redaction blur to screenshot
   */
  async applyRedaction(screenshotUri: string, blurredRegions: any[]): Promise<string> {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${aiServiceUrl}/redaction/apply`, {
          screenshotUri,
          blurredRegions,
        }),
      );

      return response.data.redactedUri;
    } catch (error) {
      console.error('[Redaction] Failed to apply redaction:', error);
      throw error;
    }
  }
}



