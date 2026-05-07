import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * VISIBILITY ANALYZER - ADMIN DIAGNOSTIC
 * Identifies which visibility constraint is causing data to be hidden.
 * Used only during recovery — purely diagnostic, no modifications.
 */
export default function VisibilityAnalyzer() {
  const [expandedIssue, setExpandedIssue] = useState(null)

  // Raw unfiltered customers
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['raw-all-customers'],
    queryFn: async () => {
      try {
        return await base44.entities.Customer.list('', 1000)
      } catch (e) {
        console.error('Failed to load customers:', e)
        return []
      }
    },
  })

  // Analyze visibility constraints
  const issues = {
    missingOrgId: {
      label: 'Missing organization_id',
      count: allCustomers.filter(c => !c.organization_id).length,
      severity: 'critical',
      description: 'Customers without organization assignment are hidden by enterprise filters',
      sample: allCustomers.filter(c => !c.organization_id).slice(0, 3),
    },
    archived: {
      label: 'Archived customers',
      count: allCustomers.filter(c => c.archived).length,
      severity: 'high',
      description: 'Archived customers are hidden from normal views',
      sample: allCustomers.filter(c => c.archived).slice(0, 3),
    },
    inactiveStatus: {
      label: 'Inactive status',
      count: allCustomers.filter(c => c.status !== 'active').length,
      severity: 'medium',
      description: 'Non-active customers may be filtered from dashboards',
      sample: allCustomers.filter(c => c.status !== 'active').slice(0, 3),
    },
    missingMandateStatus: {
      label: 'Missing/invalid mandate_status',
      count: allCustomers.filter(c => !c.mandate_status).length,
      severity: 'medium',
      description: 'Portal access restrictions may hide these customers',
      sample: allCustomers.filter(c => !c.mandate_status).slice(0, 3),
    },
    noAdvisor: {
      label: 'No advisor assigned',
      count: allCustomers.filter(c => !c.advisor_id).length,
      severity: 'low',
      description: 'Broker role users cannot see customers without advisor assignment',
      sample: allCustomers.filter(c => !c.advisor_id).slice(0, 3),
    },
    reconstructedEmail: {
      label: 'Reconstructed email (@reconstructed.local)',
      count: allCustomers.filter(c => c.email?.includes('reconstructed')).length,
      severity: 'medium',
      description: 'Indicator of data recovery — may cause visibility issues',
      sample: allCustomers.filter(c => c.email?.includes('reconstructed')).slice(0, 3),
    },
  }

  // Sort by severity and count
  const sortedIssues = Object.entries(issues)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const severityDiff = severityOrder[a[1].severity] - severityOrder[b[1].severity]
      return severityDiff !== 0 ? severityDiff : b[1].count - a[1].count
    })

  return (
    <div className="space-y-4">
      <Card className="border-2 border-red-300 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertCircle className="w-5 h-5" />
            Visibility Constraint Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-white rounded border border-red-200">
            <p className="text-sm font-medium text-red-900">Total Customers in Database:</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{allCustomers.length}</p>
            <p className="text-xs text-red-700 mt-2">
              These exist physically. If 0, data loss confirmed. If &gt;0, visibility issue only.
            </p>
          </div>

          {allCustomers.length === 0 ? (
            <div className="p-3 bg-red-100 border border-red-400 rounded">
              <p className="text-sm font-semibold text-red-900">⚠️ DATA LOSS DETECTED</p>
              <p className="text-xs text-red-800 mt-1">Zero customers found. Restoration required.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-900">Visibility Issues Found:</p>
              {sortedIssues.map(([key, issue]) => (
                <div
                  key={key}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    issue.count > 0
                      ? 'bg-white border-red-200 hover:bg-red-50'
                      : 'bg-green-50 border-green-200 opacity-60'
                  }`}
                  onClick={() => setExpandedIssue(expandedIssue === key ? null : key)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">{issue.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {issue.count === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <span
                          className={`text-sm font-bold px-2 py-1 rounded ${
                            issue.severity === 'critical'
                              ? 'bg-red-600 text-white'
                              : issue.severity === 'high'
                              ? 'bg-orange-500 text-white'
                              : 'bg-yellow-500 text-white'
                          }`}
                        >
                          {issue.count}
                        </span>
                      )}
                    </div>
                  </div>

                  {expandedIssue === key && issue.sample.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs space-y-1">
                      <p className="font-semibold text-gray-700">Sample:</p>
                      {issue.sample.map((c, i) => (
                        <div key={i} className="bg-gray-50 p-1 rounded text-gray-600">
                          {c.first_name} {c.last_name} ({c.email})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}