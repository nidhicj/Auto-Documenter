import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { GuidesModule } from '../guides/guides.module';

@Module({
  imports: [GuidesModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}



