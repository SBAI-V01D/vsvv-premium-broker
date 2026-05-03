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
  })

  return { customer, customerId, isLoading }
}