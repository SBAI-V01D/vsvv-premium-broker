import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const entries = await base44.entities.CommissionEntry.list(null, 5000)
    const normalized = entries.map(e => ({
      ...e,
      company_courtage_amount: e.company_courtage_amount || e.received_amount || 0,
      courtage_storno_percentage: e.courtage_storno_percentage || 10,
      provision_storno_percentage: e.provision_storno_percentage || 10,
    }))

    const tests = {
      courtageCalc: normalized.filter(e => {
        if (!e.company_courtage_amount || !e.advisor_courtage_percentage) return false
        const expected = (e.company_courtage_amount * e.advisor_courtage_percentage / 100)
        return Math.abs((e.advisor_courtage_amount || 0) - expected) > 1
      }).length,
      provisionCalc: normalized.filter(e => {
        if (!e.company_provision_amount || !e.advisor_provision_percentage) return false
        const expected = (e.company_provision_amount * e.advisor_provision_percentage / 100)
        return Math.abs((e.advisor_provision_amount || 0) - expected) > 1
      }).length,
      nettoCalc: normalized.filter(e => {
        const brutto = e.advisor_courtage_amount || 0
        const reserve = e.courtage_storno_amount || 0
        const expected = brutto - reserve
        return brutto > 0 && Math.abs((e.courtage_payout_amount || 0) - expected) > 1
      }).length,
    }

    const passed = Object.values(tests).every(v => v === 0)

    return Response.json({
      status: passed ? 'PASS' : 'FAIL',
      tests,
      timestamp: new Date().toISOString(),
      entriesChecked: entries.length,
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})