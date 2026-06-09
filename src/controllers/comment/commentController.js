import supabase from '../../lib/supabase.js'
import { AppError } from '../../utils/AppError.js'
import { getIO } from '../../lib/socket.js'

// ─── GET /api/projects/:projectId/tasks/:taskId/comments ──────────────────────
export async function getComments(req, res, next) {
  try {
    const { taskId } = req.params

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) throw new AppError(error.message, 500)

    res.json({ data })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/projects/:projectId/tasks/:taskId/comments ─────────────────────
export async function createComment(req, res, next) {
  try {
    const { projectId, taskId } = req.params
    const { content } = req.body
    const userId = req.user.id

    if (!content?.trim()) throw new AppError('Comment content is required', 400)

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        task_id: taskId,
        user_id: userId,
        content: content.trim(),
      })
      .select()
      .single()

    if (error) throw new AppError(error.message, 500)

    getIO().to(`project:${projectId}`).emit('comment:added', {
      comment,
      taskId,
      projectId,
    })

    res.status(201).json({ data: comment })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId ────────
export async function deleteComment(req, res, next) {
  try {
    const { projectId, taskId, commentId } = req.params
    const userId = req.user.id

    // Only the comment author can delete their own comment
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single()

    if (!comment) throw new AppError('Comment not found', 404)
    if (comment.user_id !== userId) throw new AppError('Not your comment', 403)

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) throw new AppError(error.message, 500)

    getIO().to(`project:${projectId}`).emit('comment:deleted', {
      commentId,
      taskId,
      projectId,
    })

    res.json({ data: { message: 'Comment deleted' } })
  } catch (err) {
    next(err)
  }
}