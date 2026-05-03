import React from 'react'
import { usePortalData } from '@/hooks/usePortalData'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

export default function PortalCustomerDashboard() {
  const { customer } = usePortalCustomer()
  const { contracts = [], documents = [] } = usePortalData()

  return (
    <div style={{ width: '100%' }}>
      {/* SECTION 1: BEGRÜSSUNG */}
      <section style={{ width: '100%', padding: '40px', backgroundColor: 'transparent' }}>
        {/* Content here */}
      </section>

      {/* SECTION 2: KUNDENDATEN */}
      <section style={{ width: '100%', padding: '40px', backgroundColor: 'transparent' }}>
        {/* Content here */}
      </section>

      {/* SECTION 3: KENNZAHLEN */}
      <section style={{ width: '100%', padding: '40px', backgroundColor: 'transparent' }}>
        {/* Content here */}
      </section>

      {/* SECTION 4: VERTRÄGE */}
      <section style={{ width: '100%', padding: '40px', backgroundColor: 'transparent' }}>
        {/* Content here */}
      </section>

      {/* SECTION 5: DOKUMENTE */}
      <section style={{ width: '100%', padding: '40px', backgroundColor: 'transparent' }}>
        {/* Content here */}
      </section>
    </div>
  )
}