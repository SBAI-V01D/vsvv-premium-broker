import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * PIPELINE CONTROL LAYER – SEQUENZIELLE VERARBEITUNG
 * 
 * ✅ PROCESSING STAGE PIPELINE:
 * 1. uploaded → 2. parsed → 3. entities_detected → 4. customer_mapped 
 * → 5. application_created → 6. policy_created
 * 
 * RULES:
 * ✓ Jeder Schritt ONLY wenn vorheriger stage = completed
 * ✓ customer_locked blockiert ALLE AI-Änderungen
 * ✓ Read-After-Write + DB-Reload nach jedem Update
 * ✓ Duplikat-Check: application/policy nur 1x erstellen
 * ✓ SKIP automation wenn stage ≠ expected
 */

// ─── STAGE PROGRESSION RULES ───
const STAGE_PROGRESSION = {
  uploaded: 'parsed',
  parsed: 'entities_detected',
  entities_detected: 'customer_mapped',
  customer_mapped: 'application_created',
  application_created: 'policy_created',
  policy_created: null, // Final stage
};

async function updateStage(base44, documentId, newStage) {
  // SCHRITT 1: Write
  console.log(`[automationPipeline] Updating stage: ${documentId} → ${newStage}`);
  await base44.entities.Document.update(documentId, {
    processing_stage: newStage,
  });

  // SCHRITT 2: Read-After-Write (Critical!)
  const reloaded = await base44.entities.Document.get(documentId);
  if (reloaded.processing_stage !== newStage) {
    throw new Error(
      `STAGE UPDATE FAILED: expected ${newStage}, got ${reloaded.processing_stage}`
    );
  }

  console.log(`[automationPipeline] ✅ Stage updated to: ${newStage}`);
  return reloaded;
}

async function checkStageGuard(stage, requiredStage) {
  if (stage !== requiredStage) {
    throw new Error(
      `STAGE GUARD FAILED: expected ${requiredStage}, got ${stage}. Skipping automation.`
    );
  }
}

async function checkDuplicateApplication(base44, documentId) {
  const existing = await base44.entities.Application.filter({
    linked_document_id: documentId,
  });
  if (existing.length > 0) {
    throw new Error(
      `DUPLICATE GUARD: Application already exists for doc ${documentId}`
    );
  }
}

