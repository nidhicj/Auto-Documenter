import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Guide } from './entities/guide.entity';
import { Step } from './entities/step.entity';

@Injectable()
export class GuidesService {
  constructor(
    @InjectRepository(Guide)
    private guideRepository: Repository<Guide>,
    @InjectRepository(Step)
    private stepRepository: Repository<Step>,
    @InjectQueue('step-processing')
    private stepQueue: Queue,
  ) {}

  /**
   * Create guide from workflow event
   */
  async createFromWorkflow(workflow: any, userId: string, organizationId: string): Promise<Guide> {
    console.log('[GuidesService] Creating guide from workflow:', {
      title: workflow.title,
      url: workflow.url,
      eventsCount: workflow.events?.length || 0,
      screenshotsCount: workflow.screenshots?.length || 0,
    });

    const guide = this.guideRepository.create({
      title: workflow.title || 'Untitled Guide',
      description: `Workflow captured from ${workflow.url}`,
      userId,
      organizationId,
      metadata: {
        url: workflow.url,
        startTime: workflow.startTime,
        endTime: workflow.endTime,
      },
    });

    const savedGuide = await this.guideRepository.save(guide);
    console.log('[GuidesService] Guide created:', savedGuide.id);

    // Queue step processing job
    // Include events in workflow for step processing (screenshots are uploaded separately)
    const workflowForProcessing = {
      ...workflow,
      events: workflow.events || [],
      screenshots: workflow.screenshots || [], // Include if available, but processor can work without them
    };
    
    await this.stepQueue.add('process-workflow', {
      guideId: savedGuide.id,
      workflow: workflowForProcessing,
    });
    console.log('[GuidesService] Step processing job queued with', workflowForProcessing.events.length, 'events');

    return savedGuide;
  }

  /**
   * Get all guides for organization
   */
  async findAll(organizationId: string): Promise<Guide[]> {
    console.log('[GuidesService] Finding all guides for org:', organizationId);
    const guides = await this.guideRepository.find({
      where: { organizationId },
      relations: ['steps'],
      order: { createdAt: 'DESC' },
    });
    console.log('[GuidesService] Found guides:', guides.length);
    return guides;
  }

  /**
   * Get guide by ID
   */
  async findOne(id: string, organizationId: string): Promise<Guide> {
    const guide = await this.guideRepository.findOne({
      where: { id, organizationId },
      relations: ['steps'],
    });

    if (!guide) {
      throw new NotFoundException(`Guide with ID ${id} not found`);
    }

    return guide;
  }

  /**
   * Update guide
   */
  async update(id: string, organizationId: string, updateData: Partial<Guide>): Promise<Guide> {
    const guide = await this.findOne(id, organizationId);
    Object.assign(guide, updateData);
    return this.guideRepository.save(guide);
  }

  /**
   * Delete guide
   */
  async remove(id: string, organizationId: string): Promise<void> {
    const guide = await this.findOne(id, organizationId);
    await this.guideRepository.remove(guide);
  }

  /**
   * Reorder steps
   */
  async reorderSteps(guideId: string, stepIds: string[]): Promise<void> {
    const steps = await this.stepRepository.find({
      where: { guideId },
    });

    for (let i = 0; i < stepIds.length; i++) {
      const step = steps.find((s) => s.id === stepIds[i]);
      if (step) {
        step.stepIndex = i;
        await this.stepRepository.save(step);
      }
    }
  }

  /**
   * Update step
   */
  async updateStep(stepId: string, updateData: Partial<Step>): Promise<Step> {
    const step = await this.stepRepository.findOne({ where: { id: stepId } });
    if (!step) {
      throw new NotFoundException(`Step with ID ${stepId} not found`);
    }

    Object.assign(step, updateData);
    return this.stepRepository.save(step);
  }

  /**
   * Delete step
   */
  async deleteStep(stepId: string): Promise<void> {
    const step = await this.stepRepository.findOne({ where: { id: stepId } });
    if (!step) {
      throw new NotFoundException(`Step with ID ${stepId} not found`);
    }

    await this.stepRepository.remove(step);
  }
}




