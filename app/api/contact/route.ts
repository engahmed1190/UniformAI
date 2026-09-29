import { openCase } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    return Response.json(await openCase(body), { status: 201 });
  } catch (error) {
    return salesFailure(error);
  }
}
