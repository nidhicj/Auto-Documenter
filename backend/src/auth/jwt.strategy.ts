import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    console.log('[JwtStrategy] Initialized with secret:', secret ? `${secret.substring(0, 10)}...` : 'MISSING');
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Validate expiration normally
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('[JwtStrategy] Validating payload:', {
      hasSub: !!payload.sub,
      hasEmail: !!payload.email,
      hasOrgId: !!payload.organizationId,
      payloadKeys: Object.keys(payload),
    });
    
    if (!payload.sub) {
      console.error('[JwtStrategy] Invalid payload: missing sub');
      throw new UnauthorizedException('Invalid token payload');
    }
    
    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
    };
  }
}



