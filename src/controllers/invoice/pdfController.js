import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";
import { generatePdfFromHtml } from "../../lib/pdf.js";
import { formatInvoiceHTML } from "../../utils/formatInvoiceHTML.js";

export async function generateInvoicePdf(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*, project:projects(id, name)")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) throw new AppError("Invoice not found", 404);

    const { data: member } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", invoice.project_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) throw new AppError("Access denied", 403);

    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position");

    invoice.line_items = lineItems ?? [];

    const html = formatInvoiceHTML(invoice, invoice.project);
    const pdfBuffer = await generatePdfFromHtml(html);

    const fileName = `invoices/${invoiceId}/${invoice.invoice_number}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "flowdesk-attachments")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error(
        "Supabase Storage Error Details:",
        JSON.stringify(uploadError, null, 2),
      );
      throw new AppError(
        "Failed to upload PDF: " + (uploadError.message || "Unknown error"),
        500,
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "flowdesk-attachments")
      .getPublicUrl(fileName);

    const pdfUrl = publicUrlData.publicUrl;

    await supabase
      .from("invoices")
      .update({ pdf_url: pdfUrl })
      .eq("id", invoiceId);

    res.json({ data: { pdf_url: pdfUrl } });
  } catch (err) {
    next(err);
  }
}
