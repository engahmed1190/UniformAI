import { listInvoices } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function GET() {
  try {
    return Response.json(await listInvoices());
  } catch (error) {
    return salesFailure(error);
  }
}
