import { useQuery, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'

export function usePortalData() {
  const customerId = localStorage.getItem('portal_customer_id')
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal-all-data', customerId],
    queryFn: async () => {
      if (!customerId) return null
      const session_token = localStorage.getItem('portal_session_token') || ''
      const res = await base44.functions.invoke('getPortalData', { customer_id: customerId, session_token })
      return res.data
    },
    enabled: !!customerId,
    staleTime: 30_000,       // 30s cache — verhindert Re-Fetch bei jedem Re-Render / Refresh
    gcTime: 5 * 60_000,      // 5min im Cache halten
    retry: 1,                // Weniger Retries = schnelleres Failure-Feedback
    retryDelay: 1500,
  })

  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ['portal-all-data', customerId] })
  }

  return {
    customer: data?.customer || null,
    contracts: data?.contracts || [],
    documents: data?.documents || [],
    applications: data?.applications || [],
    customerId,
    isLoading,
    error,
    refetch,
    invalidateCache,
  }
}

export function yearlyPremium(contract) {
  if (contract.premium_yearly) return contract.premium_yearly
  if (contract.premium_monthly) return contract.premium_monthly * 12
  return 0
}