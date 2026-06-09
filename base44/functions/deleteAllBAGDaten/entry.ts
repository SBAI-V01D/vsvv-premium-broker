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

  // Sequential deletes with retry to avoid rate limits
  let deletedInBatch = 0;
  for (const r of batch) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await base44.asServiceRole.entities.BAGPraemienDaten.delete(r.id);
        deletedInBatch++;
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise(res => setTimeout(res, 500 * attempt));
      }
    }
  }

  const deletedSoFar = (body.deleted || 0) + deletedInBatch;

  return Response.json({ 
    done: batch.length < chunkSize,
    deleted: deletedSoFar,
    batch_size: batch.length,
  });
});