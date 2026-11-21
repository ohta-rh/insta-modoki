import { getRequestEnv } from '../../../shared/db/request';
import { operationSchema, runOperation } from './operations';

// Setup writes for the E2E suite only: it answers only when E2E_HARNESS=1 (set by
// playwright.config.ts alone) and never in production; otherwise it is a 404 like any other
// missing route. The body is one named operation (operations.ts), never SQL (ADR-0041).
export async function POST(request: Request): Promise<Response> {
  if (process.env.E2E_HARNESS !== '1' || process.env.APP_ENV === 'production') {
    return new Response(null, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 422 });
  }
  const parsed = operationSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid operation' }, { status: 422 });
  await runOperation(await getRequestEnv(), parsed.data);
  return Response.json({ ok: true });
}
