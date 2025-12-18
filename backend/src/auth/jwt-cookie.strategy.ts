import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

function cookieExtractor(req: Request): string | null {
  return (req as any)?.cookies?.access_token ?? null;
}

@Injectable()
export class JwtCookieStrategy extends PassportStrategy(Strategy, 'jwt-cookie') {
  constructor() {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    console.log('[JwtCookieStrategy] Initialized with secret:', secret ? `${secret.substring(0, 10)}...` : 'MISSING');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('[JwtCookieStrategy] Validating payload:', {
      hasSub: !!payload.sub,
      hasEmail: !!payload.email,
      hasOrgId: !!payload.organizationId,
      payloadKeys: Object.keys(payload),
    });

    if (!payload.sub) {
      console.error('[JwtCookieStrategy] Invalid payload: missing sub');
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
    };
  }
}
