import { Injectable } from '@nestjs/common';
import { GuidesService } from '../guides/guides.service';
import * as puppeteer from 'puppeteer';

@Injectable()
export class ExportService {
  constructor(private readonly guidesService: GuidesService) {}

  /**
   * Export guide as PDF
   */
  async exportPDF(guideId: string, organizationId: string): Promise<Buffer> {
    const guide = await this.guidesService.findOne(guideId, organizationId);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const html = this.generateHTML(guide);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });

    await browser.close();
    return Buffer.from(pdf);
  }

  /**
   * Export guide as HTML
   */
  async exportHTML(guideId: string, organizationId: string): Promise<string> {
    const guide = await this.guidesService.findOne(guideId, organizationId);
    return this.generateHTML(guide);
  }

  /**
   * Export guide as Markdown
   */
  async exportMarkdown(guideId: string, organizationId: string): Promise<string> {
    const guide = await this.guidesService.findOne(guideId, organizationId);

    let markdown = `# ${guide.title}\n\n`;
    if (guide.description) {
      markdown += `${guide.description}\n\n`;
    }

    markdown += `---\n\n`;

    for (const step of guide.steps.sort((a, b) => a.stepIndex - b.stepIndex)) {
      markdown += `## Step ${step.stepIndex + 1}\n\n`;
      markdown += `${step.description}\n\n`;
      if (step.screenshotUri) {
        markdown += `![Screenshot](${step.screenshotUri})\n\n`;
      }
      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Generate HTML from guide
   */
  private generateHTML(guide: any): string {
    const steps = guide.steps.sort((a: any, b: any) => a.stepIndex - b.stepIndex);

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${guide.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .step { margin: 30px 0; padding: 20px; border-left: 4px solid #4CAF50; background: #f9f9f9; }
    .step-number { font-size: 24px; font-weight: bold; color: #4CAF50; }
    .step-description { margin: 10px 0; }
    .step-screenshot { max-width: 100%; margin: 10px 0; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${guide.title}</h1>
  ${guide.description ? `<p>${guide.description}</p>` : ''}
`;

    steps.forEach((step: any) => {
      html += `
  <div class="step">
    <div class="step-number">Step ${step.stepIndex + 1}</div>
    <div class="step-description">${step.description}</div>
    ${step.screenshotUri ? `<img src="${step.screenshotUri}" alt="Screenshot" class="step-screenshot" />` : ''}
  </div>
`;
    });

    html += `
</body>
</html>
`;

    return html;
  }
}




