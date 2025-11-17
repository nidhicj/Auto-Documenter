import { Module } from '@nestjs/common';
import { EmbedController } from './embed.controller';
import { GuidesModule } from '../guides/guides.module';

@Module({
  imports: [GuidesModule],
  controllers: [EmbedController],
})
export class EmbedModule {}



