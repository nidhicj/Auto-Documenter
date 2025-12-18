import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { RedactionService } from './redaction.service';
import { AnyAuthGuard } from '../auth/any-auth.guard';

@Controller('redaction')
@UseGuards(AnyAuthGuard)
export class RedactionController {
  constructor(private readonly redactionService: RedactionService) {}

  @Post('process')
  async processRedaction(@Body() body: { stepId: string; screenshotUri: string }) {
    return this.redactionService.processRedaction(body.stepId, body.screenshotUri);
  }

  @Post('apply')
  async applyRedaction(
    @Body() body: { screenshotUri: string; blurredRegions: any[] },
  ) {
    const redactedUri = await this.redactionService.applyRedaction(
      body.screenshotUri,
      body.blurredRegions,
    );
    return { redactedUri };
  }
}



