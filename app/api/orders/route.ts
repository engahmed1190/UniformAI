import { listOrders } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await listOrders());
  } catch (error) {
    return salesFailure(error);
  }
}
