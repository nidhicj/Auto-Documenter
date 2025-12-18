import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AnyAuthGuard implements CanActivate {
  private headerGuard = new (AuthGuard('jwt-header'))();
  private cookieGuard = new (AuthGuard('jwt-cookie'))();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const ok = await this.headerGuard.canActivate(context);
      if (ok) return true;
    } catch {}

    try {
      const ok = await this.cookieGuard.canActivate(context);
      if (ok) return true;
    } catch {}

    throw new UnauthorizedException('No auth token');
  }
}
