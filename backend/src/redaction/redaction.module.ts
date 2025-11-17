import { Module } from '@nestjs/common';
import { RedactionController } from './redaction.controller';
import { RedactionService } from './redaction.service';
import { GuidesModule } from '../guides/guides.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [GuidesModule, HttpModule],
  controllers: [RedactionController],
  providers: [RedactionService],
})
export class RedactionModule {}



