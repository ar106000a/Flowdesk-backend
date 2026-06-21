import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";
import { generatePdfFromHtml } from "../../lib/pdf.js";
import { formatInvoiceHTML } from "../../utils/formatInvoiceHTML.js";
import { sendInvoiceEmail } from "../../lib/mailer.js";

// ─── Helper: fetch full invoice with line items ───────────────────────────────
async function fetchFullInvoice(invoiceId) {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, project:projects(id, name)")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) throw new AppError("Invoice not found", 404);

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("position");

  invoice.line_items = lineItems ?? [];
  return invoice;
}

// ─── POST /api/invoices/:invoiceId/send ───────────────────────────────────────
// Generates PDF, uploads to storage, emails client, marks invoice as sent
export async function sendInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const invoice = await fetchFullInvoice(invoiceId);

    // Only owner can send
    if (invoice.owner_id !== userId)
      throw new AppError("Only the invoice owner can send it", 403);

    // Can only send draft or overdue invoices
    if (invoice.status === "paid")
      throw new AppError("Invoice is already paid", 400);
    if (invoice.status === "cancelled")
      throw new AppError("Invoice is cancelled", 400);

    // 1. Generate PDF
    const html = formatInvoiceHTML(invoice, invoice.project);
    const pdfBuffer = await generatePdfFromHtml(html);

    // 2. Upload to Supabase Storage
    const fileName = `invoices/${invoiceId}/${invoice.invoice_number}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "flowdesk-attachments")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw new AppError("Failed to upload PDF", 500);

    const { data: publicUrlData } = supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "flowdesk-attachments")
      .getPublicUrl(fileName);

    const pdfUrl = publicUrlData.publicUrl;

    // Fetch the freelancer's email so client replies go to them, not the platform
    const { data: ownerData } = await supabase
      .from("users")
      .select("email")
      .eq("id", invoice.owner_id)
      .single();

    // 3. Send email with PDF attached
    await sendInvoiceEmail({
      to: invoice.client_email,
      invoiceNumber: invoice.invoice_number,
      projectName: invoice.project?.name || "Project",
      total: invoice.total,
      currency: invoice.currency,
      pdfBuffer,
      pdfFileName: `${invoice.invoice_number}.pdf`,
      replyTo: ownerData?.email,
    });

    // 4. Update invoice status to sent + store pdf_url
    const { data: updated, error: updateError } = await supabase
      .from("invoices")
      .update({ status: "sent", pdf_url: pdfUrl })
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError) throw new AppError(updateError.message, 500);

    res.json({ data: { ...updated, line_items: invoice.line_items } });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/invoices/:invoiceId/mark-paid ──────────────────────────────────
export async function markInvoicePaid(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, owner_id, status")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) throw new AppError("Invoice not found", 404);
    if (invoice.owner_id !== userId)
      throw new AppError("Only the invoice owner can mark it paid", 403);
    if (invoice.status === "paid")
      throw new AppError("Invoice is already paid", 400);
    if (invoice.status === "cancelled")
      throw new AppError("Cannot mark a cancelled invoice as paid", 400);

    const { data: updated, error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError) throw new AppError(updateError.message, 500);

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/invoices/:invoiceId/cancel ─────────────────────────────────────
export async function cancelInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, owner_id, status")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) throw new AppError("Invoice not found", 404);
    if (invoice.owner_id !== userId)
      throw new AppError("Only the invoice owner can cancel it", 403);
    if (invoice.status === "paid")
      throw new AppError("Cannot cancel a paid invoice", 400);

    const { data: updated, error: updateError } = await supabase
      .from("invoices")
      .update({ status: "cancelled" })
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError) throw new AppError(updateError.message, 500);

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}
