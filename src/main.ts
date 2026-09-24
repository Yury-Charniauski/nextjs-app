import 'dotenv/config';

import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.use(cookieParser());
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
