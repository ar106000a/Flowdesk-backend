import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";
import { getIO } from "../../lib/socket.js";

// ─── GET /api/projects/:projectId/tasks ───────────────────────────────────────
export async function getTasks(req, res, next) {
  try {
    const { projectId } = req.params;

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("status")
      .order("position");

    if (error) throw new AppError(error.message, 500);

    res.json({ data: tasks });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/projects/:projectId/tasks ──────────────────────────────────────
export async function createTask(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title, description, status, priority, assignee_id, due_date } =
      req.body;
    const userId = req.user.id;

    if (!title?.trim()) throw new AppError("Task title is required", 400);

    // Get highest position in target column
    const { data: lastTask } = await supabase
      .from("tasks")
      .select("position")
      .eq("project_id", projectId)
      .eq("status", status || "todo")
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const position = lastTask ? lastTask.position + 1000 : 0;

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        title: title.trim(),
        description: description || null,
        status: status || "todo",
        priority: priority || "medium",
        assignee_id: assignee_id || null,
        due_date: due_date || null,
        position,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    // Emit to all users viewing this project
    getIO()
      .to(`project:${projectId}`)
      .emit("task:created", { task, projectId });

    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/projects/:projectId/tasks/:taskId ─────────────────────────────
export async function updateTask(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const {
      title,
      description,
      status,
      priority,
      assignee_id,
      due_date,
      position,
    } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (assignee_id !== undefined) updates.assignee_id = assignee_id;
    if (due_date !== undefined) updates.due_date = due_date;
    if (position !== undefined) updates.position = position;

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    getIO()
      .to(`project:${projectId}`)
      .emit("task:updated", { task, projectId });

    res.json({ data: task });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/projects/:projectId/tasks/:taskId ────────────────────────────
export async function deleteTask(req, res, next) {
  try {
    const { projectId, taskId } = req.params;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("project_id", projectId);

    if (error) throw new AppError(error.message, 500);

    getIO()
      .to(`project:${projectId}`)
      .emit("task:deleted", { taskId, projectId });

    res.json({ data: { message: "Task deleted" } });
  } catch (err) {
    next(err);
  }
}
