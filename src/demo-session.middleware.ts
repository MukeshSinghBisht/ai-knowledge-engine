import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    demoSessionId: string;
  }
}

const SESSION_COOKIE = 'aike_visitor';
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSessionId(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  const cookie = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const value = cookie?.slice(SESSION_COOKIE.length + 1);

  return value && UUID_PATTERN.test(value) ? value : undefined;
}

export const demoSessionMiddleware: RequestHandler = (
  request,
  response,
  next,
) => {
  const sessionId = getSessionId(request) ?? randomUUID();
  request.demoSessionId = sessionId;

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${secure}`,
  );

  next();
};

export type DemoSessionRequest = Request & { demoSessionId: string };
