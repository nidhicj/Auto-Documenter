import { Controller, Get, Param } from '@nestjs/common';
import { GuidesService } from '../guides/guides.service';

@Controller('embed')
export class EmbedController {
  constructor(private readonly guidesService: GuidesService) {}

  /**
   * Public embed endpoint (no auth required)
   */
  @Get(':id')
  async getEmbed(@Param('id') id: string) {
    // In production, validate embed token
    const guide = await this.guidesService.findOne(id, 'public'); // Use public org for embeds
    return {
      guide: {
        id: guide.id,
        title: guide.title,
        description: guide.description,
        steps: guide.steps.sort((a, b) => a.stepIndex - b.stepIndex),
      },
    };
  }
}



