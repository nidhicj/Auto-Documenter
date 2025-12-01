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
  SetMetadata,
} from '@nestjs/common';
import { GuidesService } from './guides.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Decorator to mark endpoints as public
const Public = () => SetMetadata('isPublic', true);

@Controller('guides')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  /**
   * Create guide from workflow
   * Public endpoint for extension to submit workflows
   */
  @Post('workflows')
  @Public()
  async createFromWorkflow(@Body() workflow: any, @Request() req: any) {
    // Use default values if no user is authenticated (extension submission)
    const userId = req.user?.userId || 'extension-user';
    const organizationId = req.user?.organizationId || 'default-org';
    
    return this.guidesService.createFromWorkflow(
      workflow,
      userId,
      organizationId,
    );
  }

  /**
   * Get all guides
   * Public for development - allows fetching extension-created guides
   */
  @Get()
  @Public()
  async findAll(@Request() req: any) {
    // For development: allow fetching guides without auth (for extension-created guides)
    const organizationId = req.user?.organizationId || 'default-org';
    return this.guidesService.findAll(organizationId);
  }

  /**
   * Get guide by ID
   * Public for development
   */
  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string, @Request() req: any) {
    // For development: allow fetching guides without auth
    const organizationId = req.user?.organizationId || 'default-org';
    return this.guidesService.findOne(id, organizationId);
  }

  /**
   * Update guide
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req: any,
  ) {
    return this.guidesService.update(id, req.user.organizationId, updateData);
  }

  /**
   * Delete guide
   * Public for development
   */
  @Delete(':id')
  @Public()
  async remove(@Param('id') id: string, @Request() req: any) {
    // For development: allow deleting guides without auth
    const organizationId = req.user?.organizationId || 'default-org';
    await this.guidesService.remove(id, organizationId);
    return { success: true };
  }

  /**
   * Reorder steps
   */
  @Post(':id/steps/reorder')
  @UseGuards(JwtAuthGuard)
  async reorderSteps(@Param('id') id: string, @Body() body: { stepIds: string[] }) {
    await this.guidesService.reorderSteps(id, body.stepIds);
    return { success: true };
  }

  /**
   * Update step
   */
  @Patch('steps/:stepId')
  @UseGuards(JwtAuthGuard)
  async updateStep(@Param('stepId') stepId: string, @Body() updateData: any) {
    return this.guidesService.updateStep(stepId, updateData);
  }

  /**
   * Delete step
   */
  @Delete('steps/:stepId')
  @UseGuards(JwtAuthGuard)
  async deleteStep(@Param('stepId') stepId: string) {
    await this.guidesService.deleteStep(stepId);
    return { success: true };
  }
}




