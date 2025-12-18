import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(user: any) {
    const payload = {
      sub: user.userId,
      email: user.email,
      organizationId: user.organizationId,
    };

    const token = this.jwtService.sign(payload);
    // console.log('[AuthService] Generated token (first 50 chars):', token.substring(0, 50) + '...');

    return {
      access_token: token,
      user: {
        userId: user.userId,
        email: user.email,
        organizationId: user.organizationId,
      },
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    // Implement user validation logic
    // For now, return mock user
    return {
      userId: 'user-123',
      email,
      organizationId: 'org-123',
    };
  }
}



