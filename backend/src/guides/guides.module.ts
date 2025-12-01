import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';
import { Guide } from './entities/guide.entity';
import { Step } from './entities/step.entity';
import { BullModule } from '@nestjs/bull';
import { StepProcessor } from './step.processor';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guide, Step]),
    BullModule.registerQueue({
      name: 'step-processing',
    }),
    MediaModule,
    HttpModule,
  ],
  controllers: [GuidesController],
  providers: [GuidesService, StepProcessor],
  exports: [GuidesService],
})
export class GuidesModule {}




