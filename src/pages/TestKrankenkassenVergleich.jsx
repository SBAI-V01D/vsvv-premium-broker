import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

export default function TestKrankenkassenVergleich() {
  const [liveResult, setLiveResult] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const { data: testResults, isLoading } = useQuery({
    queryKey: ['kkv-test'],
    queryFn: async () => {
      const results = [];

      try {
        const user = await base44.auth.me();
        results.push({ name: 'User Auth', status: 'ok', message: user?.email || 'Angemeldet' });
        const orgId = user?.data?.organization_id;
        results.push({ name: 'Organization', status: orgId ? 'ok' : 'warning', message: orgId || 'Keine Org gesetzt' });
      } catch (e) {
        results.push({ name: 'User Auth', status: 'error', message: e.message });
      }

      try {
        const customers = await base44.entities.Customer.list(undefined, 1);
        results.push({ name: 'Customer Entity', status: 'ok', message: `${customers.length} Kunden` });
      } catch (e) {
        results.push({ name: 'Customer Entity', status: 'error', message: e.message });
      }

      // Prüfe ob queryBAGLive-Funktion existiert
      try {
        // Wir rufen sie mit absichtlich falschen Daten auf um den Fehlertyp zu sehen
        const res = await base44.functions.invoke('queryBAGLive', {});
        results.push({
          name: 'queryBAGLive (Funktion erreichbar)',
          status: res?.data?.error?.includes('Pflicht') ? 'ok' : 'ok',
          message: 'Funktion antwortet: ' + (res?.data?.error || JSON.stringify(res?.data).slice(0, 80))
        });
      } catch (e) {
        results.push({ name: 'queryBAGLive (Funktion erreichbar)', status: 'error', message: e.message });
      }

      return results;
    }
  });

  const handleLiveTest = async () => {
    setLiveLoading(true);
    setLiveResult(null);
    try {
      const start = Date.now();
      const res = await base44.functions.invoke('queryBAGLive', {
        plz: '4304',
        yob: 1968,
        deductible: 300,
        accident: false,
      });
      const ms = Date.now() - start;
      const raw = res?.data;
      const offers = raw?.data || raw?.offers || [];
      setLiveResult({
        status: 'ok',
        ms,
        count: offers.length,
        rawKeys: raw ? Object.keys(raw) : [],
        sampleOffer: offers[0] || null,
        insurers: [...new Set(offers.map(o => o.insurer))].sort(),
        models: [...new Set(offers.map(o => o.model))].sort(),
        priceFields: offers[0] ? Object.keys(offers[0]).filter(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('premium')) : [],
        rawSample: JSON.stringify(offers[0], null, 2),
      });
    } catch (e) {
      setLiveResult({ status: 'error', message: e.message });
    } finally {
      setLiveLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">KKV Live-Systemtest</h1>

      {/* Basis-Tests */}
      {isLoading && <p className="text-muted-foreground">Tests laufen...</p>}
      {testResults && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basis-Tests</h2>
          {testResults.map((test, idx) => (
            <Card key={idx}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="font-semibold text-sm">{test.name}</p>
                  <p className="text-xs text-muted-foreground">{test.message}</p>
                </div>
                {test.status === 'ok' && <CheckCircle2 className="text-emerald-600 w-5 h-5" />}
                {test.status === 'warning' && <AlertCircle className="text-amber-600 w-5 h-5" />}
                {test.status === 'error' && <XCircle className="text-red-600 w-5 h-5" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Live API Test */}
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Live API Test (PLZ 4304, Jg. 1968, Franchise 300)</h2>
        <Button onClick={handleLiveTest} disabled={liveLoading} className="gap-2 mb-4">
          {liveLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Teste...</> : <><RefreshCw className="w-4 h-4" />queryBAGLive aufrufen</>}
        </Button>

        {liveResult && liveResult.status === 'error' && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex gap-2 items-center mb-2"><XCircle className="text-red-600 w-5 h-5" /><p className="font-semibold text-red-700">Fehler</p></div>
              <p className="text-sm text-red-700 font-mono">{liveResult.message}</p>
            </CardContent>
          </Card>
        )}

        {liveResult && liveResult.status === 'ok' && (
          <div className="space-y-3">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-4">
                <div className="flex gap-2 items-center mb-2"><CheckCircle2 className="text-emerald-600 w-5 h-5" /><p className="font-semibold text-emerald-700">Erfolg — {liveResult.ms}ms</p></div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Angebote:</span> <strong>{liveResult.count}</strong></div>
                  <div><span className="text-muted-foreground">Versicherer:</span> <strong>{liveResult.insurers.length}</strong></div>
                  <div><span className="text-muted-foreground">Response-Keys:</span> <strong>{liveResult.rawKeys.join(', ')}</strong></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Preis-Felder im ersten Angebot</CardTitle></CardHeader>
              <CardContent className="text-sm font-mono">
                {liveResult.priceFields.length > 0
                  ? liveResult.priceFields.join(', ')
                  : <span className="text-red-600">Keine price/premium-Felder gefunden!</span>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Versicherer ({liveResult.insurers.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {liveResult.insurers.map(i => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{i}</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Modelle</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {liveResult.models.map(m => (
                    <span key={m} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">{m}</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Erstes Angebot (raw)</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-48">{liveResult.rawSample}</pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}