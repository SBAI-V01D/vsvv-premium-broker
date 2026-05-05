import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIMEOUT_MS = 120_000; // 2 minutes max per job

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch pending jobs (max 3 at a time to avoid overload)
    const pendingJobs = await base44.asServiceRole.entities.AutomationQueue.filter(
      { status: 'pending', job_type: 'ki_extraction' },
      'created_date',
      3
    );

    if (pendingJobs.length === 0) {
      return Response.json({ message: 'No pending jobs', processed: 0 });
    }

    const results = [];

    for (const job of pendingJobs) {
      const startTime = Date.now();

      // Mark as processing
      await base44.asServiceRole.entities.AutomationQueue.update(job.id, {
        status: 'processing',
        started_at: new Date().toISOString(),
      });

      try {
        const payload = JSON.parse(job.payload || '{}');
        const { file_url, file_name, document_id } = payload;

        if (!file_url || !document_id) throw new Error('Missing file_url or document_id in payload');

        // Timeout guard
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Job timeout after 2 minutes')), TIMEOUT_MS)
        );

        const extractionPromise = base44.asServiceRole.functions.invoke('extractApplicationData', {
          file_url,
          file_name,
        });

        const extracted = await Promise.race([extractionPromise, timeoutPromise]);

        const extractedData = extracted?.data;

        // Update document with extraction results
        await base44.asServiceRole.entities.Document.update(document_id, {
          classification_status: extractedData?.status === 'ok' ? 'klassifiziert' : 'pruefung_erforderlich',
          classification_confidence: extractedData?.confidence ?? 0,
          classification_reason: extractedData?.normalized?.sparte
            ? `Sparte: ${extractedData.normalized.sparte} | Methode: ${extractedData.normalized.sparte_detection_method || 'auto'}`
            : 'Extraktion abgeschlossen',
        });

        const duration = Date.now() - startTime;

        // Mark job as done
        await base44.asServiceRole.entities.AutomationQueue.update(job.id, {
          status: 'done',
          completed_at: new Date().toISOString(),
          result: JSON.stringify({
            duration_ms: duration,
            confidence: extractedData?.confidence,
            sparte: extractedData?.normalized?.sparte,
            status: extractedData?.status,
          }),
        });

        // Log success
        await base44.asServiceRole.entities.SystemLog.create({
          level: 'info',
          source: 'processDocumentQueue',
          message: `KI-Extraktion erfolgreich: ${file_name} (${duration}ms, Konfidenz: ${extractedData?.confidence ?? '?'}%)`,
          related_entity_type: 'Document',
          related_entity_id: document_id,
        });

        results.push({ job_id: job.id, status: 'done', duration_ms: duration });

      } catch (jobError) {
        const duration = Date.now() - startTime;

        await base44.asServiceRole.entities.AutomationQueue.update(job.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: jobError.message,
          retry_count: (job.retry_count || 0) + 1,
        });

        // Update document to error state
        if (job.related_entity_id) {
          await base44.asServiceRole.entities.Document.update(job.related_entity_id, {
            classification_status: 'pruefung_erforderlich',
            classification_reason: `Fehler: ${jobError.message}`,
          });
        }

        // Log error
        await base44.asServiceRole.entities.SystemLog.create({
          level: 'error',
          source: 'processDocumentQueue',
          message: `KI-Extraktion fehlgeschlagen: Job ${job.id} – ${jobError.message}`,
          details: jobError.stack || jobError.message,
          related_entity_type: 'Document',
          related_entity_id: job.related_entity_id,
        });

        results.push({ job_id: job.id, status: 'failed', error: jobError.message, duration_ms: duration });
      }
    }

    return Response.json({ processed: results.length, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});