import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AI CUSTOMER INSIGHTS
 * 
 * Generates a comprehensive AI-powered customer summary including:
 * - Coverage gaps
 * - Upsell opportunities  
 * - Risk assessment
 * - Action recommendations
 * - Cross-selling potential
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customer_id } = await req.json();
    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });
    }

    // Fetch customer data
    const customer = await base44.entities.Customer.get(customer_id);
    if (!customer) {
      return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    }

    // Wenn Hauptkontakt: Alle Familienmitglieder und deren Daten laden
    const isPrimaryCustomer = !customer.is_family_member;
    let contracts = [], tasks = [], applications = [], documents = [];
    let householdMembers = [customer];

    if (isPrimaryCustomer) {
      // Alle Familienmitglieder finden
      const members = await base44.entities.Customer.filter({ primary_customer_id: customer_id });
      householdMembers = [customer, ...members];
      const memberIds = householdMembers.map(m => m.id);
      
      // Alle Daten für alle Haushaltsmitglieder laden
      [contracts, tasks, applications, documents] = await Promise.all([
        Promise.all(memberIds.map(id => base44.entities.Contract.filter({ customer_id: id }))).then(results => results.flat()),
        Promise.all(memberIds.map(id => base44.entities.Task.filter({ customer_id: id }))).then(results => results.flat()),
        Promise.all(memberIds.map(id => base44.entities.Application.filter({ customer_id: id }))).then(results => results.flat()),
        Promise.all(memberIds.map(id => base44.entities.Document.filter({ customer_id: id }))).then(results => results.flat()),
      ]);
    } else {
      // Nur individuelle Daten für Familienmitglied
      [contracts, tasks, applications, documents] = await Promise.all([
        base44.entities.Contract.filter({ customer_id }),
        base44.entities.Task.filter({ customer_id }),
        base44.entities.Application.filter({ customer_id }),
        base44.entities.Document.filter({ customer_id }),
      ]);
    }

    const activeContracts = contracts.filter(c => c.status === 'active');
    const openTasks = tasks.filter(t => t.status !== 'completed');

    // Calculate days to expiry for contracts
    const today = new Date();
    const contractsWithExpiry = activeContracts.map(c => ({
      ...c,
      days_to_expiry: c.end_date
        ? Math.ceil((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
        : null,
    }));

    const soonExpiringContracts = contractsWithExpiry.filter(
      c => c.days_to_expiry !== null && c.days_to_expiry <= 90 && c.days_to_expiry > 0
    );
    const overdueContracts = contractsWithExpiry.filter(
      c => c.days_to_expiry !== null && c.days_to_expiry <= 0
    );

    // Coverage analysis
    const coveredSparten = new Set(
      activeContracts.map(c => c.sparte || c.insurance_type).filter(Boolean)
    );
    const STANDARD_COVERAGE = ['kvg', 'haftpflicht_privat', 'hausrat'];
    const missingCoverage = STANDARD_COVERAGE.filter(s => !coveredSparten.has(s));

    const totalYearlyPremium = activeContracts.reduce(
      (sum, c) => sum + (c.premium_yearly || 0), 0
    );

    // Build context for AI
    const householdInfo = isPrimaryCustomer && householdMembers.length > 1 
      ? `\nHAUSHALT: ${householdMembers.length} Personen (Hauptkontakt + ${householdMembers.length - 1} Familienmitglieder)`
      : '';
    
    const customerContext = `
KUNDE:
Name: ${customer.company_name || `${customer.first_name} ${customer.last_name}`}
Geburtsdatum: ${customer.birthdate || 'unbekannt'}
Beruf: ${customer.profession || 'unbekannt'}
Status: ${customer.status}${householdInfo}
Gesamtprämie Haushalt: CHF ${totalYearlyPremium.toFixed(2)}/Jahr

AKTIVE VERTRÄGE (${activeContracts.length}):
${activeContracts.map(c => `- ${c.insurer}: ${c.sparte || c.insurance_type || c.product || 'Versicherung'}, CHF ${c.premium_yearly || 0}/J., Ablauf: ${c.end_date || '–'}`).join('\n') || 'Keine aktiven Verträge'}

ABLAUFENDE VERTRÄGE (<90 Tage):
${soonExpiringContracts.map(c => `- ${c.insurer} in ${c.days_to_expiry} Tagen`).join('\n') || 'Keine'}

FEHLENDE DECKUNGEN:
${missingCoverage.length > 0 ? missingCoverage.join(', ') : 'Keine offensichtlichen Lücken'}

OFFENE AUFGABEN (${openTasks.length}):
${openTasks.slice(0, 5).map(t => `- ${t.title} (${t.priority})`).join('\n') || 'Keine'}

OFFENE ANTRÄGE: ${applications.filter(a => !['approved', 'rejected'].includes(a.status)).length}
`;

    // Generate AI insights
    const insights = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein erfahrener Schweizer Versicherungsbroker. Analysiere diesen Kunden und erstelle eine strukturierte Analyse.

${customerContext}

Erstelle eine präzise, actionable Analyse mit:
1. priority_score: 0-100 (Priorität für den Broker)
2. risk_level: "niedrig" | "mittel" | "hoch" | "kritisch"
3. summary: Kurze Zusammenfassung (2-3 Sätze) auf Deutsch
4. coverage_gaps: Liste fehlender Versicherungen mit Begründung
5. upsell_opportunities: Konkrete Upsell-Möglichkeiten mit geschätztem Prämienvolumen
6. immediate_actions: Sofortmassnahmen (max. 3, nach Priorität)
7. risk_flags: Warnsignale die sofortige Aufmerksamkeit erfordern
8. next_review_days: Empfohlener nächster Review in X Tagen`,
      response_json_schema: {
        type: 'object',
        properties: {
          priority_score: { type: 'number' },
          risk_level: { type: 'string' },
          summary: { type: 'string' },
          coverage_gaps: {
            type: 'array',
            items: { type: 'object', properties: { coverage: { type: 'string' }, reason: { type: 'string' }, estimated_premium: { type: 'number' } } }
          },
          upsell_opportunities: {
            type: 'array',
            items: { type: 'object', properties: { product: { type: 'string' }, reason: { type: 'string' }, estimated_premium: { type: 'number' } } }
          },
          immediate_actions: {
            type: 'array',
            items: { type: 'object', properties: { action: { type: 'string' }, urgency: { type: 'string' }, deadline: { type: 'string' } } }
          },
          risk_flags: { type: 'array', items: { type: 'string' } },
          next_review_days: { type: 'number' },
        },
        required: ['priority_score', 'risk_level', 'summary', 'immediate_actions']
      },
    });

    // Log the analysis
    await base44.asServiceRole.entities.SystemLog.create({
      level: 'info',
      source: 'aiCustomerInsights',
      message: `AI-Analyse generiert für Kunde ${customer_id}: Score=${insights.priority_score}, Risk=${insights.risk_level}`,
      related_entity_type: 'Customer',
      related_entity_id: customer_id,
    });

    return Response.json({
      success: true,
      customer_id,
      insights,
      context: {
        active_contracts: activeContracts.length,
        total_yearly_premium: totalYearlyPremium,
        soon_expiring: soonExpiringContracts.length,
        overdue_contracts: overdueContracts.length,
        open_tasks: openTasks.length,
        missing_coverage: missingCoverage,
        documents: documents.length,
      },
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`[aiCustomerInsights] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});