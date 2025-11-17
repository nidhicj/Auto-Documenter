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

    // Queue step processing job
    await this.stepQueue.add('process-workflow', {
      guideId: savedGuide.id,
      workflow,
    });

    return savedGuide;
  }

  /**
   * Get all guides for organization
   */
  async findAll(organizationId: string): Promise<Guide[]> {
    return this.guideRepository.find({
      where: { organizationId },
      relations: ['steps'],
      order: { createdAt: 'DESC' },
    });
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



