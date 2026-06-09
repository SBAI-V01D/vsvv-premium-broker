import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const chunkSize = 200;

  // Fetch one batch and delete it, return progress info
  const batch = await base44.asServiceRole.entities.BAGPraemienDaten.list('-created_date', chunkSize);
  
  if (!batch || batch.length === 0) {
    return Response.json({ done: true, deleted: body.deleted || 0, remaining: 0 });
  }

  await Promise.all(batch.map(r => base44.asServiceRole.entities.BAGPraemienDaten.delete(r.id)));

  const deletedSoFar = (body.deleted || 0) + batch.length;
  const total = body.total || (deletedSoFar + batch.length); // rough estimate

  return Response.json({ 
    done: batch.length < chunkSize,
    deleted: deletedSoFar,
    batch_size: batch.length,
  });
});