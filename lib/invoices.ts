// An invoice as the customer sees it. Paid / Unpaid / Overdue come from what
// is still owed and the due day, never ERPNext's stored status, which only
// moves when its scheduler runs.

export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';
export type Invoice = {
  name: string; date: string; due: string; total: number; outstanding: number; status: InvoiceStatus;
  /** The sales order it bills, when one is linked. */
  order?: string;
};
export type InvoiceRow = {
  name: string; posting_date: string; due_date?: string | null; grand_total: number; outstanding_amount: number;
  sales_order?: string | null;
};

export function toInvoice(r: InvoiceRow, today: string): Invoice {
  const outstanding = Number(r.outstanding_amount) || 0;
  const due = r.due_date || r.posting_date;
  return {
    name: r.name, date: r.posting_date, due, total: Number(r.grand_total) || 0, outstanding,
    status: outstanding <= 0 ? 'paid' : due < today ? 'overdue' : 'unpaid',
    ...(r.sales_order ? { order: r.sales_order } : {}),
  };
}
