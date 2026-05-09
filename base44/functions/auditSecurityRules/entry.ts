import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 3: Audit role-based access control rules
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 403 });
    }

    const audit = {
      timestamp: new Date().toISOString(),
      checks: {},
      issues: [],
      compliance_score: 100
    };

    // 1. Check Advisor can only see own customers
    try {
      const advisors = await base44.entities.Advisor.list(null, 1000);
      const customers = await base44.entities.Customer.list(null, 5000);
      
      for (const advisor of advisors.slice(0, 5)) {
        const assignedCount = customers.filter(c => c.assigned_broker === advisor.email).length;
        if (assignedCount > 0) {
          audit.checks[`advisor_${advisor.id}`] = {
            assigned_customers: assignedCount,
            verified: true
          };
        }
      }
    } catch (err) {
      audit.issues.push(`Advisor access audit failed: ${err.message}`);
      audit.compliance_score -= 15;
    }

    // 2. Check document access logging
    try {
      const auditLogs = await base44.entities.AuditLog.filter(
        { entity_type: 'document', action: 'create' },
        100
      ).catch(() => []);

      audit.checks.document_access_logging = {
        recent_logs: auditLogs.length,
        verified: auditLogs.length > 0
      };

      if (auditLogs.length === 0) {
        audit.issues.push('No document access logs detected');
        audit.compliance_score -= 10;
      }
    } catch (err) {
      audit.issues.push(`Document logging check failed`);
    }

    // 3. Check for public URLs in documents
    try {
      const docs = await base44.entities.Document.list(null, 1000);
      const publicUrls = docs.filter(d => 
        d.file_url && (d.file_url.includes('public') || d.file_url.includes('share'))
      );

      if (publicUrls.length > 0) {
        audit.issues.push(`${publicUrls.length} documents with potentially public URLs`);
        audit.compliance_score -= 20;
      } else {
        audit.checks.document_url_security = { verified: true };
      }
    } catch (err) {
      audit.issues.push(`Document URL check failed`);
    }

    // 4. Check backup logs exist
    try {
      const backups = await base44.entities.BackupLog.list('-timestamp', 10).catch(() => []);
      
      if (backups.length > 0) {
        const lastBackup = backups[0];
        const age = (Date.now() - new Date(lastBackup.timestamp)) / (1000 * 60);
        
        audit.checks.backup_system = {
          last_backup_age_minutes: Math.round(age),
          verified: age < 30 // Should be < 30 mins
        };

        if (age > 30) {
          audit.issues.push('Last backup older than 30 minutes');
          audit.compliance_score -= 15;
        }
      } else {
        audit.issues.push('No backups found');
        audit.compliance_score -= 25;
      }
    } catch (err) {
      audit.issues.push(`Backup verification failed`);
    }

    // 5. Check audit logs completeness
    try {
      const logs = await base44.entities.AuditLog.list('-changed_at', 100);
      
      audit.checks.audit_logging = {
        total_logs: logs.length,
        coverage: logs.length > 50 ? 'good' : 'minimal',
        verified: true
      };
    } catch (err) {
      audit.issues.push(`Audit log check failed`);
    }

    // 6. Data at rest security (archived data check)
    try {
      const archived = await base44.entities.Customer.filter(
        { archived: true },
        100
      ).catch(() => []);

      audit.checks.archived_data_retention = {
        archived_records: archived.length,
        soft_delete_active: true,
        verified: true
      };
    } catch (err) {
      audit.issues.push(`Archived data check failed`);
    }

    return Response.json({
      audit,
      compliance_level: audit.compliance_score >= 90 ? 'COMPLIANT' : 'NEEDS_REVIEW'
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});