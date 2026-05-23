import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Kunden mit aktivem Mandat (valid)
const VALID_NAMES = [
  'maria sophie stocker',
  'boris cular',
  'kristijan primus',
  'ben inniger',
  'yvonne engeli',
  'ursula rietschi',
];

function normalizeName(c) {
  return `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default: dry_run = true

    // Fetch all primary customers with pending mandate status
    const allCustomers = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);

    const targets = allCustomers.filter(c =>
      !c.is_family_member &&
      ['pending', 'invalid', 'expired'].includes(c.mandate_status)
    );

    const toValid = [];
    const toInvalid = [];

    for (const c of targets) {
      const name = normalizeName(c);
      if (VALID_NAMES.some(vn => name.includes(vn) || vn.includes(name))) {
        toValid.push(c);
      } else {
        toInvalid.push(c);
      }
    }

    const backup = targets.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      mandate_status_before: c.mandate_status,
      action: toValid.find(v => v.id === c.id) ? 'set_valid' : 'set_invalid',
    }));

    if (!dryRun) {
      // Save backup first
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'info',
        source: 'bulkCorrectMandateStatus',
        message: `Mandat-Korrektur: ${toValid.length} valid, ${toInvalid.length} invalid`,
        details: JSON.stringify(backup),
        user_email: user.email,
      });

      for (const c of toValid) {
        await base44.asServiceRole.entities.Customer.update(c.id, { mandate_status: 'valid' });
      }
      for (const c of toInvalid) {
        await base44.asServiceRole.entities.Customer.update(c.id, { mandate_status: 'invalid' });
      }
    }

    return Response.json({
      dry_run: dryRun,
      set_valid: toValid.map(c => `${c.first_name} ${c.last_name}`),
      set_invalid: toInvalid.map(c => `${c.first_name} ${c.last_name}`),
      count_valid: toValid.length,
      count_invalid: toInvalid.length,
      message: dryRun
        ? `DRY RUN: ${toValid.length} → valid, ${toInvalid.length} → invalid`
        : `Erledigt: ${toValid.length} → valid, ${toInvalid.length} → invalid. Backup im SystemLog.`,
    });

  } catch (error) {
    console.error('[bulkCorrectMandateStatus] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});