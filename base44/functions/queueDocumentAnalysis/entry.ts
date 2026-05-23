/**
 * queueDocumentAnalysis — Async Document Analysis Queue
 * 
 * STATT synchrone KI-Analyse beim Upload:
 * 1. Dokument wird hochgeladen
 * 2. Queue-Eintrag erstellt (AutomationQueue Entity)
 * 3. Automation analysiert im Hintergrund
 * 4. User bekommt Notification wenn fertig
 * 
 * VORTEILE:
 * - Upload sofort erfolgreich (< 2s)
 * - KI-Analyse blockiert nicht
 * - Progress Tracking möglich
 * - Retry bei Fehlern
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { document_id, file_url, document_type } = body;

    if (!document_id || !file_url) {
      return Response.json({ 
        error: 'document_id and file_url required' 
      }, { status: 400 });
    }

    // Queue-Eintrag erstellen
    const queueEntry = await base44.entities.AutomationQueue.create({
      queue_name: 'document_analysis',
      status: 'pending',
      priority: 5, // Normal priority
      payload: {
        document_id,
        file_url,
        document_type,
        uploaded_by: user.email,
      },
      retry_count: 0,
      max_retries: 3,
      scheduled_at: new Date().toISOString(),
      created_by: user.email,
    });

    // Audit Log
    await base44.entities.AuditLog.create({
      audit_schema_version: '1.0',
      audit_id: `QUEUE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      audit_level: 3,
      audit_level_name: 'guard_decision',
      timestamp: new Date().toISOString(),
      trigger_type: 'manual',
      trigger_source: 'queueDocumentAnalysis',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      process_id: `DOC-${new Date().toISOString().slice(0, 10)}`,
      process_type: 'document_analysis_queue',
      process_stage: 'queued',
      event_id: `EVT-${Date.now()}`,
      event_type: 'document_queued_for_analysis',
      entity_type: 'document',
      entity_id: document_id,
      action: 'create',
      decision_code: 'DOCUMENT_QUEUED_ASYNC',
      decision_logic: 'Dokument zur asynchronen Analyse hinzugefügt',
      guard_evaluated: 'async_analysis_queue',
      guard_result: 'allowed',
      guard_reason: 'Async Queue entkoppelt Upload von Analyse',
      business_severity_type: 'operational',
      business_severity_level: 'low',
      technical_severity_type: 'info',
      technical_severity_level: 'low',
      new_state_summary: { queue_id: queueEntry.id, status: 'pending' },
      business_impact_description: 'Dokument wird im Hintergrund analysiert',
      metadata: { document_id, file_url, document_type },
    });

    return Response.json({
      success: true,
      queue_id: queueEntry.id,
      status: 'pending',
      message: 'Dokument wurde zur Analyse hinzugefügt. Sie erhalten eine Benachrichtigung sobald die Analyse abgeschlossen ist.',
      estimated_time: '2-5 Minuten',
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});