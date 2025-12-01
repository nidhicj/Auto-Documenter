import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Step } from './entities/step.entity';
import { MediaService } from '../media/media.service';

@Processor('step-processing')
@Injectable()
export class StepProcessor {
  private readonly aiServiceUrl: string;

  constructor(
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    private mediaService: MediaService,
    private httpService: HttpService,
  ) {
    // Use internal Docker service name, not localhost
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
    console.log('[StepProcessor] process.env.AI_SERVICE_URL:', process.env.AI_SERVICE_URL);
    console.log('[StepProcessor] AI Service URL:', this.aiServiceUrl);
  }

  @Process('process-workflow')
  async handleWorkflowProcessing(job: Job<{ guideId: string; workflow: any }>) {
    const { guideId, workflow } = job.data;

    console.log('[StepProcessor] Processing workflow:', {
      guideId,
      eventsCount: workflow.events?.length || 0,
      screenshotsCount: workflow.screenshots?.length || 0,
    });

    // Process events to create steps
    // If screenshots are available, use them; otherwise create steps from events
    const events = workflow.events || [];

    if (events.length === 0) {
      console.warn('[StepProcessor] No events found in workflow');
      return { success: true, guideId, stepsCreated: 0 };
    }

    let stepIndex = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Only create steps for significant events (clicks, navigation, dom_change)
      if (!['click', 'navigation', 'dom_change', 'input'].includes(event.type)) {
        continue;
      }

      // Try to find corresponding screenshot if available
      let screenshotUri = null;
      if (workflow.screenshots && workflow.screenshots.length > 0) {
        const matchingScreenshot = workflow.screenshots.find(
          (s: any) => s.stepIndex === stepIndex || s.domEvent?.timestamp === event.timestamp
        );

        if (matchingScreenshot && matchingScreenshot.screenshotBase64) {
          try {
            // Convert base64 to buffer
            const base64Data = matchingScreenshot.screenshotBase64.split(',')[1] || matchingScreenshot.screenshotBase64;
            const buffer = Buffer.from(base64Data, 'base64');

            // Process and upload
            const key = `screenshots/${workflow.id}/${stepIndex}-${event.timestamp || Date.now()}.png`;
            const uploadedKey = await this.mediaService.processScreenshot(key, buffer);
            // Get the public URL for the screenshot
            screenshotUri = await this.mediaService.getMediaUrl(uploadedKey);
            console.log('[StepProcessor] Uploaded screenshot:', screenshotUri);
          } catch (error) {
            console.error('[StepProcessor] Failed to upload screenshot:', error);
          }
        }
      }

      // Generate initial description from event
      const initialDescription = this.generateDescription(event);

      // Create step with initial description
      const step = this.stepRepository.create({
        guideId,
        stepIndex,
        description: initialDescription,
        screenshotUri,
        domEvent: event,
        timestamp: event.timestamp || Date.now(),
      });

      await this.stepRepository.save(step);
      console.log('[StepProcessor] Created step:', stepIndex, initialDescription);

      // Enhance description using AI (async, don't block)
      // Wait a bit to ensure step is saved first
      setTimeout(() => {
        this.enhanceStepDescription(step, event, screenshotUri).catch(error => {
          console.error('[StepProcessor] Failed to enhance step description:', error);
        });
      }, 500);

      stepIndex++;
    }

    console.log('[StepProcessor] Completed processing:', { guideId, stepsCreated: stepIndex });
    return { success: true, guideId, stepsCreated: stepIndex };
  }

  /**
   * Generate basic description from DOM event
   */
  private generateDescription(event: any): string {
    const { type, target } = event;

    switch (type) {
      case 'click':
        return `Click on ${target?.tagName?.toLowerCase() || 'element'}${target?.id ? `#${target.id}` : ''}${target?.className ? `.${target.className.split(' ')[0]}` : ''}`;
      case 'navigation':
        return `Navigate to ${event.url || 'page'}`;
      case 'input':
        return `Enter text in ${target?.tagName?.toLowerCase() || 'field'}${target?.id ? `#${target.id}` : ''}`;
      case 'dom_change':
        return 'Page content changed';
      default:
        return `Action: ${type}`;
    }
  }

  /**
   * Enhance step description using AI
   */
  private async enhanceStepDescription(step: Step, event: any, screenshotUri: string | null): Promise<void> {
    try {
      // Build context for AI with more details
      const target = event.target || {};
      const context = {
        stepIndex: step.stepIndex,
        eventType: event.type,
        target: {
          tagName: target.tagName,
          id: target.id,
          className: target.className,
          selector: target.selector,
          textContent: target.textContent?.substring(0, 100), // First 100 chars
        },
        url: event.url,
        selector: target.selector,
        screenshotAvailable: !!screenshotUri,
        metadata: event.metadata || {},
      };

      console.log('[StepProcessor] 🤖 Calling Gemini AI to enhance step description');
      console.log('[StepProcessor] 📝 Current description:', step.description);
      console.log('[StepProcessor] 📊 Context:', JSON.stringify(context, null, 2));

      // Call AI service to enhance description
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/steps/enhance`,
          {
            currentDescription: step.description,
            context,
          },
          {
            timeout: 10000, // 10 second timeout
          }
        )
      );

      if (response.data && response.data.enhancedDescription) {
        // Update step with enhanced description
        console.log('[StepProcessor] ✅ Gemini AI response received');
        console.log('[StepProcessor] 📝 Enhanced description:', response.data.enhancedDescription);
        step.description = response.data.enhancedDescription;
        await this.stepRepository.save(step);
        console.log('[StepProcessor] 💾 Saved enhanced step description for step:', step.stepIndex);
      } else {
        console.warn('[StepProcessor] ⚠️ Gemini AI returned empty response');
      }
    } catch (error: any) {
      // Don't throw - if AI enhancement fails, keep the basic description
      console.error('[StepProcessor] ❌ Gemini AI enhancement failed:', error.message);
      console.warn('[StepProcessor] Keeping basic description:', step.description);
    }
  }
}




