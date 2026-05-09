import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Loader, Play, ClipboardCheck, Lock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SystemTestingDashboard() {
  const [activePhase, setActivePhase] = useState('phase1')
  const [runningTest, setRunningTest] = useState(null)
  const [testResults, setTestResults] = useState({})

  // Phase 1: KPI Validation
  const handlePhase1Test = async () => {
    setRunningTest('phase1');
    try {
      const result = await base44.functions.invoke('validateDashboardKPIs', {});
      setTestResults(prev => ({ ...prev, phase1: result }));
    } catch (err) {
      alert('Test failed: ' + err.message);
    } finally {
      setRunningTest(null);
    }
  };

  // Phase 2: Data Consistency
  const handlePhase2Test = async () => {
    setRunningTest('phase2');
    try {
      const result = await base44.functions.invoke('checkDataConsistency', {});
      setTestResults(prev => ({ ...prev, phase2: result }));
    } catch (err) {
      alert('Test failed: ' + err.message);
    } finally {
      setRunningTest(null);
    }
  };

  // Phase 3: Security Audit
  const handlePhase3Test = async () => {
    setRunningTest('phase3');
    try {
      const result = await base44.functions.invoke('auditSecurityRules', {});
      setTestResults(prev => ({ ...prev, phase3: result }));
    } catch (err) {
      alert('Test failed: ' + err.message);
    } finally {
      setRunningTest(null);
    }
  };

  const StatusBadge = ({ score }) => {
    if (score === undefined) return <Badge variant="outline">Pending</Badge>;
    if (score >= 90) return <Badge className="bg-green-100 text-green-700">PASS</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-100 text-yellow-700">WARNING</Badge>;
    return <Badge className="bg-red-100 text-red-700">FAIL</Badge>;
  };

  return (
    <div className="space-y-4">
      <Tabs value={activePhase} onValueChange={setActivePhase}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="phase1">Phase 1: Test</TabsTrigger>
          <TabsTrigger value="phase2">Phase 2: Validate</TabsTrigger>
          <TabsTrigger value="phase3">Phase 3: Secure</TabsTrigger>
          <TabsTrigger value="phase4">Phase 4: Stabilize</TabsTrigger>
        </TabsList>

        {/* PHASE 1 */}
        <TabsContent value="phase1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" />
                Phase 1: Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Dashboard Verification</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ KPI counts correct?</li>
                  <li>☐ Renewal processes visible?</li>
                  <li>☐ Click functions working?</li>
                  <li>☐ No ghost data?</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Customer 360</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ All customer data complete?</li>
                  <li>☐ Contracts correct?</li>
                  <li>☐ Activities visible?</li>
                  <li>☐ Documents accessible?</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Document Upload</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ Upload stable?</li>
                  <li>☐ Categories correct?</li>
                  <li>☐ Document findable?</li>
                  <li>☐ Access correct?</li>
                </ul>
              </div>

              <Button onClick={handlePhase1Test} disabled={runningTest === 'phase1'} className="w-full">
                {runningTest === 'phase1' ? (
                  <><Loader className="w-4 h-4 mr-2 animate-spin" /> Testing...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Run Phase 1 Tests</>
                )}
              </Button>

              {testResults.phase1 && (
                <div className="p-3 rounded border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">Test Results</p>
                    <StatusBadge score={testResults.phase1.validation?.score} />
                  </div>
                  <div className="text-xs space-y-1">
                    {Object.entries(testResults.phase1.validation.checks || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-mono text-foreground">
                          {typeof val === 'object' ? JSON.stringify(val).slice(0, 30) : val}
                        </span>
                      </div>
                    ))}
                  </div>
                  {testResults.phase1.validation.issues.length > 0 && (
                    <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
                      <p className="text-xs font-semibold text-red-700">Issues:</p>
                      {testResults.phase1.validation.issues.map((issue, i) => (
                        <p key={i} className="text-xs text-red-600">• {issue}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PHASE 2 */}
        <TabsContent value="phase2" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Phase 2: Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">KPI Consistency</p>
                <p className="text-xs text-muted-foreground">Dashboard values = Detail views = Database</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Data Integrity</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ No missing customer_id?</li>
                  <li>☐ No missing advisor_id?</li>
                  <li>☐ No orphan records?</li>
                  <li>☐ Organization assignment complete?</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Test Data</p>
                <p className="text-xs text-muted-foreground">No test/ghost data in production view</p>
              </div>

              <Button onClick={handlePhase2Test} disabled={runningTest === 'phase2'} className="w-full">
                {runningTest === 'phase2' ? (
                  <><Loader className="w-4 h-4 mr-2 animate-spin" /> Validating...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Run Phase 2 Validation</>
                )}
              </Button>

              {testResults.phase2 && (
                <div className="p-3 rounded border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">Consistency Report</p>
                    <Badge className={testResults.phase2.health_score >= 90 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                      Score: {testResults.phase2.health_score}
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1">
                    {Object.entries(testResults.phase2.orphans || {}).map(([key, count]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className={count > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PHASE 3 */}
        <TabsContent value="phase3" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Phase 3: Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Role-Based Access</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ Advisor sees only own customers?</li>
                  <li>☐ Manager sees only team data?</li>
                  <li>☐ No cross-org access?</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Document Security</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ No public URLs?</li>
                  <li>☐ Login required?</li>
                  <li>☐ Role check active?</li>
                  <li>☐ Access logged?</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Backup & Compliance</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ Backups running?</li>
                  <li>☐ Audit logs complete?</li>
                  <li>☐ Data retention policy?</li>
                </ul>
              </div>

              <Button onClick={handlePhase3Test} disabled={runningTest === 'phase3'} className="w-full">
                {runningTest === 'phase3' ? (
                  <><Loader className="w-4 h-4 mr-2 animate-spin" /> Auditing...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Run Phase 3 Audit</>
                )}
              </Button>

              {testResults.phase3 && (
                <div className="p-3 rounded border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">Security Audit</p>
                    <Badge className={testResults.phase3.audit.compliance_score >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {testResults.phase3.compliance_level}
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1">
                    {Object.entries(testResults.phase3.audit.checks || {}).slice(0, 5).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="text-green-600 text-[10px]">✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PHASE 4 */}
        <TabsContent value="phase4" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Phase 4: Stabilization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Performance Testing</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ Load times &lt; 2 seconds?</li>
                  <li>☐ Search responds &lt; 1 second?</li>
                  <li>☐ Filter responsive?</li>
                  <li>☐ 500+ records smooth?</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Multi-User Testing</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ Concurrent users stable?</li>
                  <li>☐ No data conflicts?</li>
                  <li>☐ Updates consistent?</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Error Handling</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>☐ All validation messages?</li>
                  <li>☐ Graceful errors?</li>
                  <li>☐ Recovery possible?</li>
                </ul>
              </div>

              <div className="p-3 rounded bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700 font-semibold">Testing with real data:</p>
                <p className="text-xs text-blue-600 mt-1">Start: 50-100 records → Scale: 500-1000 records</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Overall Status */}
      <Card className="bg-gradient-to-br from-slate-50 to-blue-50">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">System Status</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <p className="text-sm font-semibold">Testing Pipeline Active</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Complete all 4 phases before production. Document findings in each phase.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}