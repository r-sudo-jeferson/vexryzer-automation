import type { Config, Context } from '@netlify/functions';
import {
  handleAskAiCorrection,
  handleAskAiSessionStart,
  handleAskAiTurn,
  type AskAiHttpDependencies,
} from '../../src/server/session/ask-ai-http.ts';
import { createNetlifyAskAiDependencies } from '../../src/server/netlify/ask-ai-netlify-runtime.ts';

function jsonFailure(code: string, status: number, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify({ ok: false, code }), { status, headers });
}

function dependenciesFor(context: Context): Readonly<AskAiHttpDependencies> | null {
  try {
    return createNetlifyAskAiDependencies({ published: context.deploy.published });
  } catch {
    return null;
  }
}

export default async (request: Request, context: Context): Promise<Response> => {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return jsonFailure('INVALID_REQUEST_URL', 400);
  }

  if (
    pathname !== '/api/ask-ai'
    && pathname !== '/api/ask-ai/session'
    && pathname !== '/api/ask-ai/correction'
  ) {
    return jsonFailure('NOT_FOUND', 404);
  }

  const dependencies = dependenciesFor(context);
  if (dependencies === null) {
    return jsonFailure('STORE_UNAVAILABLE', 503, { 'Retry-After': '2' });
  }

  if (pathname === '/api/ask-ai/session') {
    return handleAskAiSessionStart(request, dependencies);
  }
  if (pathname === '/api/ask-ai/correction') {
    return handleAskAiCorrection(request, dependencies);
  }
  return handleAskAiTurn(request, dependencies);
};

export const config: Config = {
  path: [
    '/api/ask-ai',
    '/api/ask-ai/session',
    '/api/ask-ai/correction',
  ],
};
