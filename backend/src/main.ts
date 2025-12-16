import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser to configure manually
  });

  // Increase body size limit for file uploads (screenshots can be large)
  // Default is 100kb, we need at least 10MB for screenshots
  const express = require('express');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Enable CORS
  // Allow both frontend and Chrome extension origins
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    // Chrome extensions use chrome-extension:// protocol
    /^chrome-extension:\/\/.*$/,
  ];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or Chrome extensions in some cases)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin matches allowed patterns
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Allow comprehensive headers for file uploads (multipart/form-data needs Content-Type with boundary)
    // Browser automatically sets Content-Type with boundary for FormData, so we need to allow it
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Content-Length',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    // Increase max age for preflight requests
    maxAge: 86400, // 24 hours
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
}

bootstrap();



