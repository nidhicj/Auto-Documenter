import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    
    console.log('[JwtAuthGuard] Request received:', {
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? authHeader.substring(0, 50) + '...' : 'MISSING',
      method: request.method,
      url: request.url,
      headers: Object.keys(request.headers || {}),
    });
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers?.authorization;
      
      console.error('[JwtAuthGuard] Authentication failed:', {
        error: err?.message || err,
        info: info?.message || info,
        infoName: info?.name,
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeader ? authHeader.substring(0, 50) + '...' : 'MISSING',
        url: request.url,
        method: request.method,
      });
      
      // Log more details about the error
      if (info) {
        console.error('[JwtAuthGuard] Error details:', {
          name: info.name,
          message: info.message,
          stack: info.stack,
        });
      }
    } else {
      console.log('[JwtAuthGuard] Authentication successful:', {
        userId: user?.userId,
        email: user?.email,
        url: context.switchToHttp().getRequest().url,
      });
    }
    return super.handleRequest(err, user, info, context);
  }
}



