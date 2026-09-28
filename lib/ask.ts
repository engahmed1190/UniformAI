import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { assertErpConfigured, ErpError, list, type ErpFilter } from './erp';
import type { Source, Step } from './evidence';

export type { Source } from './evidence';

export const DEMO_CUSTOMER = 'BrainWise Technology';

export type AskResult = { answer: string; sources: Source[]; steps: Step[] };
export type HistoryTurn = { role: 'user' | 'assistant'; content: string };
type Row = Record<string, unknown>;
type ToolResult = { rows: Row[]; sources: Source[] };

const ITEM_ALIASES: Record<string, string> = {
  'بولو': 'Polo', 'بنطال كارغو': 'Cargo Trouser', 'كارغو': 'Cargo Trouser',
  'قميص': 'Shirt', 'تشينو': 'Chino', 'بليزر': 'Blazer', 'جاكيت': 'Blazer',
};

/** Colour and size words as a buyer types them, mapped to the ERP attribute
 *  values. The model usually translates on its own; this catches the case
 *  where it passes the Arabic word straight through. */
const VALUE_ALIASES: Record<string, string> = {
  'كحلي': 'Navy', 'رملي': 'Sand', 'زيتي': 'Olive', 'أبيض': 'White',
  'فحمي': 'Charcoal', 'أزرق فاتح': 'Pale Blue', 'كاكي': 'Khaki',
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const num = (value: unknown) => value === undefined || value === null ? undefined : Number(value);
const canonical = (value: unknown, aliases: Record<string, string>) => {
  const raw = text(value);
  return Object.entries(aliases).find(([ar]) => raw.includes(ar))?.[1] ?? raw;
};

function source(doctype: string, name: unknown, fields: Omit<Source, 'doctype' | 'name' | 'readAt'>): Source {
  return { doctype, name: String(name), ...fields, readAt: new Date().toISOString() };
}

/** "Stores - UA" is ERPNext's warehouse name with the company suffix; the
 *  customer only needs "Stores". */
const warehouse = (value: unknown) => String(value ?? '').replace(/\s+-\s+[^-]+$/, '');

/** Frappe's list endpoint joins one child row per result and returns child
 * fields by their bare field name. Fold those SQL-shaped rows back into one
 * ERP record before giving them to the model. */
function groupJoined(joined: Row[], childFields: string[], childKey: string): Row[] {
  const grouped = new Map<string, Row>();
  for (const row of joined) {
    const name = String(row.name);
    const current = grouped.get(name) ?? { ...row, [childKey]: [] };
    const child = Object.fromEntries(childFields.map((field) => [field, row[field]]));
    if (Object.values(child).some((value) => value !== undefined && value !== null)) {
      (current[childKey] as Row[]).push(child);
    }
    for (const field of childFields) delete current[field];
    grouped.set(name, current);
  }
  return [...grouped.values()];
}

export async function findOrders(input: Row): Promise<ToolResult> {
  const id = text(input.order_id);
  const filters: ErpFilter[] = [['customer', '=', DEMO_CUSTOMER]];
  if (id) filters.push(['name', '=', id]);
  // The limit is on joined item lines, so it is set well above any order's
  // line count and the cut to whole orders happens after grouping.
  const joined = await list<Row>('Sales Order', {
    fields: ['name', 'status', 'transaction_date', 'delivery_date', 'per_delivered',
      'per_billed', 'grand_total', 'currency', 'items.item_name', 'items.qty'],
    filters,
    orderBy: 'transaction_date desc',
    limit: 200,
  });
  const rows = groupJoined(joined, ['item_name', 'qty'], 'items').slice(0, id ? 1 : 10);
  return {
    rows,
    sources: rows.map((row) => source('Sales Order', row.name, {
      title: String(row.name),
      detail: String(row.status ?? ''),
      date: text(row.delivery_date) || undefined,
    })),
  };
}

type ItemRow = Row & { name: string };

async function variantsFor(itemInput: unknown): Promise<ItemRow[]> {
  const wanted = canonical(itemInput, ITEM_ALIASES).toLowerCase();
  if (!wanted) return [];
  const templates = await list<ItemRow>('Item', {
    fields: ['name', 'item_name'],
    filters: [['has_variants', '=', 1]],
    limit: 100,
  });
  const template = templates.find((row) =>
    [row.name, row.item_name].some((v) => String(v ?? '').toLowerCase().includes(wanted)));
  if (!template) return [];
  const joined = await list<ItemRow>('Item', {
    fields: ['name', 'item_name', 'variant_of', 'attributes.attribute', 'attributes.attribute_value'],
    filters: [['variant_of', '=', template.name]],
    limit: 500,
  });
  return groupJoined(joined, ['attribute', 'attribute_value'], 'attributes') as ItemRow[];
}

function attributes(row: Row): Row[] {
  const value = row.attributes;
  if (Array.isArray(value)) return value.filter((v): v is Row => !!v && typeof v === 'object');
  return row.attribute && row.attribute_value
    ? [{ attribute: row.attribute, attribute_value: row.attribute_value }]
    : [];
}

export function variantMatches(row: Row, colour?: string, size?: string): boolean {
  const attrs = attributes(row);
  const has = (attribute: string, wanted?: string) => !wanted || attrs.some((a) =>
    // Seeded as "Uniform Colour" / "Uniform Size"; a plain "Colour" matches too.
    String(a.attribute ?? '').toLowerCase().endsWith(attribute) &&
    String(a.attribute_value ?? '').toLowerCase() === wanted.toLowerCase());
  return has('colour', colour) && has('size', size);
}

export async function checkStock(input: Row): Promise<ToolResult> {
  const colour = canonical(input.colour, VALUE_ALIASES) || undefined;
  const size = text(input.size).toUpperCase() || undefined;
  const variants = (await variantsFor(input.item)).filter((row) => variantMatches(row, colour, size));
  const stock = await Promise.all(variants.map(async (variant) => ({
    variant,
    bins: await list<Row>('Bin', {
      fields: ['name', 'item_code', 'warehouse', 'actual_qty', 'reserved_qty', 'projected_qty'],
      filters: [['item_code', '=', variant.name]],
      limit: 100,
    }),
  })));
  const rows: Row[] = stock.flatMap(({ variant, bins }) => bins.map((bin) => ({
    item: variant.name, item_name: variant.item_name, attributes: variant.attributes, ...bin,
  })));
  // One card per warehouse balance, named the way the customer would say it.
  const sources = rows.map((row) => source('Bin', row.name, {
    title: String(row.item_name ?? row.item_code), detail: warehouse(row.warehouse), qty: num(row.actual_qty),
  }));
  return { rows, sources };
}

export async function lastPrice(input: Row): Promise<ToolResult> {
  const variants = await variantsFor(input.item);
  if (!variants.length) return { rows: [], sources: [] };
  const joined = await list<Row>('Sales Invoice', {
    fields: ['name', 'posting_date', 'currency', 'items.item_code', 'items.item_name',
      'items.rate', 'items.qty'],
    filters: [
      ['customer', '=', DEMO_CUSTOMER],
      ['docstatus', '=', 1],
      ['Sales Invoice Item', 'item_code', 'in', variants.map((row) => row.name)],
    ],
    orderBy: 'posting_date desc',
    limit: 50,
  });
  // Newest invoice only; its matching lines may be more than one size.
  const rows = groupJoined(joined, ['item_code', 'item_name', 'rate', 'qty'], 'items').slice(0, 1);
  return {
    rows,
    sources: rows.map((row) => {
      const line = (row.items as Row[])[0] ?? {};
      return source('Sales Invoice', row.name, {
        title: String(row.name),
        detail: String(line.item_name ?? ''),
        date: text(row.posting_date) || undefined,
        rate: num(line.rate),
        currency: text(row.currency) || undefined,
      });
    }),
  };
}

const TOOLS = [
  {
    name: 'find_orders',
    description: 'Find this customer\'s ERPNext Sales Orders, newest first. Pass order_id for one exact order.',
    input_schema: { type: 'object' as const, properties: { order_id: { type: 'string' } } },
  },
  {
    name: 'check_stock',
    description: 'Current ERPNext stock per warehouse for a garment. item is the garment in English (Polo, Cargo Trouser, Shirt, Chino, Blazer); colour and size are optional English attribute values such as Navy and XL.',
    input_schema: {
      type: 'object' as const,
      properties: { item: { type: 'string' }, colour: { type: 'string' }, size: { type: 'string' } },
      required: ['item'],
    },
  },
  {
    name: 'last_price',
    description: 'The price per piece on this customer\'s latest submitted Sales Invoice for a garment (English name, as in check_stock).',
    input_schema: {
      type: 'object' as const,
      properties: { item: { type: 'string' } }, required: ['item'],
    },
  },
];

const SYSTEM = `You are the UniformAI assistant, talking to a UniformAI customer about their account: their orders, what is in stock, and what they paid. Speak as UniformAI ("we", "our records"). Never mention ERPNext, an ERP, databases, tools or APIs; the customer does not know or care what system is behind this.
Answer only from what the tools return. Never estimate or invent a date, quantity, price, status or record. If a tool returns no rows, say plainly that we have no record of it, and do not guess.
Lead with the direct answer (yes, no, the number, the status), then the one supporting fact, and name the order or invoice number it comes from. Two or three short sentences.
Put order statuses in plain words: "To Deliver and Bill" and "To Deliver" mean the order is still being made and has not been delivered; "To Bill" and "Completed" mean it has been delivered. Give dates as dates, not as field names.
Answer in the language of the question. Plain text only: no markdown, no bullet points, no headings.
You answer only for ${DEMO_CUSTOMER}. If asked about anyone else's order, say you cannot find it on their account. Production stages such as sewing and checks are not in these records; do not claim to know them.`;

async function runTool(name: string, input: Row): Promise<ToolResult> {
  if (name === 'find_orders') return findOrders(input);
  if (name === 'check_stock') return checkStock(input);
  if (name === 'last_price') return lastPrice(input);
  throw new Error(`Unknown tool: ${name}`);
}

/** The model loop's error boundary, exported so the no-throw ERP failure
 * contract can be checked without making a model call in CI. */
export async function executeTool(
  name: string,
  input: Row,
): Promise<{ result?: ToolResult; error?: string; status?: number }> {
  try {
    return { result: await runTool(name, input) };
  } catch (error) {
    return error instanceof ErpError
      ? { error: error.message, status: error.status }
      : { error: 'ERP unavailable' };
  }
}

export async function ask(
  question: string,
  history: HistoryTurn[] = [],
  locale: 'ar' | 'en' = 'ar',
  onStep: (step: Step) => void = () => {},
): Promise<AskResult> {
  assertErpConfigured();
  // Resolves ANTHROPIC_API_KEY or an `ant auth login` profile. A key that is
  // not scoped to a workspace must name one on every request.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {});
  const recent = history.slice(-6);
  // The API needs the conversation to open on a user turn.
  while (recent[0]?.role === 'assistant') recent.shift();
  const messages: BetaMessageParam[] = [
    ...recent.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: 'user', content: question },
  ];
  const allSources: Source[] = [];
  const steps: Step[] = [];

  for (let round = 0; round < 5; round++) {
    const response = await client.beta.messages.create({
      betas: ['server-side-fallback-2026-07-01'],
      model: 'claude-opus-5',
      max_tokens: 4000,
      output_config: { effort: 'low' },
      fallbacks: 'default',
      // The frozen prompt is cached; the locale line sits after the breakpoint.
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `The interface locale is ${locale}.` },
      ],
      tools: TOOLS,
      messages,
    });
    if (response.stop_reason === 'refusal') throw new Error('Assistant refused');
    messages.push({ role: 'assistant', content: response.content as BetaContentBlockParam[] });
    const calls = response.content.filter((block) => block.type === 'tool_use');
    if (!calls.length) {
      const answer = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text).join('\n').trim();
      if (!answer) throw new Error('Assistant returned no answer');
      const sources = [...new Map(allSources.map((s) => [`${s.doctype}:${s.name}`, s])).values()];
      return { answer, sources, steps };
    }
    const results = await Promise.all(calls.map(async (call): Promise<BetaToolResultBlockParam> => {
      const input = call.input && typeof call.input === 'object' ? call.input as Row : {};
      const started = Date.now();
      const step: Step = { id: call.id, tool: call.name, input, state: 'running' };
      onStep(step);
      const executed = await executeTool(call.name, input);
      const ms = Date.now() - started;
      if (!executed.result) {
        if (executed.status === 401 || executed.status === 403) {
          console.error('ERP authorization failed; check ERP_READ_KEY');
        }
        const failed: Step = { ...step, state: 'error', ms };
        steps.push(failed);
        onStep(failed);
        return { type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'ERP unavailable' };
      }
      allSources.push(...executed.result.sources);
      const done: Step = { ...step, state: 'done', rows: executed.result.rows.length, ms };
      steps.push(done);
      onStep(done);
      return { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(executed.result.rows) };
    }));
    messages.push({ role: 'user', content: results });
  }
  throw new Error('Assistant tool loop exceeded five rounds');
}
