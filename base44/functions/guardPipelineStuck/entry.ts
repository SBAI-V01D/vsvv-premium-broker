import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Pipeline Stuck Detection
 * 
 * Detects if document processing_stage has not changed for X minutes.
 * Marks as "stuck" → allows manual retry
 * 
 * CRITICAL: Upload Stability
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const {
      document_id,
      timeout_minutes = 30, // Default: 30 minutes
    } = payload;

    if (!document_id) {
      return Response.json({ error: 'document_id erforderlich' }, { status: 400 });
    }

    console.log(
      `[guardPipelineStuck] CHECK document=${document_id} timeout=${timeout_minutes}m`
    );

    // ─── FETCH DOCUMENT ───
    const doc = await base44.entities.Document.get(document_id);
    if (!doc) {
      return Response.json({ error: 'Document nicht gefunden' }, { status: 404 });
    }

    // ─── CHECK IF STUCK ───
    const now = new Date();
    const lastUpdate = new Date(doc.updated_date);
    const minutesElapsed = (now - lastUpdate) / (1000 * 60);

    console.log(
      `[guardPipelineStuck] Document last updated ${minutesElapsed.toFixed(1)}m ago`
    );

    if (minutesElapsed > timeout_minutes) {
      console.warn(
        `[guardPipelineStuck] ⚠️ STUCK: document=${document_id} stage=${doc.processing_stage} for ${minutesElapsed.toFixed(1)}m`
      );

      return Response.json({
        stuck: true,
        document_id,
        processing_stage: doc.processing_stage,
        last_updated: doc.updated_date,
        minutes_elapsed: Math.round(minutesElapsed),
        message: `Document hängt fest (${doc.processing_stage}) – manueller Retry erforderlich`,
      });
    }

    console.log(
      `[guardPipelineStuck] ✅ OK: document=${document_id} progressing normally`
    );

    return Response.json({
      stuck: false,
      document_id,
      processing_stage: doc.processing_stage,
      minutes_elapsed: Math.round(minutesElapsed),
      message: 'Pipeline läuft normal',
    });
  } catch (error) {
    console.error(`[guardPipelineStuck] ERROR: ${error.message}`);
    return Response.json(
      { stuck: true, error: error.message },
      { status: 500 }
    );
  }
});