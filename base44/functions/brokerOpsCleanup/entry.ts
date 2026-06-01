import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können diese Funktion ausführen.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'analyze'; // 'analyze' | 'fix'

    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // ── 1. Überfällige offene Tasks ──────────────────────────────────────
    const allOpenTasks = await base44.asServiceRole.entities.Task.filter({ status: 'open' }, '-due_date', 500);
    const overdueTasks = allOpenTasks.filter(t => t.due_date && t.due_date < today.toISOString().split('T')[0]);

    // ── 2. Leads ohne Berater-Zuweisung ──────────────────────────────────
    const allLeads = await base44.asServiceRole.entities.Lead.list('-created_date', 500);
    const leadsWithoutAdvisor = allLeads.filter(l =>
      !l.advisor_id && !l.assigned_broker && l.status !== 'converted' && l.status !== 'lost'
    );

    // ── 3. Anträge > 7 Tage in Status new/waiting ────────────────────────
    const allApps = await base44.asServiceRole.entities.Application.filter({ archived: false }, '-created_date', 500);
    const staleApps = allApps.filter(a => {
      const staleStatuses = ['new', 'waiting', 'in_progress'];
      return staleStatuses.includes(a.status) && a.created_date && a.created_date.split('T')[0] < sevenDaysAgo;
    });

    if (mode === 'analyze') {
      return Response.json({
        success: true,
        mode: 'analyze',
        results: {
          overdue_tasks: {
            count: overdueTasks.length,
            items: overdueTasks.slice(0, 20).map(t => ({
              id: t.id,
              title: t.title,
              due_date: t.due_date,
              customer_name: t.customer_name,
              assigned_to: t.assigned_to,
              days_overdue: Math.floor((today - new Date(t.due_date)) / (1000 * 60 * 60 * 24)),
            })),
          },
          leads_without_advisor: {
            count: leadsWithoutAdvisor.length,
            items: leadsWithoutAdvisor.slice(0, 20).map(l => ({
              id: l.id,
              name: l.first_name ? `${l.first_name} ${l.last_name}` : l.company_name,
              email: l.email,
              status: l.status,
              created_date: l.created_date,
            })),
          },
          stale_applications: {
            count: staleApps.length,
            items: staleApps.slice(0, 20).map(a => ({
              id: a.id,
              customer_name: a.customer_name,
              insurer: a.insurer,
              status: a.status,
              created_date: a.created_date,
              days_old: Math.floor((today - new Date(a.created_date)) / (1000 * 60 * 60 * 24)),
            })),
          },
        },
      });
    }

    if (mode === 'fix') {
      const fixType = body.fix_type; // 'tasks_escalate' | 'apps_flag' | 'leads_flag'
      let fixed = 0;

      if (fixType === 'tasks_escalate') {
        // Überfällige Tasks auf priority=urgent setzen
        for (const t of overdueTasks) {
          if (t.priority !== 'urgent') {
            await base44.asServiceRole.entities.Task.update(t.id, { priority: 'urgent' });
            fixed++;
          }
        }
        return Response.json({ success: true, fixed, message: `${fixed} Tasks auf "Dringend" gesetzt.` });
      }

      if (fixType === 'apps_flag') {
        // Veraltete Anträge mit custom_status flaggen
        for (const a of staleApps) {
          await base44.asServiceRole.entities.Application.update(a.id, {
            notes: (a.notes ? a.notes + '\n' : '') + `[AUTO] Antrag seit >7 Tagen offen – Nachfassen erforderlich (${today.toISOString().split('T')[0]})`,
          });
          fixed++;
        }
        return Response.json({ success: true, fixed, message: `${fixed} Anträge als nachzufassen markiert.` });
      }

      if (fixType === 'leads_flag') {
        // Leads ohne Berater auf status=open setzen (damit sie auffallen)
        for (const l of leadsWithoutAdvisor) {
          await base44.asServiceRole.entities.Lead.update(l.id, { status: 'open' });
          fixed++;
        }
        return Response.json({ success: true, fixed, message: `${fixed} Leads auf Status "Offen" zurückgesetzt.` });
      }
    }

    return Response.json({ error: 'Ungültiger mode.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});