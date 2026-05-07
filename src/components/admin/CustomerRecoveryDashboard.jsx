import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'

export default function CustomerRecoveryDashboard() {
  const [step, setStep] = useState(0) // 0: relations, 1: reconstruct, 2: validate, 3: diagnose, 4: fix
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const steps = [
    { name: 'Scan Relations', fn: 'reconstructCustomersFromRelations' },
    { name: 'Reconstruct Customers', fn: 'reconstructAndRestoreCustomers' },
    { name: 'Validate Integrity', fn: 'validateSystemIntegrity' },
    { name: 'Diagnose Visibility', fn: 'diagnoseCustomerVisibility' },
    { name: 'Force Visibility', fn: 'forceCustomerVisibility' }
  ]

  const runStep = async (stepIndex) => {
    setLoading(true)
    setError(null)
    try {
      let payload = {}
      
      if (stepIndex === 1 && results?.data?.summary) {
        // Pass reconstruction report to step 2
        payload.reconstruction_report = results.data
      }
      
      if (stepIndex === 4 && results?.data?.visibility_issues?.potentially_hidden_details) {
        // Pass visibility issues to step 5
        payload.target_customers = results.data.visibility_issues.potentially_hidden_details
      }

      const response = await base44.functions.invoke(steps[stepIndex].fn, payload)
      setResults(response.data)
      setStep(stepIndex + 1)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Customer Recovery Dashboard</h1>
        <p className="text-muted-foreground">Multi-step recovery process for deleted customers</p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-4">
        {steps.map((s, idx) => (
          <Card 
            key={idx} 
            className={`cursor-pointer transition-colors ${
              step > idx ? 'bg-green-50 border-green-200' : 
              step === idx ? 'bg-blue-50 border-blue-200' : 
              'bg-gray-50'
            }`}
            onClick={() => idx <= step && setStep(idx)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{s.name}</CardTitle>
                {step > idx && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                {step === idx && loading && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
              </div>
            </CardHeader>
            
            {step === idx && (
              <CardContent className="space-y-4">
                {error && (
                  <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
                
                {results && (
                  <div className="space-y-3 bg-white p-3 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(results.summary || {}).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="font-semibold">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={() => runStep(idx)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Running...' : `Run: ${s.name}`}
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Final Status */}
      {step === steps.length && results && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="w-5 h-5" />
              Recovery Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-green-800">
            <p>✓ All recovery steps completed successfully</p>
            <p>✓ Customers restored and visible</p>
            <p>✓ Relations validated</p>
            <Button 
              variant="outline"
              onClick={() => {
                setStep(0)
                setResults(null)
                setError(null)
              }}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Start Over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}