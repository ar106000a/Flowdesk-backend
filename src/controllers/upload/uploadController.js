import supabase from '../../lib/supabase.js'
import { AppError } from '../../utils/AppError.js'

// ─── POST /api/projects/:projectId/tasks/:taskId/attachments ──────────────────
// Expects multipart/form-data with a `file` field
// Uses Supabase Storage — file is uploaded as base64 from the request body
// For simplicity we accept the file as a base64 string + metadata from JSON
// (avoids needing multer/formidable on the server)
export async function uploadAttachment(req, res, next) {
  try {
    const { projectId, taskId } = req.params
    const userId = req.user.id
    const { fileName, fileType, fileData } = req.body

    if (!fileName || !fileType || !fileData) {
      throw new AppError('fileName, fileType, and fileData are required', 400)
    }

    // Decode base64
    const buffer = Buffer.from(fileData, 'base64')
    const fileSizeBytes = buffer.length

    // 10MB limit
    if (fileSizeBytes > 10 * 1024 * 1024) {
      throw new AppError('File size exceeds 10MB limit', 400)
    }

    const filePath = `attachments/${projectId}/${taskId}/${Date.now()}_${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'flowdesk-attachments')
      .upload(filePath, buffer, { contentType: fileType, upsert: false })

    if (uploadError) throw new AppError('Upload failed: ' + uploadError.message, 500)

    const { data: urlData } = supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'flowdesk-attachments')
      .getPublicUrl(filePath)

    const { data: attachment, error: dbError } = await supabase
      .from('task_attachments')
      .insert({
        task_id: taskId,
        file_url: urlData.publicUrl,
        file_name: fileName,
        file_size: fileSizeBytes,
        uploaded_by: userId,
      })
      .select()
      .single()

    if (dbError) throw new AppError(dbError.message, 500)

    res.status(201).json({ data: attachment })
  } catch (err) { next(err) }
}

// ─── DELETE /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId ──
export async function deleteAttachment(req, res, next) {
  try {
    const { attachmentId } = req.params
    const userId = req.user.id

    const { data: attachment } = await supabase
      .from('task_attachments')
      .select('uploaded_by, file_url')
      .eq('id', attachmentId)
      .single()

    if (!attachment) throw new AppError('Attachment not found', 404)
    if (attachment.uploaded_by !== userId) throw new AppError('Not your attachment', 403)

    // Extract storage path from public URL
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'flowdesk-attachments'
    const urlParts = attachment.file_url.split(`/${bucket}/`)
    const storagePath = urlParts[1]

    if (storagePath) {
      await supabase.storage.from(bucket).remove([storagePath])
    }

    await supabase.from('task_attachments').delete().eq('id', attachmentId)

    res.json({ data: { message: 'Attachment deleted' } })
  } catch (err) { next(err) }
}