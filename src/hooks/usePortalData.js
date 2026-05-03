import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'

export function usePortalData() {
  const customerId = localStorage.getItem('portal_customer_id')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal-all-data', customerId],
    queryFn: async () => {
      if (!customerId) return null
      const res = await base44.functions.invoke('getPortalData', { customer_id: customerId })
      return res.data
    },
    enabled: !!customerId,
    staleTime: 30_000,
    retry: 2,
  })

  return {
    customer: data?.customer || null,
    contracts: data?.contracts || [],
    documents: data?.documents || [],
    applications: data?.applications || [],
    customerId,
    isLoading,
    error,
    refetch,
  }
}

export function yearlyPremium(contract) {
  if (contract.premium_yearly) return contract.premium_yearly
  if (contract.premium_monthly) return contract.premium_monthly * 12
  return 0
}