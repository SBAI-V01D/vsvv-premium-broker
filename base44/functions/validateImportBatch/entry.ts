import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Pre-import validation with duplicate detection
 * Must be called BEFORE import
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { records, entity_type, key_fields } = body;

    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'Records must be array', valid: false }, { status: 400 });
    }

    const validation = {
      total: records.length,
      valid: 0,
      invalid: 0,
      duplicates: 0,
      conflicts: 0,
      issues: []
    };

    // Fetch existing data
    let existing = [];
    try {
      existing = await base44.entities[entity_type].list(null, 5000);
    } catch {
      // Entity might not exist yet
    }

    const seenKeys = new Set();
    const existingKeys = new Map();

    // Build map of existing records by key
    (key_fields || ['id']).forEach(field => {
      existing.forEach(rec => {
        if (rec[field]) {
          const key = `${field}:${rec[field]}`;
          existingKeys.set(key, rec.id);
        }
      });
    });

    // Validate each record
    records.forEach((record, idx) => {
      const issues = [];

      // Check required fields
      if (!record.id) {
        issues.push('Missing id');
      }

      // Check duplicates within batch
      const batchKey = (key_fields || ['id']).map(f => record[f]).join('|');
      if (seenKeys.has(batchKey)) {
        validation.duplicates++;
        issues.push('Duplicate in batch');
      }
      seenKeys.add(batchKey);

      // Check conflicts with existing
      (key_fields || ['id']).forEach(field => {
        if (record[field]) {
          const existingKey = `${field}:${record[field]}`;
          if (existingKeys.has(existingKey)) {
            validation.conflicts++;
            issues.push(`Conflict: ${field} already exists`);
          }
        }
      });

      if (issues.length === 0) {
        validation.valid++;
      } else {
        validation.invalid++;
        validation.issues.push({
          row: idx + 1,
          record_id: record.id,
          issues
        });
      }
    });

    return Response.json(validation, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});