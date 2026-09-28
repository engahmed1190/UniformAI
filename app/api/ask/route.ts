import { AskInputError, run } from '@/lib/ask';
import { ErpError, ping } from '@/lib/erp';

/** Are the live records reachable? Drives the dock's status dot. Says only
 *  yes or no: the customer's browser never learns what system is behind it. */
export async function GET() {
  return Response.json(await ping());
}

/** One button, one read: `{ intent, params }` in, `{ rows, sources, step }`
 *  out. There is no free text and no customer field; the customer filter
 *  lives in the reads. Error bodies carry a code, never the ERP's own text. */
export async function POST(request: Request) {
  let body: { intent?: unknown; params?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    return Response.json(await run(body?.intent, body?.params ?? {}), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AskInputError) return Response.json({ error: 'invalid_request' }, { status: 400 });
    // assertErpConfigured throws an ErpError named "Missing ERP_...".
    if (error instanceof Error && /^Missing /.test(error.message)) {
      return Response.json({ error: 'not_configured' }, { status: 500 });
    }
    if (error instanceof ErpError) {
      console.error('Assistant read failed:', error.message);
      return Response.json({ error: 'unreachable' }, { status: 502 });
    }
    console.error('Assistant request failed:', error);
    return Response.json({ error: 'unreachable' }, { status: 502 });
  }
}
