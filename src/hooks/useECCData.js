/**
 * useECCData — Shared Query Cache für alle ECC-Tab-Komponenten
 *
 * Performance:
 * - gcTime erhöht: Komponenten bleiben im Cache auch wenn unmounted
 * - placeholderData: kein Ladeflackern bei Tab-Switch
 * - refetchOnWindowFocus: false für read-heavy Governance-Daten
 * - select: Memoized selectors vermeiden Downstream-Re-Renders
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { base44 } from '@/api/base44Client';

export function useECCIncidents(options = {}) {
  return useQuery({
    queryKey: ['ecc_incidents'],
    queryFn: () => base44.entities.EnterpriseIncident.list('-detected_at', 200),
    staleTime: 2 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useECCCustomers(options = {}) {
  return useQuery({
    queryKey: ['ecc_customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    staleTime: 15 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useECCContracts(options = {}) {
  return useQuery({
    queryKey: ['ecc_contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 500),
    staleTime: 15 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useECCAuditLogs(options = {}) {
  return useQuery({
    queryKey: ['ecc_audit_logs'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 200),
    staleTime: 5 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useECCGovernanceSnapshot(options = {}) {
  return useQuery({
    queryKey: ['ecc_governance_snapshot'],
    queryFn: async () => {
      const snapshots = await base44.entities.GovernanceScoreSnapshot.list('-computed_at', 1);
      return snapshots[0] || null;
    },
    staleTime: 15 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useECCGovernanceHistory(options = {}) {
  return useQuery({
    queryKey: ['ecc_governance_history'],
    queryFn: () => base44.entities.GovernanceScoreSnapshot.list('-computed_at', 30),
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useECCAiFindings(options = {}) {
  return useQuery({
    queryKey: ['ecc_ai_findings'],
    queryFn: () => base44.entities.AiFinding.list('-created_date', 100),
    staleTime: 5 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}

/**
 * useECCIncidentCounts — memoized KPI counts, avoids recalculation in multiple consumers
 */
export function useECCIncidentCounts() {
  const { data: incidents = [] } = useECCIncidents();
  return useMemo(() => ({
    blocking:   incidents.filter(i => i.severity === 'blocking' && ['open','investigating','in_progress'].includes(i.status)).length,
    critical:   incidents.filter(i => i.severity === 'critical' && ['open','investigating','in_progress'].includes(i.status)).length,
    warning:    incidents.filter(i => i.severity === 'warning'  && ['open','investigating','in_progress'].includes(i.status)).length,
    governance: incidents.filter(i => i.governance_block && ['open','investigating','in_progress'].includes(i.status)).length,
    open:       incidents.filter(i => ['open','investigating','in_progress','in_review'].includes(i.status)).length,
    autoFixable:incidents.filter(i => i.auto_fix_possible && !i.governance_block && ['open','investigating','in_progress'].includes(i.status)).length,
  }), [incidents]);
}