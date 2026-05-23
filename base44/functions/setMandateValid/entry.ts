import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// List of customers whose mandate should be set to 'valid'
const TARGET_NAMES = [
  'Alexander Adam',
  'Daniela Leuenberger',
  'Hiba Bouloudinat',
  'May Abou Hadeed',
  'Peter Martin Adam',
  'Bruno Borer-Keller',
  'Beatrice Tschopp',
  'Guido Herzberg',
  'Stephanie Kuoni-Marquart',
  'Stephanie Kuoni_Marquart',
  'Angelika Rosnovski',
  'Jessica Natascha Wüthrich',
  'Fabienne Weiss',
];

function fullName(c) {
  return `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim();
}

function normalize(s) {
  return s.toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default: dry_run = true (safe)

    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);

    const normalizedTargets = TARGET_NAMES.map(normalize);

    const matches = customers.filter(c => {
      const name = normalize(fullName(c));
      return normalizedTargets.some(t => name === t || name.includes(t) || t.includes(name));
    });

    const results = {
      dry_run: dryRun,
      matched: matches.length,
      updated: 0,
      skipped_already_valid: 0,
      backup: [],
      details: [],
    };

    for (const c of matches) {
      // Always save snapshot before changing
      results.backup.push({
        id: c.id,
        name: fullName(c),
        mandate_status_before: c.mandate_status,
        advisor_id_before: c.advisor_id,
        primary_advisor_id_before: c.primary_advisor_id,
      });

      if (c.mandate_status === 'valid') {
        results.skipped_already_valid++;
        results.details.push({ name: fullName(c), action: 'skipped (already valid)' });
        continue;
      }

      if (!dryRun) {
        await base44.asServiceRole.entities.Customer.update(c.id, {
          mandate_status: 'valid',
        });
      }

      results.updated++;
      results.details.push({
        name: fullName(c),
        action: dryRun ? 'would set valid' : 'set to valid',
        before: c.mandate_status,
      });
    }

    // Save backup snapshot to SystemLog for auditability
    if (!dryRun && results.backup.length > 0) {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'info',
        source: 'setMandateValid',
        message: `Mandat-Status auf 'valid' gesetzt für ${results.updated} Kunden`,
        details: JSON.stringify(results.backup),
        user_email: user.email,
      });
    }

    return Response.json({
      ...results,
      message: dryRun
        ? `DRY RUN: ${results.updated} würden auf 'valid' gesetzt, ${results.skipped_already_valid} bereits valid`
        : `${results.updated} Kunden auf Mandat 'valid' gesetzt. Backup in SystemLog gespeichert.`,
    });

  } catch (error) {
    console.error('[setMandateValid] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});