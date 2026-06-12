import supabase from '../../lib/supabase.js'
import { AppError } from '../../utils/AppError.js'
import { getIO } from '../../lib/socket.js'

// ─── GET /api/projects/:projectId/tasks/:taskId/time ──────────────────────────
export async function getTimeLogs(req, res, next) {
  try {
    const { taskId } = req.params

    const { data, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('logged_at', { ascending: false })

    if (error) throw new AppError(error.message, 500)

    res.json({ data })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/projects/:projectId/tasks/:taskId/time ─────────────────────────
export async function logTime(req, res, next) {
  try {
    const { projectId, taskId } = req.params
    const { minutes, description, logged_at, billable } = req.body
    const userId = req.user.id

    // Validation — minutes must be a positive integer
    const mins = Number(minutes)
    if (!mins || mins <= 0 || !Number.isInteger(mins)) {
      throw new AppError('Minutes must be a positive whole number', 400)
    }

    const { data: timeLog, error } = await supabase
      .from('time_logs')
      .insert({
        task_id: taskId,
        project_id: projectId,
        user_id: userId,
        minutes: mins,
        description: description || null,
        logged_at: logged_at || new Date().toISOString().split('T')[0],
        billable: billable !== false, // default true unless explicitly false
      })
      .select()
      .single()

    if (error) throw new AppError(error.message, 500)

    // Emit so other viewers see the new time log appear live
    getIO().to(`project:${projectId}`).emit('time:logged', {
      timeLog,
      taskId,
      projectId,
    })

    res.status(201).json({ data: timeLog })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/projects/:projectId/tasks/:taskId/time/:timeLogId ────────────
export async function deleteTimeLog(req, res, next) {
  try {
    const { projectId, taskId, timeLogId } = req.params
    const userId = req.user.id

    // Only the user who logged the time can delete it
    const { data: log } = await supabase
      .from('time_logs')
      .select('user_id')
      .eq('id', timeLogId)
      .single()

    if (!log) throw new AppError('Time log not found', 404)
    if (log.user_id !== userId) throw new AppError('Not your time log', 403)

    const { error } = await supabase
      .from('time_logs')
      .delete()
      .eq('id', timeLogId)

    if (error) throw new AppError(error.message, 500)

    getIO().to(`project:${projectId}`).emit('time:deleted', {
      timeLogId,
      taskId,
      projectId,
    })

    res.json({ data: { message: 'Time log deleted' } })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/projects/:projectId/time ────────────────────────────────────────
// Project-wide time summary — used later for invoicing and dashboard
export async function getProjectTimeSummary(req, res, next) {
  try {
    const { projectId } = req.params

    const { data, error } = await supabase
      .from('time_logs')
      .select('id, task_id, user_id, minutes, billable, logged_at, description')
      .eq('project_id', projectId)
      .order('logged_at', { ascending: false })

    if (error) throw new AppError(error.message, 500)

    const totalMinutes = data.reduce((sum, log) => sum + log.minutes, 0)
    const billableMinutes = data
      .filter((log) => log.billable)
      .reduce((sum, log) => sum + log.minutes, 0)

    res.json({
      data: {
        logs: data,
        totalMinutes,
        billableMinutes,
      },
    })
  } catch (err) {
    next(err)
  }
}