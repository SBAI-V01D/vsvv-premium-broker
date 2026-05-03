import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function usePortalCustomer() {
  const navigate = useNavigate()
  const customerId = localStorage.getItem('portal_customer_id')

  useEffect(() => {
    if (!customerId) navigate('/portal/setup')
  }, [customerId, navigate])

  const { data: customer, isLoading } = useQuery({
    queryKey: ['portal-customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: !!customerId,
    staleTime: 60_000,
  })

  return { customer, customerId, isLoading }
}

// Merge two arrays by id, deduplicating
function mergeById(a, b) {
  const map = {}
  ;[...a, ...b].forEach(x => { map[x.id] = x })
  return Object.values(map)
}

// Contracts: direct + as primary customer
export async function fetchPortalContracts(customerId) {
  const [direct, asPrimary] = await Promise.all([
    base44.entities.Contract.filter({ customer_id: customerId }),
    base44.entities.Contract.filter({ primary_customer_id: customerId }),
  ])
  return mergeById(direct, asPrimary)
}

// Applications: direct + as primary customer
export async function fetchPortalApplications(customerId) {
  const [direct, asPrimary] = await Promise.all([
    base44.entities.Application.filter({ customer_id: customerId }),
    base44.entities.Application.filter({ primary_customer_id: customerId }),
  ])
  return mergeById(direct, asPrimary)
}

// Documents: direct + as primary customer, only portal-visible
export async function fetchPortalDocuments(customerId) {
  const [direct, asPrimary] = await Promise.all([
    base44.entities.Document.filter({ customer_id: customerId }),
    base44.entities.Document.filter({ primary_customer_id: customerId }),
  ])
  return mergeById(direct, asPrimary).filter(d => d.visible_in_portal !== false)
}

// Yearly premium with fallback
export function yearlyPremium(contract) {
  if (contract.premium_yearly) return contract.premium_yearly
  if (contract.premium_monthly) return contract.premium_monthly * 12
  return 0
}