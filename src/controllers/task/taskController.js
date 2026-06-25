import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";
import { getIO } from "../../lib/socket.js";

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

// ─── GET single task with attachments ─────────────────────────────────────────
export async function getTask(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const { data: task, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .eq("project_id", projectId)
      .single();
    if (error || !task) throw new AppError("Task not found", 404);

    const { data: attachments } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("uploaded_at", { ascending: false });

    res.json({ data: { ...task, attachments: attachments ?? [] } });
  } catch (err) {
    next(err);
  }
}

export async function createTask(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title, description, status, priority, assignee_id, due_date } =
      req.body;
    const userId = req.user.id;
    if (!title?.trim()) throw new AppError("Task title is required", 400);

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
    getIO()
      .to(`project:${projectId}`)
      .emit("task:created", { task, projectId });
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
}

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
