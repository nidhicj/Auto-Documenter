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
    return {
      access_token: this.jwtService.sign(payload),
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




