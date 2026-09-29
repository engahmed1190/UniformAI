import { sendSizes } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  let body: { allocation?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    const { name } = await params;
    return Response.json(await sendSizes(name, body?.allocation), { status: 201 });
  } catch (error) {
    return salesFailure(error);
  }
}
