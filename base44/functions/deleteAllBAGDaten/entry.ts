import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let total = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities.BAGPraemienDaten.list('-created_date', 100);
    if (!batch || batch.length === 0) break;
    await Promise.all(batch.map(r => base44.asServiceRole.entities.BAGPraemienDaten.delete(r.id)));
    total += batch.length;
  }

  return Response.json({ success: true, deleted: total });
});