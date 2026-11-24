import { getRequestEnv } from '../../../shared/db/request';
import { operationSchema, runOperation } from './operations';

// Setup writes for the E2E suite only: it answers only when E2E_HARNESS=1 and APP_ENV is
// exactly local or test (both set by playwright.config.ts alone; an unset or mistyped APP_ENV
// answers 404); otherwise it is a 404 like any other missing route. The body is one named
// operation (operations.ts), never SQL (ADR-0041). A web page cannot reach it: the body must be
// application/json (a no-cors cross-site form or fetch cannot send that without a preflight) and
// an Origin header, when present, must be this server's own.
export async function POST(request: Request): Promise<Response> {
  if (process.env.E2E_HARNESS !== '1' || !['local', 'test'].includes(process.env.APP_ENV ?? '')) {
    return new Response(null, { status: 404 });
  }
  const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json') return new Response(null, { status: 415 });
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 422 });
  }
  const parsed = operationSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid operation' }, { status: 422 });
  const result = await runOperation(await getRequestEnv(), parsed.data);
  // Only seedSession answers with data (the session cookie); the others answer { ok: true }.
  return Response.json(parsed.data.op === 'seedSession' ? result : { ok: true });
}
