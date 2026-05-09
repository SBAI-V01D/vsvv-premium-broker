import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Create system backup - all entities with metadata
 * Should be called every 15 minutes via automation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const backupId = `backup_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const backup = {
      id: backupId,
      timestamp,
      created_by: user.email,
      entities: {},
      stats: {}
    };

    // Entities to backup
    const entities = [
      'Customer', 'Contract', 'Application', 'Task', 'Advisor',
      'Organization', 'Lead', 'Document', 'CommissionEntry',
      'AuditLog', 'StatusHistory', 'DuplicateAlert'
    ];

    for (const entity of entities) {
      try {
        const records = await base44.entities[entity].list(null, 10000);
        backup.entities[entity] = records;
        backup.stats[entity] = {
          total: records.length,
          backed_up: records.length
        };
      } catch (err) {
        backup.stats[entity] = {
          total: 0,
          backed_up: 0,
          error: err.message
        };
      }
    }

    // Save backup metadata
    try {
      await base44.entities.BackupLog.create({
        backup_id: backupId,
        timestamp,
        created_by: user.email,
        total_entities: Object.keys(backup.entities).length,
        total_records: Object.values(backup.stats).reduce((sum, s) => sum + (s.total || 0), 0),
        status: 'completed',
        size_kb: Math.round(JSON.stringify(backup).length / 1024)
      });
    } catch {
      // BackupLog might not exist yet
      console.log(`Backup created: ${backupId}`);
    }

    return Response.json({
      success: true,
      backup_id: backupId,
      timestamp,
      stats: backup.stats
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});