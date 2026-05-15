import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * applicationToContractAuto — DISABLED
 * Contract creation is handled exclusively by onApplicationUpdate.
 * This function is kept as a no-op to avoid breaking any automation references.
 */

Deno.serve(async (req) => {
  return Response.json({
    status: 'disabled',
    reason: 'Contract creation handled by onApplicationUpdate. This function is intentionally a no-op.',
  });
});