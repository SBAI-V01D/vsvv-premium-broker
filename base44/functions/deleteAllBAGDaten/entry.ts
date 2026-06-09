import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const chunkSize = 50;

    // Fetch one batch and delete it, return progress info
    const batch = await base44.asServiceRole.entities.BAGPraemienDaten.list('-created_date', chunkSize);
    
    if (!batch || batch.length === 0) {
      return Response.json({ done: true, deleted: body.deleted || 0, remaining: 0 });
    }

    // Sequential deletes with retry to avoid rate limits
    let deletedInBatch = 0;
    for (const r of batch) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await base44.asServiceRole.entities.BAGPraemienDaten.delete(r.id);
          deletedInBatch++;
          break;
        } catch (err) {
          const isRateLimit = err?.response?.status === 429
            || String(err?.message || '').includes('429')
            || String(err?.message || '').toLowerCase().includes('rate limit');
          
          if (isRateLimit && attempt < 5) {
            // Exponentielles Backoff: 2s, 4s, 8s, 16s
            await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
          } else if (!isRateLimit) {
            // Anderer Fehler - sofort weiter
            break;
          }
        }
      }
    }

    const deletedSoFar = (body.deleted || 0) + deletedInBatch;

    return Response.json({ 
      done: batch.length < chunkSize,
      deleted: deletedSoFar,
      batch_size: batch.length,
    });
  } catch (error) {
    // Globaler Error-Handler - gibt trotzdem den Fortschritt zurück
    console.error('Delete error:', error);
    return Response.json({ 
      done: false, 
      deleted: body?.deleted || 0,
      error: error.message || String(error)
    });
  }
});