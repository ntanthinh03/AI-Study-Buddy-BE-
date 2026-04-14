import type { Request } from 'express';
import type { AuthUser } from './auth-user.type';

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
