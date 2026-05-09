import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

/**
 * Synchronizes commission records when an application is updated.
 * Ensures CommissionEntry records stay in sync with application commission estimates.
 * Called when application status changes or commission_estimate is updated.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { application_id, old_application, new_application } = await req.json()

    if (!application_id || !new_application) {
      return Response.json({ error: 'Missing application data' }, { status: 400 })
    }

    const application = await base44.entities.Application.list().then(apps => 
      apps.find(a => a.id === application_id)
    )

    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 })
    }

    // Calculate commission amount from application
    const yearlyPremium = application.estimated_premium_yearly || 
                         (application.estimated_premium_monthly ? application.estimated_premium_monthly * 12 : 0)
    const commissionRate = application.commission_rate || 0
    const commissionAmount = Math.round((yearlyPremium * (commissionRate / 100)) * 100) / 100

    // Only process if application is accepted and has a linked contract
    const ACCEPTED_STATUSES = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt']
    const isAccepted = ACCEPTED_STATUSES.includes(application.custom_status || application.status)
    
    if (!isAccepted) {
      return Response.json({ 
        success: true, 
        message: 'Application not in accepted status, no commission sync needed',
        status: application.status,
      })
    }

    // Find existing commission entries for this application
    const existingCommissions = await base44.entities.CommissionEntry.filter({
      policy_id: application.linked_contract_id,
    }).catch(() => [])

    // Check if we need to create or update commission entry
    let syncResult = { created: false, updated: false, validated: false, amount: commissionAmount }

    // If linked contract exists and no commission yet, create one
    if (application.linked_contract_id && existingCommissions.length === 0 && commissionAmount > 0) {
      try {
        const newCommission = await base44.entities.CommissionEntry.create({
          policy_id: application.linked_contract_id,
          policy_number: application.policy_number || '',
          advisor_id: application.advisor_id || '',
          organization_id: application.organization_id || '',
          customer_id: application.customer_id,
          customer_name: application.customer_name,
          insurer: application.insurer,
          product_category: application.sparte || application.insurance_type || '',
          premium_yearly: yearlyPremium,
          commission_percentage: commissionRate,
          commission_amount: commissionAmount,
          status: 'pending',
          entry_date: new Date().toISOString().split('T')[0],
        })
        
        syncResult.created = true
        syncResult.commissionId = newCommission.id
        
        // Invalidate commission cache to force dashboard refresh
        await base44.asServiceRole.functions.invoke('updateKPIAdvisor', {
          advisor_id: application.advisor_id,
        }).catch(() => {})
      } catch (err) {
        console.error('Failed to create commission entry:', err.message)
        syncResult.creationError = err.message
      }
    }

    // If commission exists but amount changed, validate they're in sync
    if (existingCommissions.length > 0) {
      const activeCommissions = existingCommissions.filter(c => 
        !c.is_storno && c.status !== 'cancelled'
      )
      
      if (activeCommissions.length > 0) {
        const totalExisting = activeCommissions.reduce((s, c) => 
          s + (c.commission_amount || 0), 0
        )
        
        // Allow 2% variance due to rounding
        const variance = Math.abs(totalExisting - commissionAmount) / (commissionAmount || 1)
        syncResult.validated = variance < 0.02
        syncResult.expectedAmount = commissionAmount
        syncResult.actualAmount = totalExisting
        
        if (!syncResult.validated) {
          console.warn(`Commission mismatch for policy ${application.linked_contract_id}: expected ${commissionAmount}, got ${totalExisting}`)
        }
      }
    }

    return Response.json({
      success: true,
      application: {
        id: application.id,
        status: application.status,
        linkedContract: application.linked_contract_id,
      },
      commission: syncResult,
    })
    
  } catch (error) {
    console.error('Commission sync error:', error)
    return Response.json({ 
      error: error.message,
      success: false,
    }, { status: 500 })
  }
})