async function checkDuplicatePolicy(base44, applicationId) {
  const existing = await base44.entities.Contract.filter({
    source_application_id: applicationId,
  });
  if (existing.length > 0) {
    throw new Error(
      `DUPLICATE GUARD: Policy already exists for application ${applicationId}`
    );
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      document_id,
      file_url,
      file_name,
      organization_id,
    } = payload;

    if (!document_id || !file_url) {
      return Response.json(
        { error: 'document_id und file_url erforderlich' },
        { status: 400 }
      );
    }

    console.log(
      `[automationPipeline] START doc=${document_id} stage=unknown`
    );

    // ─── LOAD DOCUMENT + CHECK CURRENT STAGE ───
    let doc = await base44.entities.Document.get(document_id);
    console.log(`[automationPipeline] Current stage: ${doc.processing_stage}`);

    // ─── STAGE 1: UPLOADED → PARSED ───
    if (doc.processing_stage === 'uploaded') {
      console.log('[automationPipeline] STAGE 1: uploaded → parsing');
      // Parsing already done by extractApplicationData frontend call
      doc = await updateStage(base44, document_id, 'parsed');
    }

    // ─── STAGE 2: PARSED → ENTITIES DETECTED ───
    if (doc.processing_stage === 'parsed') {
      console.log('[automationPipeline] STAGE 2: parsed → entities_detected');
      // Entity detection done via extractApplicationData (role classification)
      doc = await updateStage(base44, document_id, 'entities_detected');
    }

    // ─── STAGE 3: ENTITIES DETECTED → CUSTOMER MAPPED ───
    if (doc.processing_stage === 'entities_detected') {
      console.log('[automationPipeline] STAGE 3: entities_detected → customer_mapped');
      
      // GUARD: customer_locked prevents AI override
      if (doc.customer_locked) {
        console.log('[automationPipeline] ✅ customer_locked=true → skipping AI mapping');
      } else {
        console.log('[automationPipeline] ⚠️ customer_locked=false → AI mapping allowed (if implemented)');
      }

      // Always progress to customer_mapped if customer_id is set
      if (!doc.customer_id) {
        throw new Error(
          'VALIDATION FAILED: customer_id required before proceeding'
        );
      }

      doc = await updateStage(base44, document_id, 'customer_mapped');
    }

    // ─── STAGE 4: CUSTOMER MAPPED → APPLICATION CREATED ───
    if (doc.processing_stage === 'customer_mapped') {
      console.log('[automationPipeline] STAGE 4: customer_mapped → application_created');
      
      await checkStageGuard(doc.processing_stage, 'customer_mapped');

      // Fetch customer to get organization_id
      const customer = await base44.entities.Customer.get(doc.customer_id);
      if (!customer.organization_id) {
        throw new Error('Customer organization_id is required');
      }

      // DUPLICATE CHECK
      await checkDuplicateApplication(base44, document_id);

      // CREATE APPLICATION
      const application = await base44.entities.Application.create({
        customer_id: doc.customer_id,
        customer_name: doc.customer_name,
        organization_id: customer.organization_id,
        advisor_id: customer.advisor_id || null,
        status: 'submitted',
        custom_status: 'eingereicht',
        status_changed_at: new Date().toISOString(),
        notes: `Automatisch aus Dokument ${document_id} erstellt`,
      });

      console.log(`[automationPipeline] ✅ Application created: ${application.id}`);

      // Link document to application
      await base44.entities.Document.update(document_id, {
        linked_application_id: application.id,
      });

      // Stage transition
      doc = await updateStage(base44, document_id, 'application_created');
    }

    // ─── STAGE 5: APPLICATION CREATED → POLICY CREATED ───
    if (doc.processing_stage === 'application_created') {
      console.log('[automationPipeline] STAGE 5: application_created → policy_created');
      
      await checkStageGuard(doc.processing_stage, 'application_created');

      if (!doc.linked_application_id) {
        throw new Error('linked_application_id required for policy creation');
      }

      // Fetch application + customer
      const application = await base44.entities.Application.get(
        doc.linked_application_id
      );
      const customer = await base44.entities.Customer.get(application.customer_id);

      // DUPLICATE CHECK
      await checkDuplicatePolicy(base44, application.id);

      // CREATE POLICY (Contract)
      const contract = await base44.entities.Contract.create({
        customer_id: application.customer_id,
        customer_name: application.customer_name,
        organization_id: application.organization_id,
        advisor_id: application.advisor_id || null,
        source_application_id: application.id,
        status: 'active',
        insurer: application.insurer || 'Andere',
        insurance_type: application.insurance_type || 'other',
        notes: `Policy zur Application ${application.id}`,
      });

      console.log(`[automationPipeline] ✅ Contract created: ${contract.id}`);

      // Link document to contract
      await base44.entities.Document.update(document_id, {
        linked_contract_id: contract.id,
      });

      // Stage transition
      doc = await updateStage(base44, document_id, 'policy_created');
    }

    // ─── STAGE 6: COMMISSION CALCULATION (NACH policy_created) ───
    if (doc.processing_stage === 'policy_created' && doc.linked_contract_id) {
      console.log('[automationPipeline] STAGE 6: Calculating commissions');
      
      try {
        // Fetch contract (= policy)
        const contract = await base44.entities.Contract.get(doc.linked_contract_id);
        const customer = await base44.entities.Customer.get(contract.customer_id);

        // DUPLICATE CHECK: Commission für diese Policy existiert bereits?
        const existingCommissions = await base44.entities.CommissionEntry.filter({
          policy_id: contract.id,
        });
        
        if (existingCommissions.length === 0) {
          // Berechne Commission
          const premiumYearly = contract.premium_yearly || 0;
          const commissionRate = contract.commission_rate || 0.10; // Default 10%
          const commissionAmount = Math.round(premiumYearly * commissionRate * 100) / 100;

          // CREATE CommissionEntry
          const commission = await base44.entities.CommissionEntry.create({
            policy_id: contract.id,
            policy_number: contract.policy_number,
            advisor_id: contract.advisor_id,
            advisor_name: customer.first_name + ' ' + customer.last_name,
            organization_id: contract.organization_id,
            organization_name: customer.organization_id, // Cache
            customer_id: contract.customer_id,
            customer_name: contract.customer_name,
            insurer: contract.insurer,
            product_category: contract.sparte || 'other',
            premium_yearly: premiumYearly,
            commission_percentage: commissionRate * 100,
            commission_amount: commissionAmount,
            status: 'pending', // Initially pending
            entry_date: new Date().toISOString().split('T')[0],
          });

          console.log(`[automationPipeline] ✅ Commission created: ${commission.id} amount=${commissionAmount}`);

          // CREATE AccountingEntry (automatische Buchung)
          const accountingEntry = await base44.entities.AccountingEntry.create({
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: 'commission',
            amount: commissionAmount,
            advisor_id: contract.advisor_id,
            advisor_name: customer.first_name + ' ' + customer.last_name,
            organization_id: contract.organization_id,
            organization_name: customer.organization_id,
            policy_id: contract.id,
            policy_number: contract.policy_number,
            insurer: contract.insurer,
            customer_id: contract.customer_id,
            customer_name: contract.customer_name,
            status: 'pending',
            reference_type: 'commission_entry',
            reference_id: commission.id,
            notes: `Commission für Policy ${contract.policy_number}`,
          });

          console.log(`[automationPipeline] ✅ Accounting entry created: ${accountingEntry.id}`);
        } else {
          console.log(`[automationPipeline] ⏭️ Commission already exists for policy ${contract.id}`);
        }
      } catch (commissionError) {
        console.warn(`[automationPipeline] ⚠️ Commission calculation failed: ${commissionError.message}`);
        // Don't fail the entire pipeline for commission issues
      }
    }

    // ─── FINAL STATE ───
    console.log(`[automationPipeline] ✅ PIPELINE COMPLETE: doc=${document_id} stage=${doc.processing_stage}`);

    return Response.json({
      success: true,
      document_id,
      processing_stage: doc.processing_stage,
      linked_application_id: doc.linked_application_id,
      linked_contract_id: doc.linked_contract_id,
      message: 'Pipeline completed successfully',
    });
  } catch (error) {
    console.error(`[automationPipeline] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});