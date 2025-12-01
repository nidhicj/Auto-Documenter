import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    return this.authService.login(user);
  }

  @Get('oauth2')
  @UseGuards(AuthGuard('oauth2'))
  async oauth2() {
    // OAuth2 redirect handled by strategy
  }

  @Get('oauth2/callback')
  @UseGuards(AuthGuard('oauth2'))
  async oauth2Callback(@Request() req: any) {
    return this.authService.login(req.user);
  }
}




