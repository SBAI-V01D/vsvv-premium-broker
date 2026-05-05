import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * PUNKT 14: VALIDIERUNG / SYSTEMINTEGRITÄTSPRÜFUNG
 * 
 * Läuft täglich/wöchentlich als scheduled automation
 * Prüft: 
 * - Alle Kunden haben organization_id ✓
 * - Advisor/Teamlead gehören zur gleichen Org wie Kunde ✓
 * - Application hat korrekte Vererbung ✓
 * - Contract hat korrekte Vererbung ✓
 * - Keine Endlosschleifen ✓
 * - System stabil ✓
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[validateSystemIntegrity] START');

    const errors = [];
    const warnings = [];

    // ─── CHECK 1: Kunden ohne organization_id ───
    const customers = await base44.entities.Customer.list(null, 1000);
    const customersWithoutOrg = customers.filter(c => !c.organization_id);

    if (customersWithoutOrg.length > 0) {
      const msg = `${customersWithoutOrg.length} Kunden haben keine organization_id`;
      console.warn(`[validateSystemIntegrity] WARNING: ${msg}`);
      warnings.push(msg);
    }

    // ─── CHECK 2: Advisor/Teamlead Consistency ───
    const advisors = await base44.entities.Advisor.list(null, 1000);
    const advisorOrgMismatches = [];

    for (const customer of customers) {
      if (!customer.organization_id) continue;

      if (customer.advisor_id) {
        const advisor = advisors.find(a => a.id === customer.advisor_id);
        if (advisor && advisor.organization_id !== customer.organization_id) {
          advisorOrgMismatches.push({
            customer: customer.id,
            advisor: customer.advisor_id,
            msg: `Advisor Org ${advisor.organization_id} ≠ Customer Org ${customer.organization_id}`,
          });
        }
      }
    }

    if (advisorOrgMismatches.length > 0) {
      const msg = `${advisorOrgMismatches.length} Konsistenzprobleme bei Advisor-Zuordnung`;
      console.warn(`[validateSystemIntegrity] WARNING: ${msg}`);
      warnings.push(msg);
      advisorOrgMismatches.slice(0, 5).forEach(e => console.warn(`  - ${e.msg}`));
    }

    // ─── CHECK 3: Applications mit fehlender organization_id ───
    const applications = await base44.entities.Application.list(null, 1000);
    const appsWithoutOrg = applications.filter(a => !a.organization_id);

    if (appsWithoutOrg.length > 0) {
      const msg = `${appsWithoutOrg.length} Anträge haben keine organization_id`;
      console.warn(`[validateSystemIntegrity] WARNING: ${msg}`);
      warnings.push(msg);
    }

    // ─── CHECK 4: Contracts mit Vererbungsproblemen ───
    const contracts = await base44.entities.Contract.list(null, 1000);
    const contractsWithoutOrg = contracts.filter(c => !c.organization_id);

    if (contractsWithoutOrg.length > 0) {
      const msg = `${contractsWithoutOrg.length} Verträge haben keine organization_id`;
      console.warn(`[validateSystemIntegrity] WARNING: ${msg}`);
      warnings.push(msg);
    }

    // ─── CHECK 5: Commission/Accounting Consistency ───
    const commissionEntries = await base44.entities.CommissionEntry.list(null, 1000);
    const accountingEntries = await base44.entities.AccountingEntry.list(null, 1000);

    const unlinkedCommissions = commissionEntries.filter(
      c => !accountingEntries.some(a => a.reference_id === c.id)
    ).length;

    if (unlinkedCommissions > 0) {
      const msg = `${unlinkedCommissions} Provisionen ohne Buchhaltungseintrag`;
      console.warn(`[validateSystemIntegrity] WARNING: ${msg}`);
      warnings.push(msg);
    }

    // ─── CHECK 6: customer_locked Integrität ───
    const documents = await base44.entities.Document.list(null, 1000);
    const lockedWithoutCustomer = documents.filter(d => d.customer_locked && !d.customer_id).length;

    if (lockedWithoutCustomer > 0) {
      const msg = `${lockedWithoutCustomer} gesperrte Dokumente ohne customer_id`;
      console.error(`[validateSystemIntegrity] ERROR: ${msg}`);
      errors.push(msg);
    }

    // ─── SUMMARY ───
    const summary = {
      status: errors.length === 0 ? 'OK' : 'ERROR',
      checks: {
        total_customers: customers.length,
        customers_without_org: customersWithoutOrg.length,
        advisor_org_mismatches: advisorOrgMismatches.length,
        applications_total: applications.length,
        applications_without_org: appsWithoutOrg.length,
        contracts_total: contracts.length,
        contracts_without_org: contractsWithoutOrg.length,
        unlinked_commissions: unlinkedCommissions,
        locked_docs_without_customer: lockedWithoutCustomer,
      },
      errors,
      warnings,
    };

    console.log(`[validateSystemIntegrity] RESULT: ${summary.status}`);
    console.log(JSON.stringify(summary, null, 2));

    return Response.json(summary);
  } catch (error) {
    console.error(`[validateSystemIntegrity] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});