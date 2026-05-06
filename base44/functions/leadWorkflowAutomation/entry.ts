import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Lead Workflow Automation
 * 
 * Triggered by entity automation on Lead create/update.
 * Also callable as a scheduled job to process all stale leads.
 * 
 * Logic:
 * - new lead > 3 days without contact → status stays 'new', create follow-up task
 * - contacted > 7 days without update → create reminder task
 * - qualified > 14 days without update → create urgent task
 * - Auto-score leads based on completeness
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  // Support both entity automation payload and direct invocation
  const targetLeadId = body?.event?.entity_id || body?.lead_id || null;

  const now = new Date();
  const results = { tasksCreated: 0, leadsScored: 0, errors: [] };

  // Fetch leads (single or all)
  let leads = [];
  if (targetLeadId) {
    const lead = await base44.asServiceRole.entities.Lead.get(targetLeadId);
    leads = lead ? [lead] : [];
  } else {
    leads = await base44.asServiceRole.entities.Lead.list('-created_date', 500);
  }

  // Fetch existing open tasks to avoid duplicate reminders
  const existingTasks = await base44.asServiceRole.entities.Task.filter({ status: 'open' });
  const taskLeadIds = new Set(existingTasks.map(t => t.related_entity_id).filter(Boolean));

  for (const lead of leads) {
    if (['converted', 'lost'].includes(lead.status)) continue;

    const createdAt = new Date(lead.created_date);
    const lastContact = lead.last_contact_date ? new Date(lead.last_contact_date) : createdAt;
    const daysSinceContact = Math.floor((now - lastContact) / (1000 * 60 * 60 * 24));
    const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

    // ── Lead Scoring ──────────────────────────────────────────────────────
    let score = 0;
    if (lead.email) score += 20;
    if (lead.phone) score += 15;
    if (lead.first_name && lead.last_name) score += 10;
    if (lead.birthdate) score += 10;
    if (lead.company) score += 5;
    if (lead.notes) score += 10;
    if (lead.documents?.length > 0) score += 15;
    if (lead.status === 'contacted') score += 10;
    if (lead.status === 'qualified') score += 20;
    // Recency bonus
    if (daysSinceCreated <= 7) score += 10;
    else if (daysSinceCreated <= 30) score += 5;

    score = Math.min(score, 100);

    // Update score if changed
    if (lead.lead_score !== score) {
      await base44.asServiceRole.entities.Lead.update(lead.id, { lead_score: score });
      results.leadsScored++;
    }

    // ── Follow-up Task Logic ──────────────────────────────────────────────
    // Avoid creating duplicate tasks for the same lead
    if (taskLeadIds.has(lead.id)) continue;

    let taskTitle = null;
    let taskPriority = 'normal';

    if (lead.status === 'new' && daysSinceCreated >= 3) {
      taskTitle = `📞 Erstkontakt: ${lead.first_name || ''} ${lead.last_name || lead.name || ''}`.trim();
      taskPriority = daysSinceCreated >= 7 ? 'high' : 'normal';
    } else if (lead.status === 'contacted' && daysSinceContact >= 7) {
      taskTitle = `🔄 Follow-up: ${lead.first_name || ''} ${lead.last_name || lead.name || ''}`.trim();
      taskPriority = daysSinceContact >= 14 ? 'high' : 'normal';
    } else if (lead.status === 'qualified' && daysSinceContact >= 14) {
      taskTitle = `⚡ Angebot erstellen: ${lead.first_name || ''} ${lead.last_name || lead.name || ''}`.trim();
      taskPriority = 'high';
    }

    if (taskTitle) {
      await base44.asServiceRole.entities.Task.create({
        title: taskTitle,
        status: 'open',
        priority: taskPriority,
        related_entity_type: 'Lead',
        related_entity_id: lead.id,
        notes: `Automatisch erstellt. Lead-Status: ${lead.status} | Score: ${score} | Tage seit Kontakt: ${daysSinceContact}`,
      });
      results.tasksCreated++;
    }
  }

  return Response.json({
    success: true,
    processed: leads.length,
    ...results,
  });
});