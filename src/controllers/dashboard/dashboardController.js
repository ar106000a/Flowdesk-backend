import supabase from "../../lib/supabase.js";
import { AppError } from "../../utils/AppError.js";

export async function getDashboard(req, res, next) {
  try {
    const userId = req.user.id;

    // Get all projects the user belongs to
    const { data: memberRows, error: memberError } = await supabase
      .from("project_members")
      .select("project_id, role, project:projects(id, name, color, status)")
      .eq("user_id", userId);

    if (memberError) throw new AppError(memberError.message, 500);

    const projectIds = memberRows.map((r) => r.project_id);
    if (projectIds.length === 0) {
      return res.json({
        data: {
          total_revenue: 0,
          pending_revenue: 0,
          active_projects: 0,
          total_hours_this_month: 0,
          revenue_by_month: [],
          project_stats: [],
          recent_invoices: [],
        },
      });
    }

    // Run queries in parallel for performance
    const [invoicesRes, tasksRes, timeLogsRes] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, status, total, currency, created_at, project_id, invoice_number, client_name",
        )
        .in("project_id", projectIds)
        .order("created_at", { ascending: false }),

      supabase
        .from("tasks")
        .select("id, project_id, status")
        .in("project_id", projectIds),

      supabase
        .from("time_logs")
        .select("id, project_id, minutes, billable, logged_at")
        .in("project_id", projectIds),
    ]);

    const invoices = invoicesRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const timeLogs = timeLogsRes.data ?? [];

    // ── Revenue totals ───────────────────────────────────────────────────────
    const totalRevenue = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + i.total, 0);
    const pendingRevenue = invoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((s, i) => s + i.total, 0);

    // ── Revenue by month (last 6 months) ─────────────────────────────────────
    const now = new Date();
    const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      const amount = invoices
        .filter((inv) => {
          if (inv.status !== "paid") return false;
          const invDate = new Date(inv.created_at);
          return (
            invDate.getMonth() === d.getMonth() &&
            invDate.getFullYear() === d.getFullYear()
          );
        })
        .reduce((s, inv) => s + inv.total, 0);
      return { month: label, amount };
    });

    // ── Hours this month ──────────────────────────────────────────────────────
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalHoursThisMonth =
      timeLogs
        .filter((l) => new Date(l.logged_at) >= thisMonth)
        .reduce((s, l) => s + l.minutes, 0) / 60;

    // ── Project stats ─────────────────────────────────────────────────────────
    const projectStats = memberRows.map(({ project }) => {
      const pTasks = tasks.filter((t) => t.project_id === project.id);
      const pTimeLogs = timeLogs.filter((l) => l.project_id === project.id);
      const pInvoices = invoices.filter((i) => i.project_id === project.id);

      return {
        project_id: project.id,
        project_name: project.name,
        project_color: project.color,
        project_status: project.status,
        total_tasks: pTasks.length,
        completed_tasks: pTasks.filter((t) => t.status === "done").length,
        total_hours:
          Math.round((pTimeLogs.reduce((s, l) => s + l.minutes, 0) / 60) * 10) /
          10,
        billed_amount: pInvoices
          .filter((i) => i.status === "paid")
          .reduce((s, i) => s + i.total, 0),
      };
    });

    // ── Recent invoices (last 5) ──────────────────────────────────────────────
    const recentInvoices = invoices.slice(0, 5);

    // ── Active projects count ─────────────────────────────────────────────────
    const activeProjects = memberRows.filter(
      (r) => r.project?.status === "active",
    ).length;

    res.json({
      data: {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        pending_revenue: Math.round(pendingRevenue * 100) / 100,
        active_projects: activeProjects,
        total_hours_this_month: Math.round(totalHoursThisMonth * 10) / 10,
        revenue_by_month: revenueByMonth,
        project_stats: projectStats,
        recent_invoices: recentInvoices,
      },
    });
  } catch (err) {
    next(err);
  }
}
