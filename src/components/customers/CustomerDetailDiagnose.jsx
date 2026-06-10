import React, { useEffect, useState } from 'react'
import { base44 } from '@/api/base44Client'

/**
 * CustomerDetail Diagnose-Tool
 * Misst tatsächliche Ladezeiten aller Datenquellen und Render-Zeiten
 */
export function useCustomerDetailDiagnose(customerId) {
  const [diagnose, setDiagnose] = useState({
    startTime: null,
    customerLoaded: null,
    contractsLoaded: null,
    applicationsLoaded: null,
    documentsLoaded: null,
    tasksLoaded: null,
    advisorsLoaded: null,
    organizationsLoaded: null,
    allDataLoaded: null,
    totalRenderTime: null,
    dataFlowIssues: [],
  })

  useEffect(() => {
    if (!customerId) return

    const start = Date.now()
    setDiagnose(prev => ({ ...prev, startTime: start }))

    const timings = {}

    // Performance Observer für API-Calls
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('api/base44') || entry.name.includes('entities')) {
          const url = new URL(entry.name)
          const entity = url.pathname.split('/').pop()
          if (!timings[entity]) {
            timings[entity] = entry.duration
          }
        }
      })
    })

    observer.observe({ entryTypes: ['resource', 'measure'] })

    return () => observer.disconnect()
  }, [customerId])

  const markLoaded = (key) => {
    const now = Date.now()
    setDiagnose(prev => {
      const updated = { ...prev, [key]: now }
      if (key === 'allDataLoaded') {
        updated.totalRenderTime = now - prev.startTime
      }
      return updated
    })
  }

  const checkDataFlow = async () => {
    const issues = []
    const start = Date.now()

    try {
      // Test 1: Customer Direct Load
      const customerStart = Date.now()
      const customer = await base44.entities.Customer.filter({ id: customerId }, null, 1)
      const customerTime = Date.now() - customerStart
      if (!customer || customer.length === 0) {
        issues.push({ type: 'CRITICAL', message: 'Kunde nicht gefunden', time: customerTime })
      } else if (customerTime > 500) {
        issues.push({ type: 'WARNING', message: `Kunde lädt langsam (${customerTime}ms)`, time: customerTime })
      }

      // Test 2: Contracts Load
      const contractsStart = Date.now()
      const contracts = await base44.entities.Contract.filter({ customer_id: customerId, archived: false })
      const contractsTime = Date.now() - contractsStart
      if (contractsTime > 500) {
        issues.push({ type: 'WARNING', message: `Verträge laden langsam (${contractsTime}ms)`, time: contractsTime })
      }

      // Test 3: Check if customer is family member
      if (customer[0]?.is_family_member && !customer[0]?.primary_customer_id) {
        issues.push({ type: 'CRITICAL', message: 'Familienmitglied ohne primary_customer_id', time: 0 })
      }

      // Test 4: If family member, check primary customer load
      if (customer[0]?.is_family_member && customer[0]?.primary_customer_id) {
        const primaryStart = Date.now()
        const primary = await base44.entities.Customer.filter({ id: customer[0].primary_customer_id }, null, 1)
        const primaryTime = Date.now() - primaryStart
        if (!primary || primary.length === 0) {
          issues.push({ type: 'CRITICAL', message: 'Hauptkunde nicht gefunden', time: primaryTime })
        } else if (primaryTime > 500) {
          issues.push({ type: 'WARNING', message: `Hauptkunde lädt langsam (${primaryTime}ms)`, time: primaryTime })
        }
      }

      // Test 5: Advisors Load
      const advisorsStart = Date.now()
      const advisors = await base44.entities.Advisor.list()
      const advisorsTime = Date.now() - advisorsStart
      if (advisorsTime > 1000) {
        issues.push({ type: 'WARNING', message: `Berater laden langsam (${advisorsTime}ms)`, time: advisorsTime })
      }

    } catch (error) {
      issues.push({ type: 'ERROR', message: `Test fehlgeschlagen: ${error.message}`, time: Date.now() - start })
    }

    setDiagnose(prev => ({ ...prev, dataFlowIssues: issues }))
    return issues
  }

  return { diagnose, markLoaded, checkDataFlow }
}

