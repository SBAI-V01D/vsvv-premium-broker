/**
 * processDocumentAnalysisQueue — Background Queue Processor
 * 
 * Wird alle 2 Minuten durch Automation ausgeführt.
 * Verarbeitet pending Queue-Einträge für Dokumentenanalyse.
 * 
 * PROZESS:
 * 1. Hole pending Einträge (priorisiert)
 * 2. Führe smartDocumentAnalysis aus
 * 3. Speichere Ergebnis in Document Entity
 * 4. Update Queue status
 * 5. Sende Notification an User
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // System-Role für Background Processing
    const systemUser = await base44.auth.me();
    if (!systemUser || systemUser.role !== 'admin') {
      return Response.json({ error: 'System role required' }, { status: 401 });
    }

    // Hole pending Einträge (max 5 pro Durchlauf, priorisiert)
    const queueEntries = await base44.entities.AutomationQueue.filter({
      queue_name: 'document_analysis',
      status: 'pending',
    }, 'priority', 5);

    if (queueEntries.length === 0) {
      return Response.json({ processed: 0, message: 'No pending entries' });
    }

    const results = [];

    for (const entry of queueEntries) {
      const startTime = Date.now();
      const { document_id, file_url, document_type, uploaded_by } = entry.payload || {};

      try {
        // Update status to processing
        await base44.entities.AutomationQueue.update(entry.id, {
          status: 'processing',
          started_at: new Date().toISOString(),
        });

        // KI-Analyse durchführen
        const analysisResult = await base44.functions.invoke('smartDocumentAnalysis', {
          file_url,
          document_type,
        });

        const processingTime = Date.now() - startTime;

        if (analysisResult.data?.success) {
          // Dokument mit Analyseergebnis updaten
          await base44.entities.Document.update(document_id, {
            processing_stage: 'entities_detected',
            classification_status: 'klassifiziert',
            classification_confidence: analysisResult.data.extracted?.document_confidence || 0.8,
            doc_type: analysisResult.data.extracted?.document_subtype || 'unbekannt',
            // Analyse-Ergebnis speichern für Review
            notes: JSON.stringify({
              extracted: analysisResult.data.extracted,
              customerMatches: analysisResult.data.customerMatches,
              detectionPhase: analysisResult.data.detectionPhase,
              analyzed_at: new Date().toISOString(),
              processing_time_ms: processingTime,
            }),
          });

          // Queue success
          await base44.entities.AutomationQueue.update(entry.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: {
              success: true,
              customerMatches: analysisResult.data.customerMatches?.length || 0,
              policiesDetected: analysisResult.data.extracted?.policies?.length || 0,
              processing_time_ms: processingTime,
            },
          });

          // Notification an User
          await base44.entities.Notification.create({
            user_email: uploaded_by,
            type: 'info',
            title: 'Dokumentenanalyse abgeschlossen',
            message: `Das Dokument wurde erfolgreich analysiert. ${analysisResult.data.customerMatches?.length || 0} Kunden gefunden, ${analysisResult.data.extracted?.policies?.length || 0} Policen erkannt.`,
            related_entity_type: 'document',
            related_entity_id: document_id,
          });

          results.push({
            document_id,
            success: true,
            processingTime,
            customerMatches: analysisResult.data.customerMatches?.length || 0,
          });
        } else {
          throw new Error(analysisResult.data?.error || 'Analysis failed');
        }
      } catch (error) {
        const retryCount = (entry.retry_count || 0) + 1;
        
        if (retryCount >= entry.max_retries) {
          // Max retries reached → failed
          await base44.entities.AutomationQueue.update(entry.id, {
            status: 'failed',
            error_message: error.message,
            failed_at: new Date().toISOString(),
          });

          // Error Notification
          await base44.entities.Notification.create({
            user_email: uploaded_by,
            type: 'error',
            title: 'Dokumentenanalyse fehlgeschlagen',
            message: `Die Analyse konnte nicht abgeschlossen werden: ${error.message}`,
            related_entity_type: 'document',
            related_entity_id: document_id,
          });

          results.push({ document_id, success: false, error: error.message });
        } else {
          // Retry
          await base44.entities.AutomationQueue.update(entry.id, {
            status: 'pending',
            retry_count: retryCount,
            scheduled_at: new Date(Date.now() + 60000).toISOString(), // Retry in 1 min
          });

          results.push({ document_id, retry: true, retryCount });
        }
      }
    }

    return Response.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});