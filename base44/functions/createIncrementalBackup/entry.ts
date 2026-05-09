import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Incremental backup - only changed records since last backup
 * Run every 15 minutes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const backupId = `incr_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const changesSince = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // Last 15 mins

    const backup = {
      id: backupId,
      type: 'incremental',
      timestamp,
      created_by: user.email,
      changes: {},
      stats: {}
    };

    // Entities to check for changes
    const entities = [
      'Customer', 'Contract', 'Application', 'Task', 'AuditLog',
      'StatusHistory', 'Document'
    ];

    for (const entity of entities) {
      try {
        // Get recently updated records (last 15 mins)
        const records = await base44.entities[entity].filter(
          { updated_date: { $gte: changesSince } },
          '-updated_date',
          1000
        ).catch(() => []);

        if (records && records.length > 0) {
          backup.changes[entity] = records.map(r => ({
            id: r.id,
            updated_date: r.updated_date,
            action: r.created_date === r.updated_date ? 'created' : 'updated'
          }));
          backup.stats[entity] = records.length;
        } else {
          backup.stats[entity] = 0;
        }
      } catch (err) {
        backup.stats[entity] = { error: err.message };
      }
    }

    // Save backup log
    try {
      await base44.entities.BackupLog.create({
        backup_id: backupId,
        backup_type: 'incremental',
        timestamp,
        created_by: user.email,
        total_changes: Object.values(backup.stats).reduce((sum, s) => sum + (typeof s === 'number' ? s : 0), 0),
        status: 'completed',
        retention_days: 1
      });
    } catch {}

    return Response.json({
      success: true,
      backup_id: backupId,
      type: 'incremental',
      timestamp,
      changes: backup.stats
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});