export default function CustomerDetailDiagnose({ customerId, diagnose, checkDataFlow }) {
  const [expanded, setExpanded] = useState(false)
  const [testResults, setTestResults] = useState(null)
  const [isTesting, setIsTesting] = useState(false)

  const runTests = async () => {
    setIsTesting(true)
    const results = await checkDataFlow()
    setTestResults(results)
    setIsTesting(false)
  }

  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString('de-CH') + '.' + String(ts % 1000).padStart(3, '0') : '–'
  const formatDuration = (start, end) => {
    if (!start || !end) return '–'
    return `${end - start}ms`
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors shadow-lg"
      >
        🔍 Diagnose {expanded ? '▼' : '▲'}
      </button>

      {expanded && (
        <div className="mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">CustomerDetail Ladezeiten</h3>
              <button
                onClick={runTests}
                disabled={isTesting}
                className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {isTesting ? 'Teste...' : 'Tests starten'}
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {/* Timeline */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Lade-Timeline</p>
              <div className="grid grid-cols-[100px_1fr] gap-2 text-xs">
                <div className="text-slate-600">Start:</div>
                <div className="font-mono">{formatTime(diagnose.startTime)}</div>

                <div className="text-slate-600">Kunde:</div>
                <div className="font-mono">
                  {formatTime(diagnose.customerLoaded)}
                  {diagnose.startTime && diagnose.customerLoaded && (
                    <span className="text-slate-400 ml-2">({diagnose.customerLoaded - diagnose.startTime}ms)</span>
                  )}
                </div>

                <div className="text-slate-600">Verträge:</div>
                <div className="font-mono">
                  {formatTime(diagnose.contractsLoaded)}
                  {diagnose.startTime && diagnose.contractsLoaded && (
                    <span className="text-slate-400 ml-2">({diagnose.contractsLoaded - diagnose.startTime}ms)</span>
                  )}
                </div>

                <div className="text-slate-600">Anträge:</div>
                <div className="font-mono">
                  {formatTime(diagnose.applicationsLoaded)}
                  {diagnose.startTime && diagnose.applicationsLoaded && (
                    <span className="text-slate-400 ml-2">({diagnose.applicationsLoaded - diagnose.startTime}ms)</span>
                  )}
                </div>

                <div className="text-slate-600">Dokumente:</div>
                <div className="font-mono">
                  {formatTime(diagnose.documentsLoaded)}
                  {diagnose.startTime && diagnose.documentsLoaded && (
                    <span className="text-slate-400 ml-2">({diagnose.documentsLoaded - diagnose.startTime}ms)</span>
                  )}
                </div>

                <div className="text-slate-600">Aufgaben:</div>
                <div className="font-mono">
                  {formatTime(diagnose.tasksLoaded)}
                  {diagnose.startTime && diagnose.tasksLoaded && (
                    <span className="text-slate-400 ml-2">({diagnose.tasksLoaded - diagnose.startTime}ms)</span>
                  )}
                </div>

                <div className="text-slate-600">Berater:</div>
                <div className="font-mono">
                  {formatTime(diagnose.advisorsLoaded)}
                  {diagnose.startTime && diagnose.advisorsLoaded && (
                    <span className="text-slate-400 ml-2">({diagnose.advisorsLoaded - diagnose.startTime}ms)</span>
                  )}
                </div>

                <div className="text-slate-600 border-t border-slate-200 pt-1 font-semibold">Komplett:</div>
                <div className="font-mono font-bold text-primary">
                  {formatTime(diagnose.allDataLoaded)}
                  {diagnose.startTime && diagnose.allDataLoaded && (
                    <span className="ml-2">({diagnose.allDataLoaded - diagnose.startTime}ms gesamt)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Test Results */}
            {testResults && testResults.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Test-Ergebnisse</p>
                <div className="space-y-1">
                  {testResults.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1.5 rounded border ${
                        issue.type === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                        issue.type === 'ERROR' ? 'bg-red-50 text-red-700 border-red-200' :
                        issue.type === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      <span className="font-bold mr-2">[{issue.type}]</span>
                      {issue.message}
                      {issue.time > 0 && <span className="ml-2 font-mono">({issue.time}ms)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Flow Info */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Datenfluss-Analyse</p>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Query-Cache aktiv:</span>
                  <span className="font-mono text-slate-700">Ja (staleTime: 2-10min)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Kunde direkt geladen:</span>
                  <span className="font-mono text-slate-700">filter({'{'} customerId {'}'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Familienmitglieder:</span>
                  <span className="font-mono text-slate-700">Lazy (nur bei Bedarf)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Haushaltsverträge:</span>
                  <span className="font-mono text-slate-700">Nur direkte Verträge</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}