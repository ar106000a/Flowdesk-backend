import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";

// ─── Helper: generate next invoice number from PG sequence ───────────────────
// CRITICAL: never generate invoice numbers in JS with COUNT(*) + 1
// Concurrent requests would create duplicates. The PG sequence guarantees
// atomicity — each call to nextval() is unique even under heavy concurrency.
async function getNextInvoiceNumber() {
  const { data, error } = await supabase.rpc("next_invoice_number");
  if (error) throw new AppError("Failed to generate invoice number", 500);
  // Format: INV-0001, INV-0002, ...
  return `INV-${String(data).padStart(4, "0")}`;
}

// ─── GET /api/invoices ─────────────────────────────────────────────────────────
// Returns all invoices across projects the user is a member of
export async function getInvoices(req, res, next) {
  try {
    const userId = req.user.id;

    // Get project IDs the user belongs to
    const { data: memberRows, error: memberError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    if (memberError) throw new AppError(memberError.message, 500);

    const projectIds = memberRows.map((r) => r.project_id);
    if (projectIds.length === 0) return res.json({ data: [] });

    const { data, error } = await supabase
      .from("invoices")
      .select("*, project:projects(id, name, color)")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/projects/:projectId/invoices ─────────────────────────────────────
export async function getProjectInvoices(req, res, next) {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/invoices/:invoiceId ───────────────────────────────────────────────
export async function getInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*, project:projects(id, name, color, owner_id)")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) throw new AppError("Invoice not found", 404);

    // Authorization: user must be a member of the invoice's project
    const { data: member } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", invoice.project_id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (!member) throw new AppError("Access denied", 403);

    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position");

    res.json({ data: { ...invoice, line_items: lineItems ?? [] } });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/projects/:projectId/invoices ────────────────────────────────────
export async function createInvoice(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const {
      client_name,
      client_email,
      currency,
      due_date,
      notes,
      tax_rate,
      line_items,
    } = req.body;

    if (!client_name?.trim())
      throw new AppError("Client name is required", 400);
    if (!client_email?.trim())
      throw new AppError("Client email is required", 400);
    if (!Array.isArray(line_items) || line_items.length === 0) {
      throw new AppError("At least one line item is required", 400);
    }

    // Validate and calculate line item amounts
    const items = line_items.map((item, idx) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      if (!item.description?.trim())
        throw new AppError(`Line item ${idx + 1} needs a description`, 400);
      if (!quantity || quantity <= 0)
        throw new AppError(`Line item ${idx + 1} needs a valid quantity`, 400);
      if (unitPrice < 0)
        throw new AppError(
          `Line item ${idx + 1} needs a valid unit price`,
          400,
        );

      return {
        description: item.description.trim(),
        quantity,
        unit_price: unitPrice,
        amount: Math.round(quantity * unitPrice * 100) / 100,
        time_log_ids: item.time_log_ids ?? null,
        position: idx,
      };
    });

    const subtotal =
      Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
    const taxRate = Number(tax_rate) || 0;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    // 1. Generate invoice number atomically via PG sequence
    const invoiceNumber = await getNextInvoiceNumber();

    // 2. Create invoice
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        project_id: projectId,
        owner_id: userId,
        invoice_number: invoiceNumber,
        client_name: client_name.trim(),
        client_email: client_email.trim(),
        status: "draft",
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: currency || "USD",
        due_date: due_date || null,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    // 3. Insert line items
    const itemsWithInvoiceId = items.map((item) => ({
      ...item,
      invoice_id: invoice.id,
    }));
    const { data: insertedItems, error: itemsError } = await supabase
      .from("invoice_line_items")
      .insert(itemsWithInvoiceId)
      .select();

    if (itemsError) {
      // Rollback the invoice if line items fail
      await supabase.from("invoices").delete().eq("id", invoice.id);
      throw new AppError(itemsError.message, 500);
    }

    res.status(201).json({ data: { ...invoice, line_items: insertedItems } });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/invoices/:invoiceId ─────────────────────────────────────────────
// Updates invoice details AND replaces line items if provided
export async function updateInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;
    const {
      client_name,
      client_email,
      currency,
      due_date,
      notes,
      tax_rate,
      status,
      line_items,
    } = req.body;

    // Fetch invoice to check ownership + current status
    const { data: existing, error: fetchError } = await supabase
      .from("invoices")
      .select("id, owner_id, status, project_id")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !existing) throw new AppError("Invoice not found", 404);
    if (existing.owner_id !== userId)
      throw new AppError("Only the invoice owner can edit it", 403);

    // Paid invoices are locked — no edits except status (e.g. cancelling)
    if (existing.status === "paid" && line_items) {
      throw new AppError("Cannot edit line items on a paid invoice", 400);
    }

    const updates = {};
    if (client_name !== undefined) updates.client_name = client_name.trim();
    if (client_email !== undefined) updates.client_email = client_email.trim();
    if (currency !== undefined) updates.currency = currency;
    if (due_date !== undefined) updates.due_date = due_date || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (status !== undefined) updates.status = status;

    // If line items are being replaced, recalculate totals
    if (Array.isArray(line_items)) {
      const items = line_items.map((item, idx) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        if (!item.description?.trim())
          throw new AppError(`Line item ${idx + 1} needs a description`, 400);
        if (!quantity || quantity <= 0)
          throw new AppError(
            `Line item ${idx + 1} needs a valid quantity`,
            400,
          );
        if (unitPrice < 0)
          throw new AppError(
            `Line item ${idx + 1} needs a valid unit price`,
            400,
          );

        return {
          description: item.description.trim(),
          quantity,
          unit_price: unitPrice,
          amount: Math.round(quantity * unitPrice * 100) / 100,
          time_log_ids: item.time_log_ids ?? null,
          position: idx,
        };
      });

      const subtotal =
        Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
      const taxRate = tax_rate !== undefined ? Number(tax_rate) : undefined;
      const effectiveTaxRate = taxRate ?? 0;
      const taxAmount =
        Math.round(subtotal * (effectiveTaxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.total = total;
      if (taxRate !== undefined) updates.tax_rate = taxRate;

      // Replace line items: delete old, insert new
      await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", invoiceId);
      const itemsWithInvoiceId = items.map((item) => ({
        ...item,
        invoice_id: invoiceId,
      }));
      const { error: itemsError } = await supabase
        .from("invoice_line_items")
        .insert(itemsWithInvoiceId);

      if (itemsError) throw new AppError(itemsError.message, 500);
    } else if (tax_rate !== undefined) {
      // Tax rate changed without line items — recalc from existing items
      const { data: currentItems } = await supabase
        .from("invoice_line_items")
        .select("amount")
        .eq("invoice_id", invoiceId);

      const subtotal =
        Math.round(
          (currentItems ?? []).reduce((sum, i) => sum + Number(i.amount), 0) *
            100,
        ) / 100;
      const taxAmount =
        Math.round(subtotal * (Number(tax_rate) / 100) * 100) / 100;

      updates.tax_rate = Number(tax_rate);
      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.total = Math.round((subtotal + taxAmount) * 100) / 100;
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    const { data: lineItemsResult } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position");

    res.json({ data: { ...invoice, line_items: lineItemsResult ?? [] } });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/invoices/:invoiceId ───────────────────────────────────────────
export async function deleteInvoice(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const { data: existing } = await supabase
      .from("invoices")
      .select("owner_id, status")
      .eq("id", invoiceId)
      .single();

    if (!existing) throw new AppError("Invoice not found", 404);
    if (existing.owner_id !== userId)
      throw new AppError("Only the invoice owner can delete it", 403);
    if (existing.status === "paid")
      throw new AppError("Cannot delete a paid invoice", 400);

    // CASCADE deletes line_items automatically
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceId);

    if (error) throw new AppError(error.message, 500);

    res.json({ data: { message: "Invoice deleted" } });
  } catch (err) {
    next(err);
  }
}
