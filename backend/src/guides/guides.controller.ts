import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { GuidesService } from './guides.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('guides')
@UseGuards(JwtAuthGuard)
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  /**
   * Create guide from workflow
   */
  @Post('workflows')
  async createFromWorkflow(@Body() workflow: any, @Request() req: any) {
    return this.guidesService.createFromWorkflow(
      workflow,
      req.user.userId,
      req.user.organizationId,
    );
  }

  /**
   * Get all guides
   */
  @Get()
  async findAll(@Request() req: any) {
    return this.guidesService.findAll(req.user.organizationId);
  }

  /**
   * Get guide by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.guidesService.findOne(id, req.user.organizationId);
  }

  /**
   * Update guide
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req: any,
  ) {
    return this.guidesService.update(id, req.user.organizationId, updateData);
  }

  /**
   * Delete guide
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.guidesService.remove(id, req.user.organizationId);
    return { success: true };
  }

  /**
   * Reorder steps
   */
  @Post(':id/steps/reorder')
  async reorderSteps(@Param('id') id: string, @Body() body: { stepIds: string[] }) {
    await this.guidesService.reorderSteps(id, body.stepIds);
    return { success: true };
  }

  /**
   * Update step
   */
  @Patch('steps/:stepId')
  async updateStep(@Param('stepId') stepId: string, @Body() updateData: any) {
    return this.guidesService.updateStep(stepId, updateData);
  }

  /**
   * Delete step
   */
  @Delete('steps/:stepId')
  async deleteStep(@Param('stepId') stepId: string) {
    await this.guidesService.deleteStep(stepId);
    return { success: true };
  }
}



