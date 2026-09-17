import { UserStatus } from "@/generated/prisma/enums.js";
import { TJwtServicePayload } from "@/modules/auth/types/jwt-service.js";
import { UserService } from '@/modules/users/user.service.js';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req.cookies?.access_token ?? null,
      ]),
      secretOrKey: accessSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: TJwtServicePayload) {
    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Unauthorized user');
    }

    const user = await this.userService.findOne(payload.sub);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Access is forbidden');
    }

    return { userId: user.id };
  }
}
