import crypto from 'crypto'
import supabase from '../../lib/supabase.js'
import { AppError } from '../../utils/AppError.js'

// ─── POST /api/projects/:projectId/portal/generate ────────────────────────────
// Owner-only — generates a new portal token for the project
// crypto.randomBytes gives a cryptographically secure random token,
// not guessable like a sequential ID or short code
export async function generatePortalToken(req, res, next) {
  try {
    const { projectId } = req.params
    const userId = req.user.id

    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (!project) throw new AppError('Project not found', 404)
    if (project.owner_id !== userId) throw new AppError('Only the project owner can generate a portal link', 403)

    const token = crypto.randomBytes(32).toString('hex')

    const { data: updated, error } = await supabase
      .from('projects')
      .update({ portal_token: token })
      .eq('id', projectId)
      .select('portal_token')
      .single()

    if (error) throw new AppError(error.message, 500)

    res.json({ data: { portal_token: updated.portal_token } })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/projects/:projectId/portal/revoke ──────────────────────────────
export async function revokePortalToken(req, res, next) {
  try {
    const { projectId } = req.params
    const userId = req.user.id

    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single()

    if (!project) throw new AppError('Project not found', 404)
    if (project.owner_id !== userId) throw new AppError('Only the project owner can revoke the portal link', 403)

    const { error } = await supabase
      .from('projects')
      .update({ portal_token: null })
      .eq('id', projectId)

    if (error) throw new AppError(error.message, 500)

    res.json({ data: { message: 'Portal link revoked' } })
  } catch (err) {
    next(err)
  }
}

// ─── GET /app/portal/:token ────────────────────────────────────────────────────
// PUBLIC — no authenticate middleware, no JWT required
// Security relies entirely on the token being unguessable (32 random bytes)
export async function getPortalData(req, res, next) {
  try {
    const { token } = req.params

    const { data: project, error } = await supabase
      .from('projects')
      .select('id, name, description, client_name, status, color')
      .eq('portal_token', token)
      .single()

    if (error || !project) throw new AppError('Invalid or expired portal link', 404)

    // Read-only task list — only fields the client should see
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .eq('project_id', project.id)
      .order('status')
      .order('position')

    // Read-only invoice list — only fields relevant to the client
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, currency, due_date, pdf_url')
      .eq('project_id', project.id)
      .neq('status', 'draft') // never show drafts to clients
      .order('created_at', { ascending: false })

    res.json({
      data: {
        project,
        tasks: tasks ?? [],
        invoices: invoices ?? [],
      },
    })
  } catch (err) {
    next(err)
  }
}