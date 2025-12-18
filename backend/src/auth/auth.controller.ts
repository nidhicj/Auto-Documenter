import { Controller, Post, Body, UseGuards, Request, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { AnyAuthGuard } from './any-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // FRONTEND login (cookie-based)
  @Post('login')
  async loginWeb(
    @Body() loginDto: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    const { access_token, user: safeUser } = await this.authService.login(user);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true in prod (https)
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { user: safeUser };
  }

  // EXTENSION login (token-based)
  @Post('token')
  async token(@Body() loginDto: { email: string; password: string }) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    return this.authService.login(user); // returns {access_token, user}
  }

  // Useful for frontend session check
  @UseGuards(AnyAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return { user: req.user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return { ok: true };
  }

  @Get('oauth2')
  @UseGuards(AuthGuard('oauth2'))
  async oauth2() {}

  @Get('oauth2/callback')
  @UseGuards(AuthGuard('oauth2'))
  async oauth2Callback(@Request() req: any) {
    // If you want OAuth2 to behave like web login:
    // set cookie here too (same as loginWeb) — optional for now.
    // return this.authService.login(req.user);
    const { password, ...safeUser } = req.user ?? {};
    return { user: safeUser };
  }
}
