/**
 * useECCData — Shared Query Cache für alle ECC-Tab-Komponenten
 * 
 * Verhindert Query-Deduplication-Probleme: Jede Tab-Komponente kann
 * diesen Hook nutzen — React Query dedupliciert automatisch identische queryKeys.
 * 
 * staleTime-Strategie:
 *  - Incidents:  2min  (operativ kritisch, muss frisch sein)
 *  - Customers:  10min (ändert sich selten)
 *  - Contracts:  10min
 *  - AuditLogs:  5min
 *  - Score:      15min (täglicher Job liefert Snapshot)
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useECCIncidents(options = {}) {
  return useQuery({
    queryKey: ['ecc_incidents'],
    queryFn: () => base44.entities.EnterpriseIncident.list('-detected_at', 200),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

export function useECCCustomers(options = {}) {
  return useQuery({
    queryKey: ['ecc_customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}

export function useECCContracts(options = {}) {
  return useQuery({
    queryKey: ['ecc_contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 500),
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}

export function useECCAuditLogs(options = {}) {
  return useQuery({
    queryKey: ['ecc_audit_logs'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 200),
    staleTime: 5 * 60 * 1000,
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
    ...options,
  });
}

export function useECCAiFindings(options = {}) {
  return useQuery({
    queryKey: ['ecc_ai_findings'],
    queryFn: () => base44.entities.AiFinding.list('-created_date', 100),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}