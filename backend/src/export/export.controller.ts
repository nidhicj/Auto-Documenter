import { Controller, Get, Param, Res, UseGuards, Request } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('pdf/:guideId')
  async exportPDF(
    @Param('guideId') guideId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdf = await this.exportService.exportPDF(guideId, req.user.organizationId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="guide-${guideId}.pdf"`);
    res.send(pdf);
  }

  @Get('html/:guideId')
  async exportHTML(
    @Param('guideId') guideId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const html = await this.exportService.exportHTML(guideId, req.user.organizationId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('markdown/:guideId')
  async exportMarkdown(
    @Param('guideId') guideId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const markdown = await this.exportService.exportMarkdown(guideId, req.user.organizationId);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="guide-${guideId}.md"`);
    res.send(markdown);
  }
}




