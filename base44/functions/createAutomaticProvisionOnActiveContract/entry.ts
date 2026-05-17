import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * DISABLED — Erwartete Provisionen werden jetzt direkt in onApplicationUpdate
 * aus application.commission_estimate erstellt, wenn der Antrag angenommen wird
 * und der Vertrag erstellt wird.
 *
 * Diese Funktion ist deaktiviert um Doppeleinträge zu verhindern.
 */
Deno.serve(async (_req) => {
  return Response.json({
    status: 'disabled',
    reason: 'Expected provisions are now created in onApplicationUpdate from application.commission_estimate. This function is intentionally a no-op to prevent duplicate entries.',
  });
});