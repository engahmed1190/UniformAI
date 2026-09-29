import { quoteDetail } from '@/lib/sales';
import { salesFailure } from '@/lib/sales-http';

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    return Response.json(await quoteDetail(name));
  } catch (error) {
    return salesFailure(error);
  }
}
