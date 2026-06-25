import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";

// ─── GET /api/projects/:projectId/members ─────────────────────────────────────
export async function getMembers(req, res, next) {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabase
      .from("project_members")
      .select("id, role, user_id, joined_at")
      .eq("project_id", projectId);
    if (error) throw new AppError(error.message, 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/projects/:projectId/members ────────────────────────────────────
// Invite by user_id — in a real product this would be invite-by-email
// For now the owner adds members directly by their user ID
export async function addMember(req, res, next) {
  try {
    const { projectId } = req.params;
    const { user_id, role } = req.body;

    if (!user_id) throw new AppError("user_id is required", 400);

    // Prevent duplicate membership
    const { data: existing } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existing)
      throw new AppError("User is already a member of this project", 409);

    const { data, error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id, role: role || "member" })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/projects/:projectId/members/:memberId ─────────────────────────
export async function updateMemberRole(req, res, next) {
  try {
    const { memberId } = req.params;
    const { role } = req.body;

    if (!role) throw new AppError("role is required", 400);
    if (!["member", "owner"].includes(role))
      throw new AppError("Invalid role", 400);

    const { data, error } = await supabase
      .from("project_members")
      .update({ role })
      .eq("id", memberId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/projects/:projectId/members/:memberId ────────────────────────
export async function removeMember(req, res, next) {
  try {
    const { projectId, memberId } = req.params;
    const userId = req.user.id;

    const { data: member } = await supabase
      .from("project_members")
      .select("user_id, role")
      .eq("id", memberId)
      .single();

    if (!member) throw new AppError("Member not found", 404);
    // Cannot remove the owner
    if (member.role === "owner")
      throw new AppError("Cannot remove the project owner", 400);

    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);

    if (error) throw new AppError(error.message, 500);
    res.json({ data: { message: "Member removed" } });
  } catch (err) {
    next(err);
  }
}
