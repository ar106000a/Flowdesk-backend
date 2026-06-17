// Generates the HTML for an invoice PDF
// Pure string templating — no React, since this renders inside Puppeteer

export function formatInvoiceHTML(invoice, project) {
  const lineItemsHTML = (invoice.line_items || [])
    .map(
      (item) => `
    <tr>
      <td class="desc">${escapeHtml(item.description)}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${invoice.currency} ${Number(item.unit_price).toFixed(2)}</td>
      <td class="num">${invoice.currency} ${Number(item.amount).toFixed(2)}</td>
    </tr>
  `,
    )
    .join("");

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const issueDate = new Date(invoice.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
  .container { padding: 0; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #1a1a1a; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .brand-sub { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

  .invoice-meta { text-align: right; }
  .invoice-number { font-size: 18px; font-weight: 700; }
  .invoice-status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .status-draft { background: #eee; color: #555; }
  .status-sent { background: #e3f2fd; color: #1565c0; }
  .status-paid { background: #e8f5e9; color: #2e7d32; }
  .status-overdue { background: #ffebee; color: #c62828; }
  .status-cancelled { background: #eee; color: #999; text-decoration: line-through; }

  .details-grid { display: flex; justify-content: space-between; margin-bottom: 32px; gap: 40px; }
  .details-block { flex: 1; }
  .details-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 6px; }
  .details-value { font-size: 13px; font-weight: 600; }
  .details-sub { font-size: 11px; color: #666; margin-top: 2px; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; padding: 8px 0; border-bottom: 1px solid #ddd; }
  thead th.num { text-align: right; }
  tbody td { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
  tbody td.num { text-align: right; }
  tbody td.desc { font-weight: 500; }

  .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals-table { width: 240px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #666; }
  .totals-row.final { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #1a1a1a; }

  .notes { padding: 16px; background: #fafafa; border-radius: 6px; font-size: 11px; color: #666; margin-bottom: 24px; }
  .notes-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 6px; }

  .footer { text-align: center; font-size: 10px; color: #aaa; padding-top: 24px; border-top: 1px solid #eee; }
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <div>
      <div class="brand">Flowdesk</div>
      <div class="brand-sub">Project Management for Freelancers</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-number">${escapeHtml(invoice.invoice_number)}</div>
      <span class="invoice-status status-${invoice.status}">${invoice.status}</span>
    </div>
  </div>

  <div class="details-grid">
    <div class="details-block">
      <div class="details-label">Billed To</div>
      <div class="details-value">${escapeHtml(invoice.client_name)}</div>
      <div class="details-sub">${escapeHtml(invoice.client_email)}</div>
    </div>
    <div class="details-block">
      <div class="details-label">Project</div>
      <div class="details-value">${escapeHtml(project?.name || "—")}</div>
    </div>
    <div class="details-block">
      <div class="details-label">Issue Date</div>
      <div class="details-value">${issueDate}</div>
    </div>
    <div class="details-block">
      <div class="details-label">Due Date</div>
      <div class="details-value">${dueDate}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHTML}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${invoice.currency} ${Number(invoice.subtotal).toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span>Tax (${invoice.tax_rate}%)</span>
        <span>${invoice.currency} ${Number(invoice.tax_amount).toFixed(2)}</span>
      </div>
      <div class="totals-row final">
        <span>Total</span>
        <span>${invoice.currency} ${Number(invoice.total).toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${
    invoice.notes
      ? `
  <div class="notes">
    <div class="notes-label">Notes</div>
    <div>${escapeHtml(invoice.notes)}</div>
  </div>
  `
      : ""
  }

  <div class="footer">
    Generated by Flowdesk · ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
  </div>

</div>
</body>
</html>
  `;
}

// Prevent HTML injection from user-entered fields (client name, descriptions, notes)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
