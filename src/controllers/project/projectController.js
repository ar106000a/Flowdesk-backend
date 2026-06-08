import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";

// ─── GET /api/projects ────────────────────────────────────────────────────────
export async function getProjects(req, res, next) {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("project_members")
      .select(
        `
        role,
        project:projects (
          id, name, description, status, color,
          client_name, client_email, budget,
          created_at, updated_at, owner_id
        )
      `,
      )
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);

    const projects = data.map((row) => ({ ...row.project, role: row.role }));
    res.json({ data: projects });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/projects ───────────────────────────────────────────────────────
export async function createProject(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, description, client_name, client_email, color, budget } =
      req.body;

    if (!name?.trim()) throw new AppError("Project name is required", 400);

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        description: description || null,
        client_name: client_name || null,
        client_email: client_email || null,
        color: color || "#ff6600",
        budget: budget || 0,
        owner_id: userId,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    const { error: memberError } = await supabase
      .from("project_members")
      .insert({ project_id: project.id, user_id: userId, role: "owner" });

    if (memberError) throw new AppError(memberError.message, 500);

    res.status(201).json({ data: { ...project, role: "owner" } });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/projects/:projectId ─────────────────────────────────────────────
export async function getProject(req, res, next) {
  try {
    const { projectId } = req.params;

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error || !project) throw new AppError("Project not found", 404);

    const { data: members } = await supabase
      .from("project_members")
      .select("id, role, user_id, joined_at")
      .eq("project_id", projectId);

    res.json({
      data: {
        ...project,
        members: members ?? [],
        role: req.projectMember.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/projects/:projectId ──────────────────────────────────────────
export async function updateProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const {
      name,
      description,
      client_name,
      client_email,
      color,
      budget,
      status,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (client_name !== undefined) updates.client_name = client_name;
    if (client_email !== undefined) updates.client_email = client_email;
    if (color !== undefined) updates.color = color;
    if (budget !== undefined) updates.budget = budget;
    if (status !== undefined) updates.status = status;

    const { data: project, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/projects/:projectId ─────────────────────────────────────────
export async function deleteProject(req, res, next) {
  try {
    const { projectId } = req.params;

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) throw new AppError(error.message, 500);

    res.json({ data: { message: "Project deleted" } });
  } catch (err) {
    next(err);
  }
}
