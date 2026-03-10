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

  private findPreviousEvent(workflow: any, screenshot: any): any | null {
    const events: any[] = Array.isArray(workflow?.events) ? workflow.events : [];
    if (!events.length) return null;

    const captureTs =
      typeof screenshot?.domEvent?.timestamp === 'number'
        ? screenshot.domEvent.timestamp
        : (typeof screenshot?.timestamp === 'number' ? screenshot.timestamp : null);

    if (captureTs === null) return null;

    let best: any | null = null;

    for (const e of events) {
      const ts = e?.timestamp;
      if (typeof ts !== 'number') continue;

      // Strictly BEFORE the capture event
      if (ts >= captureTs) continue;

      // Skip other capture events; we want the user action
      if (e?.type === 'capture') continue;

      if (!best || ts > best.timestamp) best = e;
    }

    return best;
  }

  @Process('process-workflow')
  async handleWorkflowProcessing(job: Job<{ guideId: string; workflow: any }>) {
    const { guideId, workflow } = job.data;

    // Process each screenshot and create steps
    const screenshots = Array.isArray(workflow?.screenshots) ? workflow.screenshots : [];
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      const event = screenshot.domEvent;

      // Use screenshot URL if already uploaded to MinIO, otherwise upload from base64
      let screenshotUri = null;
      if (screenshot.screenshotUrl) {
        // Already uploaded to MinIO, use the URL
        screenshotUri = screenshot.screenshotUrl;
      } else if (screenshot.screenshotKey) {
        // Has MinIO key, construct URL
        screenshotUri = await this.mediaService.getMediaUrl(screenshot.screenshotKey);
      } else if (typeof screenshot.screenshotBase64 === 'string' && screenshot.screenshotBase64.length) {
        const raw = screenshot.screenshotBase64;
        const base64Data = raw.includes(',') ? raw.split(',')[1] : raw;
        const buffer = Buffer.from(base64Data, 'base64');

        // Process and upload
        const key = `screenshots/${workflow.id}/${i}-${screenshot.timestamp}.png`;
        screenshotUri = await this.mediaService.processScreenshot(key, buffer);
      }
      
      // const previousEvent = this.findPreviousEvent(workflow, screenshot);
      const description = this.generateDescription(event);

      // // Generate description (will be enhanced by AI service)
      // const description = this.generateDescription(event);
      
      if (!screenshotUri) {
        console.warn('[StepProcessor] Skipping step: screenshotUri missing', {
          guideId,
          workflowId: workflow?.id,
          i,
          ts: screenshot?.timestamp,
          hasUrl: !!screenshot?.screenshotUrl,
          hasKey: !!screenshot?.screenshotKey,
          hasBase64: !!screenshot?.screenshotBase64,
        });
        continue;
      }


      // Create step
      const step = this.stepRepository.create({
        guideId,
        stepIndex: typeof screenshot.stepIndex === 'number' ? screenshot.stepIndex : i + 1,
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
   * Generate human-ish description from DOM event.
   * Note: We keep this deterministic + privacy-safe. AI can enhance later.
   */
  private generateDescription(event: any, context?: { previousEvent?: any }): string {
    const type = event?.type ?? 'unknown';

    switch (type) {
      
      case 'click': {
        const t = this.describeTarget(event?.target);
        // return `Click ${t}`;
        return `Click ${t}.`;
      }

      case 'input': {
        const t = this.describeTarget(event?.target);
        const valueHint = this.describeInputValue(event);
        // valueHint is optional; if we don’t know the value, we don’t invent it
        // return valueHint ? `Enter ${valueHint} in ${t}` : `Enter text in ${t}`;
        return valueHint ? `Enter ${valueHint} in ${t}.` : `Enter text in ${t}.`;
      }

      case 'navigation': {
        const url = this.describeUrl(event?.url);
        return url ? `Go to ${url}` : `Navigate to a new page.`;
      }

      case 'scroll': {
        const scrollHint = this.describeScroll(event);
        return scrollHint ? `Scroll ${scrollHint}` : `Scroll the page.`;
      }

      case 'dom_change': {
        const changeHint = this.describeDomChange(event);
        return changeHint ? `Page updates: ${changeHint}` : `Wait for the page to update.`;
      }

      case 'capture': {
        return `Take a screenshot.`;
      }
      default:
        return `Action: ${type}`;
    }
  }

  private lowercaseFirstLetter(s: string): string {
    if (!s) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }


  /**
   * Prefer human-meaningful labels over CSS-y identifiers.
   * Uses textContent and selector if present.
   */
  private describeTarget(target: any): string {
    if (!target) return 'the element';

    const text = target.textContent ? String(target.textContent).trim().replace(/\s+/g, ' ') : '';
    const textShort = text.length > 50 ? text.slice(0, 50) + '…' : text;

    // Best: visible label
    if (textShort) return `"${textShort}"`;

    // Next: selector if it exists and isn't insane
    const selector = target.selector ? String(target.selector).trim() : '';
    if (selector && selector.length <= 80) return selector;

    // Fallback: tag/id/class
    const tag = target.tagName ? String(target.tagName).toLowerCase() : 'element';
    const id = target.id ? `#${target.id}` : '';
    const cls = target.className ? `.${String(target.className).trim().split(/\s+/)[0]}` : '';
    const fallback = `${tag}${id}${cls}`;

    return fallback === 'element' ? 'the element' : fallback;
  }


  private describeUrl(url?: string): string | null {
    if (!url) return null;
    try {
      const u = new URL(url);
      // Keep it readable: domain + path; drop query/hash to avoid noisy steps
      return `${u.host}${u.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Privacy-safe: do NOT print raw user input unless you explicitly choose to.
   * Right now: only prints a generic hint if metadata has something like "fieldName".
   */
  private describeInputValue(event: any): string | null {
    // Unknown from current context whether you store typed values.
    // We intentionally avoid outputting raw values until you confirm privacy rules.
    const meta = event?.metadata;
    const fieldName = meta?.fieldName || meta?.name || meta?.label || meta?.placeholder;
    if (fieldName) return `"${String(fieldName)}"`;
    return null;
  }

  private describeScroll(event: any): string | null {
    const meta = event?.metadata || {};
    // Handle common scroll telemetry keys (best-effort; no guessing if absent)
    const direction =
      meta.direction ||
      (typeof meta.deltaY === 'number' ? (meta.deltaY > 0 ? 'down' : 'up') : null);

    const percent =
      typeof meta.scrollPercent === 'number'
        ? `${Math.round(meta.scrollPercent)}%`
        : null;

    const y =
      typeof meta.scrollY === 'number'
        ? `to Y=${Math.round(meta.scrollY)}`
        : null;

    // Prefer percent if available; otherwise direction + y if available
    if (percent) return `to ${percent}`;
    if (direction && y) return `${direction} ${y}`;
    if (direction) return direction;
    if (y) return y;

    return null;
  }

  private describeDomChange(event: any): string | null {
    const meta = event?.metadata || {};
    // Best-effort common mutation hints
    const kind = meta.mutationType || meta.type || meta.changeType;
    const summary = meta.summary || meta.description;
    if (summary) return String(summary);
    if (kind) return String(kind);
    return null;
  }

}