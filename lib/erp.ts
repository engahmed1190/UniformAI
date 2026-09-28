export type ErpValue = string | number | boolean | null;
/** [field, op, value], or [child doctype, field, op, value] to filter on a
 *  child table's rows. */
export type ErpFilter =
  | [field: string, operator: string, value: ErpValue | ErpValue[]]
  | [doctype: string, field: string, operator: string, value: ErpValue | ErpValue[]];

export type ListOptions = {
  fields?: string[];
  filters?: ErpFilter[];
  orderBy?: string;
  limit?: number;
};

export class ErpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ErpError';
  }
}

type KeyRole = 'read' | 'write';

function config(role: KeyRole = 'read') {
  const url = process.env.ERP_URL?.replace(/\/$/, '');
  const name = role === 'write' ? 'ERP_WRITE_KEY' : 'ERP_READ_KEY';
  const key = process.env[name];
  if (!url) throw new ErpError('Missing ERP_URL');
  if (!key) throw new ErpError(`Missing ${name}`);
  return { url, key };
}

export function assertErpConfigured(): void {
  config();
}

type RequestOptions = { params?: URLSearchParams; role?: KeyRole; body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, role = 'read', body } = options;
  const { url, key } = config(role);
  const target = `${url}${path}${params?.size ? `?${params}` : ''}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(target, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `token ${key}`, Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new ErpError(`ERP request failed (${response.status})`, response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ErpError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ErpError('ERP request timed out', undefined, error);
    }
    throw new ErpError('ERP unavailable', undefined, error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function list<T extends Record<string, unknown>>(
  doctype: string,
  options: ListOptions = {},
): Promise<T[]> {
  const params = new URLSearchParams();
  if (options.fields) params.set('fields', JSON.stringify(options.fields));
  if (options.filters) params.set('filters', JSON.stringify(options.filters));
  if (options.orderBy) params.set('order_by', options.orderBy);
  params.set('limit_page_length', String(options.limit ?? 20));
  const result = await request<{ data: T[] }>(`/api/resource/${encodeURIComponent(doctype)}`, { params });
  return result.data;
}

export async function get<T extends Record<string, unknown>>(
  doctype: string,
  name: string,
): Promise<T> {
  const result = await request<{ data: T }>(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
  );
  return result.data;
}

/** Whether ERPNext is up and the read key is accepted. The dock's status dot
 *  reads this, so a broken key shows before the client asks anything. */
export async function ping(): Promise<{ ok: boolean }> {
  try {
    await request('/api/method/frappe.auth.get_logged_user');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Create a document with the write key (the Portal user: drafts only). */
export async function insert<T extends Record<string, unknown>>(
  doctype: string,
  doc: Record<string, unknown>,
  _key: 'write',
): Promise<T> {
  const result = await request<{ data: T }>(
    `/api/resource/${encodeURIComponent(doctype)}`, { role: 'write', body: doc });
  return result.data;
}

/** Call a whitelisted server method. */
export async function call<T>(
  method: string,
  args: Record<string, unknown>,
  key: 'read' | 'write',
): Promise<T> {
  const result = await request<{ message: T }>(`/api/method/${method}`, { role: key, body: args });
  return result.message;
}
