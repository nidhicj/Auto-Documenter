import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OAuth2Strategy } from './oauth2.strategy';

// Only include OAuth2Strategy if OAuth2 is configured
const isOAuth2Configured = () => {
  return !!(
    process.env.OAUTH2_AUTHORIZATION_URL &&
    process.env.OAUTH2_TOKEN_URL &&
    process.env.OAUTH2_CLIENT_ID &&
    process.env.OAUTH2_CLIENT_SECRET
  );
};

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: (() => {
        const secret = process.env.JWT_SECRET || 'dev-secret';
        console.log('[AuthModule] JWT_SECRET configured:', secret ? `${secret.substring(0, 10)}...` : 'MISSING (using default)');
        return secret;
      })(),
      // No expiration for development - tokens never expire
      // signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    ...(isOAuth2Configured() ? [OAuth2Strategy] : []),
  ],
  exports: [AuthService],
})
export class AuthModule {}



