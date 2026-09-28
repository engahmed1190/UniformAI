import Anthropic from '@anthropic-ai/sdk';
import { ask, type HistoryTurn } from '@/lib/ask';
import { ping } from '@/lib/erp';
import type { AskEvent } from '@/lib/evidence';

type Body = { question?: unknown; history?: unknown; locale?: unknown };

function validHistory(value: unknown): value is HistoryTurn[] {
  return Array.isArray(value) && value.length <= 20 && value.every((turn) =>
    !!turn && typeof turn === 'object' &&
    ((turn as HistoryTurn).role === 'user' || (turn as HistoryTurn).role === 'assistant') &&
    typeof (turn as HistoryTurn).content === 'string' && (turn as HistoryTurn).content.length <= 2_000);
}

/** Are the live records reachable? Drives the dock's status dot. Says only
 *  yes or no: the customer's browser never learns what system is behind it. */
export async function GET() {
  return Response.json(await ping());
}

/** Streams newline-delimited JSON: a `step` event as each ERP read starts and
 *  finishes, then one `answer` or `error`. The dock shows the reads live, so
 *  the client watches the ERP being checked instead of a spinner. */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const history = body.history ?? [];
  const locale = body.locale;
  if (!question || question.length > 500 || !validHistory(history) ||
      (locale !== 'ar' && locale !== 'en')) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await ask(question, history, locale, (step) => send({ type: 'step', step }));
        send({ type: 'answer', answer: result.answer, sources: result.sources });
      } catch (error) {
        console.error('Assistant request failed:', error);
        // Missing ERP settings, or no Claude credentials at all (the SDK only
        // finds out when it sends the first request), or a rejected key.
        const missing = error instanceof Anthropic.AuthenticationError ||
          (error instanceof Error && /^Missing |Could not resolve authentication/.test(error.message));
        send({ type: 'error', error: missing ? 'not_configured' : 'unreachable' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
