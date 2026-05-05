import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CREATE CEO DASHBOARD DATA (mc017, mc018, mc019, mc020, mc021)
 * 
 * Aggregates:
 * - Total Premium
 * - Total Commission (earned)
 * - Paid Commission
 * - Open Commission
 * - Storno Losses
 * - Top Advisors
 * - Forecast (avg last 3 months * 12)
 * - Company Overview
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[createCEODashboard] COMPILE CEO data`);

    // ─── FETCH ALL DATA ───
    const contracts = await base44.entities.Contract.filter({
      status: 'active',
    });

    const commissions = await base44.entities.CommissionEntry.filter({});
    const advisors = await base44.entities.Advisor.filter({});
    const customers = await base44.entities.Customer.filter({});

    // ─── 1. TOTAL PREMIUM ───
    let totalPremium = 0;
    for (const contract of contracts) {
      totalPremium += contract.premium_yearly || 0;
    }

    // ─── 2. COMMISSION METRICS ───
    let totalCommission = 0;
    let paidCommission = 0;
    let openCommission = 0;
    let stornoLosses = 0;

    const monthlyCommissions = {};

    for (const comm of commissions) {
      if (comm.is_storno) {
        stornoLosses += Math.abs(comm.commission_amount || 0);
      } else if (comm.status === 'cancelled') {
        // Skip cancelled
      } else {
        const amount = comm.commission_amount || 0;

        if (['earned', 'pending', 'invoiced', 'received'].includes(comm.status)) {
          totalCommission += amount;
        }

        if (comm.status === 'paid') {
          paidCommission += amount;
        }
      }

      // Monthly tracking for forecast
      if (comm.entry_date) {
        const month = comm.entry_date.substring(0, 7);
        monthlyCommissions[month] = (monthlyCommissions[month] || 0) + (comm.commission_amount || 0);
      }
    }

    openCommission = totalCommission - paidCommission;

    // ─── 3. FORECAST (avg last 3 months * 12) ───
    const sortedMonths = Object.keys(monthlyCommissions).sort().reverse();
    let forecast = 0;

    if (sortedMonths.length >= 3) {
      const last3 = [
        monthlyCommissions[sortedMonths[0]] || 0,
        monthlyCommissions[sortedMonths[1]] || 0,
        monthlyCommissions[sortedMonths[2]] || 0,
      ];
      const avg = last3.reduce((a, b) => a + b, 0) / 3;
      forecast = Math.round(avg * 12);
    } else if (sortedMonths.length > 0) {
      const avg = sortedMonths.reduce((sum, m) => sum + monthlyCommissions[m], 0) / sortedMonths.length;
      forecast = Math.round(avg * 12);
    }

    // ─── 4. TOP ADVISORS ───
    const advisorMetrics = {};

    for (const comm of commissions) {
      if (comm.advisor_id && !comm.is_storno && comm.status !== 'cancelled') {
        if (!advisorMetrics[comm.advisor_id]) {
          advisorMetrics[comm.advisor_id] = {
            advisor_id: comm.advisor_id,
            advisor_name: comm.advisor_name,
            revenue: 0,
            commission: 0,
            policies: new Set(),
          };
        }

        advisorMetrics[comm.advisor_id].commission += comm.commission_amount || 0;
        if (comm.policy_id) {
          advisorMetrics[comm.advisor_id].policies.add(comm.policy_id);
        }
      }
    }

    const topAdvisors = Object.values(advisorMetrics)
      .map(a => ({
        ...a,
        policies: a.policies.size,
      }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 5);

    // ─── 5. COMPANY OVERVIEW ───
    const activeCustomers = customers.filter(c => c.status === 'active').length;
    const activePolicies = contracts.length;

    console.log(
      `[createCEODashboard] ✅ COMPILED: premium=${totalPremium} commission=${totalCommission} forecast=${forecast}`
    );

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      kpi: {
        total_premium: totalPremium,
        total_commission: totalCommission,
        paid_commission: paidCommission,
        open_commission: openCommission,
        storno_losses: stornoLosses,
        forecast_12months: forecast,
      },
      company: {
        active_customers: activeCustomers,
        active_policies: activePolicies,
        total_advisors: advisors.length,
      },
      top_advisors: topAdvisors,
      monthly_history: monthlyCommissions,
    });
  } catch (error) {
    console.error(`[createCEODashboard] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});