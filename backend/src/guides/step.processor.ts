import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Step } from './entities/step.entity';
import { MediaService } from '../media/media.service';

@Processor('step-processing')
@Injectable()
export class StepProcessor {
  constructor(
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    private mediaService: MediaService,
  ) {}

  @Process('process-workflow')
  async handleWorkflowProcessing(job: Job<{ guideId: string; workflow: any }>) {
    const { guideId, workflow } = job.data;

    // Process each screenshot and create steps
    for (let i = 0; i < workflow.screenshots.length; i++) {
      const screenshot = workflow.screenshots[i];
      const event = screenshot.domEvent;

      // Upload screenshot if not already uploaded
      let screenshotUri = null;
      if (screenshot.screenshotBase64) {
        // Convert base64 to buffer
        const base64Data = screenshot.screenshotBase64.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // Process and upload
        const key = `screenshots/${workflow.id}/${i}-${screenshot.timestamp}.png`;
        screenshotUri = await this.mediaService.processScreenshot(key, buffer);
      }

      // Generate description (will be enhanced by AI service)
      const description = this.generateDescription(event);

      // Create step
      const step = this.stepRepository.create({
        guideId,
        stepIndex: screenshot.stepIndex,
        description,
        screenshotUri,
        domEvent: event,
        timestamp: screenshot.timestamp,
      });

      await this.stepRepository.save(step);
    }

    return { success: true, guideId };
  }

  /**
   * Generate basic description from DOM event
   */
  private generateDescription(event: any): string {
    const { type, target } = event;

    switch (type) {
      case 'click':
        return `Click on ${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${target.className ? `.${target.className.split(' ')[0]}` : ''}`;
      case 'navigation':
        return `Navigate to ${event.url}`;
      case 'input':
        return `Enter text in ${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}`;
      case 'dom_change':
        return 'Page content changed';
      default:
        return `Action: ${type}`;
    }
  }
}



