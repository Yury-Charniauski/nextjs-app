import { AuthRequest } from '@/modules/rbac/types/rbac.types.js';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();

    this.cls.set('actorId', req.user?.id);
    this.cls.set('method', req.method);
    this.cls.set('uri', req.originalUrl);

    return next.handle();
  }
}
