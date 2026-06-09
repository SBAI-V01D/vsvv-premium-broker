import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const BATCH_SIZE = 100;

    // Fetch batch
    const batch = await base44.asServiceRole.entities.BAGPraemienDaten.list('-created_date', BATCH_SIZE);
    
    if (!batch || batch.length === 0) {
      return Response.json({ done: true, deleted: body.deleted || 0, remaining: 0 });
    }

    // Try bulk delete first, fall back to sequential if not available
    let deletedInBatch = 0;
    try {
      // Attempt to use bulk delete if available
      const ids = batch.map(r => r.id);
      await base44.asServiceRole.entities.BAGPraemienDaten.bulkDelete(ids);
      deletedInBatch = batch.length;
    } catch (bulkErr) {
      // Fallback: sequential deletes with retry
      console.log('Bulk delete not available, using sequential:', bulkErr?.message);
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
              await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
            } else if (!isRateLimit) {
              // Other error - skip this record
              break;
            }
          }
        }
      }
    }

    const deletedSoFar = (body.deleted || 0) + deletedInBatch;

    return Response.json({ 
      done: batch.length < BATCH_SIZE,
      deleted: deletedSoFar,
      batch_size: batch.length,
      deleted_in_batch: deletedInBatch,
    });
  } catch (error) {
    console.error('Delete error:', error);
    return Response.json({ 
      done: false, 
      deleted: body?.deleted || 0,
      error: error.message || String(error)
    });
  }
});