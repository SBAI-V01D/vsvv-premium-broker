import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useMemo } from 'react'

/**
 * HOOK: Aggregiert alle Metriken für Dashboard
 * Nutzt bestehende Entities, keine Datenveränderungen
 */
export function useDashboardMetrics(filters = {}) {
  const { month, advisor_id, organization_id } = filters

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list(),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
  })

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
  })

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissionEntries'],
    queryFn: () => base44.entities.CommissionEntry.list(),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list(),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  // ─── AGGREGATION ───
  const metrics = useMemo(() => {
    // Filter anwenden
    const filterFn = (item) => {
      if (advisor_id && item.advisor_id !== advisor_id) return false
      if (organization_id && item.organization_id !== organization_id) return false
      return true
    }

    const filteredContracts = contracts.filter(filterFn)
    const filteredApps = applications.filter(filterFn)
    const filteredLeads = leads.filter(filterFn)
    const filteredCommissions = commissions.filter(filterFn)

    // ─── KPI: CUSTOMERS ───
    const totalCustomers = customers.length
    const activeCustomers = customers.filter(c => c.status === 'active').length
    const portalUsers = customers.filter(c => c.portal_enabled).length

    // ─── KPI: POLICIES ───
    const activePolicies = filteredContracts.filter(c => c.status === 'active').length
    const renewalDue = filteredContracts.filter(
      c => c.status === 'active' && c.renewal_status !== 'completed'
    ).length

    // ─── KPI: APPLICATIONS ───
    const newApps = filteredApps.filter(a => a.status === 'draft').length
    const inProgressApps = filteredApps.filter(
      a => a.status === 'submitted' || a.status === 'under_review'
    ).length
    const approvedApps = filteredApps.filter(a => a.status === 'approved').length
    const rejectedApps = filteredApps.filter(a => a.status === 'rejected').length

    // ─── KPI: TASKS ───
    const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length

    // ─── KPI: LEADS ───
    const totalLeads = filteredLeads.length
    const convertedLeads = filteredLeads.filter(l => l.status === 'converted').length
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads * 100).toFixed(1) : 0

    // ─── KPI: PREMIUM & COMMISSION ───
    const totalPremium = filteredContracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.premium_yearly || 0), 0)

    const totalCommission = filteredCommissions.reduce(
      (sum, c) => sum + (c.commission_amount || 0),
      0
    )

    const receivedCommission = filteredCommissions
      .filter(c => c.status === 'received' || c.status === 'paid')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    const paidCommission = filteredCommissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    const openCommission = totalCommission - paidCommission

    // ─── KPI: PRICING ───
    const highPricingPolicies = filteredContracts.filter(c => c.pricing_status === 'high').length

    // ─── PIPELINE STATUS ───
    const pipelineByStage = {}
    documents.forEach(d => {
      const stage = d.processing_stage || 'uploaded'
      pipelineByStage[stage] = (pipelineByStage[stage] || 0) + 1
    })

    // ─── ADVISOR PERFORMANCE ───
    const advisorPerformance = advisors
      .map(advisor => {
        const advContracts = filteredContracts.filter(c => c.advisor_id === advisor.id)
        const advCommissions = filteredCommissions.filter(c => c.advisor_id === advisor.id)
        const advLeads = filteredLeads.filter(l => l.advisor_id === advisor.id)

        return {
          advisor_id: advisor.id,
          advisor_name: `${advisor.firstname} ${advisor.lastname}`,
          customers: advContracts.map(c => c.customer_id).filter((v, i, a) => a.indexOf(v) === i)
            .length,
          policies: advContracts.length,
          revenue: advContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0),
          commission: advCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0),
          leads: advLeads.length,
        }
      })
      .sort((a, b) => b.commission - a.commission)

    // ─── ALERTS/RISKS ───
    const alerts = []

    // Stuck documents
    if (pipelineByStage['stuck'] > 0) {
      alerts.push({
        type: 'danger',
        message: `${pipelineByStage['stuck']} Dokument(e) stecken fest`,
      })
    }

    // Renewal overdue
    const overdueRenewals = filteredContracts.filter(
      c => c.status === 'active' && new Date(c.end_date) < new Date()
    ).length
    if (overdueRenewals > 0) {
      alerts.push({
        type: 'warning',
        message: `${overdueRenewals} Verträge überfällig zur Verlängerung`,
      })
    }

    // High pricing opportunities
    if (highPricingPolicies > 0) {
      alerts.push({
        type: 'info',
        message: `${highPricingPolicies} Preisoptimierungs-Chancen verfügbar`,
      })
    }

    return {
      customers: { total: totalCustomers, active: activeCustomers, portal: portalUsers },
      policies: { active: activePolicies, renewalDue },
      applications: { new: newApps, inProgress: inProgressApps, approved: approvedApps, rejected: rejectedApps },
      tasks: { open: openTasks },
      leads: { total: totalLeads, converted: convertedLeads, conversionRate },
      premium: { total: Math.round(totalPremium) },
      commission: {
        total: Math.round(totalCommission),
        received: Math.round(receivedCommission),
        paid: Math.round(paidCommission),
        open: Math.round(openCommission),
      },
      pipeline: pipelineByStage,
      advisors: advisorPerformance,
      alerts,
      contracts: filteredContracts,
      applications: filteredApps,
      leads: filteredLeads,
    }
  }, [
    customers,
    contracts,
    applications,
    tasks,
    leads,
    commissions,
    documents,
    advisors,
    advisor_id,
    organization_id,
  ])

  return metrics
}