import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Restore system from backup
 * DANGEROUS: Use only for emergency recovery
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { backup_data, confirmation } = body;

    if (confirmation !== 'RESTORE_NOW') {
      return Response.json({ 
        error: 'Restore requires confirmation=RESTORE_NOW',
        warning: 'This will overwrite all current data!'
      }, { status: 400 });
    }

    if (!backup_data || !backup_data.entities) {
      return Response.json({ error: 'Invalid backup data' }, { status: 400 });
    }

    const result = {
      restored: {},
      failed: {},
      timestamp: new Date().toISOString()
    };

    // Restore each entity
    for (const [entityName, records] of Object.entries(backup_data.entities)) {
      try {
        if (!Array.isArray(records) || records.length === 0) {
          result.restored[entityName] = 0;
          continue;
        }

        // Bulk restore
        let restoredCount = 0;
        for (const record of records) {
          try {
            // Skip system fields
            const { id, created_date, updated_date, created_by, ...data } = record;
            
            // Try update first, then create
            try {
              await base44.entities[entityName].update(id, data);
              restoredCount++;
            } catch {
              // Create if update fails
              await base44.entities[entityName].create({ id, ...data });
              restoredCount++;
            }
          } catch (err) {
            // Continue with next record
          }
        }

        result.restored[entityName] = restoredCount;
      } catch (err) {
        result.failed[entityName] = err.message;
      }
    }

    // Log restoration
    try {
      await base44.entities.AuditLog.create({
        entity_type: 'system',
        entity_id: 'backup_restore',
        action: 'restore',
        changed_by: user.email,
        changed_at: new Date().toISOString(),
        summary: `Restored from backup: ${Object.values(result.restored).reduce((a,b) => a+b, 0)} records`
      });
    } catch {}

    return Response.json(result, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});