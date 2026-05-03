import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function usePortalCustomer() {
  const navigate = useNavigate()
  const customerId = localStorage.getItem('portal_customer_id')

  useEffect(() => {
    if (!customerId) {
      navigate('/portal/setup')
    }
  }, [customerId, navigate])

  const { data: customer, isLoading } = useQuery({
    queryKey: ['portal-customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: !!customerId,
    staleTime: 60_000,
  })

  return { customer, customerId, isLoading }
}

// Helper: load all contracts for a customer (direct + as primary)
export async function fetchPortalContracts(customerId) {
  const [direct, asPrimary] = await Promise.all([
    base44.entities.Contract.filter({ customer_id: customerId }),
    base44.entities.Contract.filter({ primary_customer_id: customerId }),
  ])
  // Merge, deduplicate by id
  const map = {}
  ;[...direct, ...asPrimary].forEach(c => { map[c.id] = c })
  return Object.values(map)
}

// Helper: yearly premium with fallback
export function yearlyPremium(contract) {
  if (contract.premium_yearly) return contract.premium_yearly
  if (contract.premium_monthly) return contract.premium_monthly * 12
  return 0
}