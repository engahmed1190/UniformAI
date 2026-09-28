import { approveQuote } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function POST(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    return Response.json(await approveQuote(name));
  } catch (error) {
    return salesFailure(error);
  }
}
