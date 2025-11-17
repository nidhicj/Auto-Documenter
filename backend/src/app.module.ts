import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from './auth/auth.module';
import { GuidesModule } from './guides/guides.module';
import { MediaModule } from './media/media.module';
import { ExportModule } from './export/export.module';
import { EmbedModule } from './embed/embed.module';
import { RedactionModule } from './redaction/redaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
        port: parseInt(process.env.REDIS_URL?.split(':')[2] || '6379'),
      },
    }),
    HttpModule,
    AuthModule,
    GuidesModule,
    MediaModule,
    ExportModule,
    EmbedModule,
    RedactionModule,
  ],
})
export class AppModule {}

