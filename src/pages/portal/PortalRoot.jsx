import React, { useEffect, useState } from 'react'
import { base44 } from '@/api/base44Client'
import { useNavigate, Outlet } from 'react-router-dom'
import PortalLayout from '@/components/portal/PortalLayout'

export default function PortalRoot() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const checkAuth = async () => {
      // Check if customer is logged in via portal
      const customerId = localStorage.getItem('portal_customer_id')
      if (!customerId) {
        navigate('/portal/setup')
      } else {
        setIsAuthenticated(true)
      }
      setLoading(false)
    }
    checkAuth()
  }, [navigate])

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Laden...</div>
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  )
}