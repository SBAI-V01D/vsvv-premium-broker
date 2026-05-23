import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const level = body.level || 'quick';

    // ── Fetch all relevant data ────────────────────────────────────
    const [customers, contracts, tasks, documents, verkaufschancen] = await Promise.all([
      base44.entities.Customer.filter({ archived: false }, '-updated_date', 500),
      base44.entities.Contract.filter({ archived: false }, '-created_date', 500),
      base44.entities.Task.filter({}, '-created_date', 300),
      base44.entities.Document.list('-uploaded_at', 300),
      base44.entities.Verkaufschance.filter({}, '-created_date', 300),
    ]);

    const primaryCustomers = customers.filter(c => !c.is_family_member);
    const activeContracts = contracts.filter(c => c.status === 'active');
    const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');

    const now = new Date();
    const in90Days = new Date(now); in90Days.setDate(in90Days.getDate() + 90);
    const in180Days = new Date(now); in180Days.setDate(in180Days.getDate() + 180);
    const ago90Days = new Date(now); ago90Days.setDate(ago90Days.getDate() - 90);

    // Helper: customer display name
    const custName = (c) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email;

    // ── Build operative entity lists ───────────────────────────────

    // 1. No advisor
    const noAdvisorCustomers = primaryCustomers
      .filter(c => !c.advisor_id && !c.primary_advisor_id)
      .slice(0, 10)
      .map(c => ({ id: c.id, name: custName(c), detail: `Status: ${c.status}`, link: `/kunden/${c.id}` }));

    // 2. Mandate issues
    const mandateIssueCustomers = primaryCustomers
      .filter(c => ['pending', 'expired', 'invalid'].includes(c.mandate_status))
      .slice(0, 10)
      .map(c => ({ id: c.id, name: custName(c), detail: `Mandat: ${c.mandate_status}`, link: `/kunden/${c.id}` }));

    // 3. Expiring contracts without renewal action
    const expiringNoAction = activeContracts
      .filter(c => c.end_date && new Date(c.end_date) <= in90Days && new Date(c.end_date) >= now && (!c.renewal_status || c.renewal_status === 'none'))
      .slice(0, 10)
      .map(c => {
        const cust = customers.find(cu => cu.id === c.customer_id);
        const daysLeft = Math.ceil((new Date(c.end_date) - now) / 86400000);
        return { id: c.id, name: `${c.insurer} — ${c.product || c.insurance_type}`, detail: `${cust ? custName(cust) : 'Unbekannt'} · Ablauf in ${daysLeft} Tagen`, link: `/vertraege` };
      });

    // 4. Cancelled contracts needing follow-up
    const cancelledContracts = contracts
      .filter(c => c.status === 'cancelled')
      .slice(0, 8)
      .map(c => {
        const cust = customers.find(cu => cu.id === c.customer_id);
        return { id: c.id, name: `${c.insurer} — ${c.product || c.insurance_type}`, detail: cust ? custName(cust) : 'Unbekannt', link: `/kunden/${c.customer_id}` };
      });

    // 5. No activity customers
    const noActivityCustomers = primaryCustomers
      .filter(c => {
        const lastUpdate = new Date(c.updated_date || c.created_date);
        return lastUpdate < ago90Days && c.status === 'active';
      })
      .slice(0, 10)
      .map(c => ({ id: c.id, name: custName(c), detail: `Letzte Aktivität: ${new Date(c.updated_date || c.created_date).toLocaleDateString('de-CH')}`, link: `/kunden/${c.id}` }));

    // 6. Cross-sell gaps (private customers with 3+ missing products)
    const recommendedPrivate = ['kvg', 'vvg_krankenzusatz', 'haftpflicht_privat', 'hausrat', 'rechtsschutz', 'leben', 'reise'];
    const sparteLabels = { kvg: 'KVG', vvg_krankenzusatz: 'VVG Krankenzusatz', haftpflicht_privat: 'Haftpflicht', hausrat: 'Hausrat', rechtsschutz: 'Rechtsschutz', leben: 'Lebensversicherung', reise: 'Reiseversicherung' };
    const crossSellCustomers = primaryCustomers
      .filter(c => c.customer_type !== 'business')
      .map(c => {
        const sparten = new Set(activeContracts.filter(ct => ct.customer_id === c.id).map(ct => ct.sparte || ct.insurance_type));
        const missing = recommendedPrivate.filter(s => !sparten.has(s));
        return { customer: c, missing };
      })
      .filter(x => x.missing.length >= 3)
      .slice(0, 10)
      .map(({ customer, missing }) => ({
        id: customer.id,
        name: custName(customer),
        detail: `Fehlend: ${missing.slice(0, 3).map(s => sparteLabels[s] || s).join(', ')}${missing.length > 3 ? ' +mehr' : ''}`,
        link: `/kunden/${customer.id}/360`
      }));

    // 7. Stale opportunities
    const staleOpps = verkaufschancen
      .filter(v => {
        if (['gewonnen', 'verloren'].includes(v.status)) return false;
        return new Date(v.updated_date || v.created_date) < ago90Days;
      })
      .slice(0, 8)
      .map(v => {
        const cust = customers.find(c => c.id === v.customer_id);
        return { id: v.id, name: v.title || v.sparte, detail: cust ? custName(cust) : 'Unbekannt', link: `/verkaufschancen` };
      });

    // 8. Overdue tasks
    const overdueTasks = openTasks
      .filter(t => t.due_date && new Date(t.due_date) < now)
      .slice(0, 8)
      .map(t => ({
        id: t.id,
        name: t.title,
        detail: `Fällig: ${new Date(t.due_date).toLocaleDateString('de-CH')}${t.customer_name ? ` · ${t.customer_name}` : ''}`,
        link: `/aufgaben`
      }));

    // 9. Contracts without docs
    const contractsNoDocs = activeContracts
      .filter(c => !documents.some(d => d.linked_contract_id === c.id))
      .slice(0, 8)
      .map(c => {
        const cust = customers.find(cu => cu.id === c.customer_id);
        return { id: c.id, name: `${c.insurer} — ${c.product || c.insurance_type}`, detail: cust ? custName(cust) : 'Unbekannt', link: `/dokumente` };
      });

    // 10. Customers without contracts
    const noContractCustomers = primaryCustomers
      .filter(c => !activeContracts.some(ct => ct.customer_id === c.id) && c.status === 'active')
      .slice(0, 8)
      .map(c => ({ id: c.id, name: custName(c), detail: `Aktiver Kunde ohne Vertrag`, link: `/kunden/${c.id}` }));

    // ── Pre-computed findings context ──────────────────────────────
    const operativeContext = {
      no_advisor: { count: noAdvisorCustomers.length + (primaryCustomers.filter(c => !c.advisor_id && !c.primary_advisor_id).length - noAdvisorCustomers.length), entities: noAdvisorCustomers },
      mandate_issues: { count: mandateIssueCustomers.length + (primaryCustomers.filter(c => ['pending','expired','invalid'].includes(c.mandate_status)).length - mandateIssueCustomers.length), entities: mandateIssueCustomers },
      expiring_no_action: { count: expiringNoAction.length, entities: expiringNoAction },
      cancelled_contracts: { count: cancelledContracts.length, entities: cancelledContracts },
      no_activity: { count: noActivityCustomers.length, entities: noActivityCustomers },
      cross_sell_gaps: { count: crossSellCustomers.length, entities: crossSellCustomers },
      stale_opportunities: { count: staleOpps.length, entities: staleOpps },
      overdue_tasks: { count: overdueTasks.length, entities: overdueTasks },
      contracts_no_docs: { count: contractsNoDocs.length, entities: contractsNoDocs },
      no_contract_customers: { count: noContractCustomers.length, entities: noContractCustomers },
    };

    const stats = {
      total_customers: primaryCustomers.length,
      total_active_contracts: activeContracts.length,
      total_open_tasks: openTasks.length,
    };

    const levelInstructions = {
      quick: 'Analysiere NUR: no_advisor, mandate_issues, expiring_no_action, overdue_tasks. Maximal 6 Findings. Nur wenn count > 0.',
      operational: 'Analysiere: no_advisor, mandate_issues, expiring_no_action, cancelled_contracts, no_activity, cross_sell_gaps, stale_opportunities, overdue_tasks. Maximal 12 Findings. Nur wenn count > 0.',
      enterprise: 'Analysiere alle Kategorien vollständig. Maximal 20 Findings. Nur wenn count > 0.',
    };

    const prompt = `Du bist ein operativer Broker-Intelligence-Assistent für eine Schweizer Versicherungsbroker-Plattform.

REVIEW LEVEL: ${level.toUpperCase()}
ANWEISUNG: ${levelInstructions[level]}

OPERATIVE DATEN (vorberechnete Entitäten):
${JSON.stringify(operativeContext, null, 2)}

WICHTIG:
- Erstelle nur Findings für Kategorien mit count > 0
- Jedes Finding muss die betroffenen entities direkt referenzieren (aus den obigen Daten)
- Der Fokus liegt auf operativer Handlungsfähigkeit, nicht auf abstrakten Statistiken
- Sprache: Deutsch, direkt, klar, ohne AI-Jargon
- Keine Findings für leere Kategorien

Je Finding:
- id: string (z.B. "OP-001")
- area: "operative_risiken" | "umsatzpotenziale" | "datenqualitaet" | "prozesse"
- severity: "critical" | "warning" | "opportunity" | "info"
- title: kurzer operativer Titel (max 55 Zeichen)
- explanation: 1-2 Sätze, direkt und operativ
- business_impact: wirtschaftliche Relevanz in einem kurzen Satz
- recommendation: konkrete Handlungsempfehlung
- affected_entities: Array der betroffenen Entitäten (direkt aus den obigen Daten übernehmen, max 5 pro Finding)
- quick_actions: Array von { label: string, type: "open_customer"|"open_contracts"|"create_task"|"open_opportunities"|"open_documents"|"open_tasks", link: string }
- why_ai_suggests: kurze Erklärung der KI-Logik

Antworte NUR mit dem JSON-Objekt { findings: [...] }.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                area: { type: 'string' },
                severity: { type: 'string' },
                title: { type: 'string' },
                explanation: { type: 'string' },
                business_impact: { type: 'string' },
                recommendation: { type: 'string' },
                affected_entities: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, detail: { type: 'string' }, link: { type: 'string' } } } },
                quick_actions: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, type: { type: 'string' }, link: { type: 'string' } } } },
                why_ai_suggests: { type: 'string' },
              }
            }
          }
        }
      }
    });

    return Response.json({
      level,
      stats,
      operative: operativeContext,
      findings: result.findings || [],
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.full_name || user.email,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});