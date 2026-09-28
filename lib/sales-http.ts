import { ErpError } from './erp';
import { SalesError } from './sales';

/** One mapping for every sales route. The body never carries ERPNext's
 *  message or address; those stay in the server log. */
export function salesFailure(error: unknown): Response {
  if (error instanceof SalesError) return Response.json({ error: error.message }, { status: error.status });
  console.error('sales route failed', error);
  if (error instanceof ErpError) {
    const missing = /^Missing ERP_/.test(error.message);
    return missing
      ? Response.json({ error: 'not_configured' }, { status: 500 })
      : Response.json({ error: 'unreachable' }, { status: 502 });
  }
  return Response.json({ error: 'failed' }, { status: 500 });
}
