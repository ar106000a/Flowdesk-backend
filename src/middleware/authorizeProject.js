import supabase from "../lib/supabase.js";
import { AppError } from "../utils/AppError.js";

// This middleware runs AFTER authenticate on any route that involves a project
// It checks that the logged-in user is actually a member of that project
//
// Usage:
//   router.get('/:projectId/tasks', authenticate, authorizeProject, getTasks)
//
// It reads :projectId from the URL params, looks up project_members,
// and attaches req.projectMember (which includes their role) for use downstream

export async function authorizeProject(req, res, next) {
  try {
    const projectId = req.params.projectId;
    const userId = req.user.id;

    if (!projectId) {
      return next(new AppError("Project ID is required", 400));
    }

    const { data: member, error } = await supabase
      .from("project_members")
      .select("id, role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .single();

    if (error || !member) {
      // Don't reveal whether the project exists — just say forbidden
      return next(new AppError("You do not have access to this project", 403));
    }

    // Attach the member record so route handlers can check role if needed
    // e.g. if (req.projectMember.role !== 'owner') throw new AppError(...)
    req.projectMember = member;

    next();
  } catch (err) {
    next(err);
  }
}

// Helper used by specific routes that require the user to be the project owner
// e.g. deleting a project, removing a member, sending an invoice
export function requireOwner(req, res, next) {
  if (req.projectMember?.role !== "owner") {
    return next(
      new AppError("Only the project owner can perform this action", 403),
    );
  }
  next();
}
