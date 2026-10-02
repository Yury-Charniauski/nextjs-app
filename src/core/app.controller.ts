import { Controller, Get } from '@nestjs/common';
import { AppService } from '@/core/app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
}
