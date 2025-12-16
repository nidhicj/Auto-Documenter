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
      url: (() => {
        // Check if DATABASE_URL is set
        if (process.env.DATABASE_URL) {
          // Validate that password exists in the URL
          const url = process.env.DATABASE_URL;
          if (!url.includes('@') || url.split('@')[0].split(':').length < 3) {
            console.error('[TypeORM] DATABASE_URL is malformed. Expected format: postgresql://user:password@host:port/db');
          }
          return url;
        }
        
        // Fallback to individual env vars if DATABASE_URL is not set
        const host = process.env.POSTGRES_HOST || 'localhost';
        const port = parseInt(process.env.POSTGRES_PORT || '5432');
        const username = process.env.POSTGRES_USER || 'postgres';
        const password = process.env.POSTGRES_PASSWORD;
        const database = process.env.POSTGRES_DB || 'autodoc';
        
        if (!password || password === '') {
          console.error('[TypeORM] POSTGRES_PASSWORD is not set or empty!');
          console.error('[TypeORM] Please set DATABASE_URL or POSTGRES_PASSWORD environment variable.');
          throw new Error('Database password is required. Set DATABASE_URL or POSTGRES_PASSWORD environment variable.');
        }
        
        return `postgresql://${username}:${password}@${host}:${port}/${database}`;
      })(),
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

