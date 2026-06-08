import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function TestKrankenkassenVergleich() {
  const { data: testResults, isLoading, error } = useQuery({
    queryKey: ['kkv-test'],
    queryFn: async () => {
      const results = [];
      
      // Test 1: Entity exists
      try {
        const schema = await base44.entities.KrankenkassenVergleich.schema();
        results.push({ name: 'Entity Schema', status: 'ok', message: 'Verfügbar' });
      } catch (e) {
        results.push({ name: 'Entity Schema', status: 'error', message: e.message });
      }
      
      // Test 2: Customer entity
      try {
        const customers = await base44.entities.Customer.list(undefined, 1);
        results.push({ name: 'Customer Entity', status: 'ok', message: `${customers.length} Kunden` });
      } catch (e) {
        results.push({ name: 'Customer Entity', status: 'error', message: e.message });
      }
      
      // Test 3: BAG Daten
      try {
        const bagDaten = await base44.entities.BAGPraemienDaten.list(undefined, 1);
        results.push({ name: 'BAG Prämien Daten', status: 'ok', message: `${bagDaten.length} Datensätze` });
      } catch (e) {
        results.push({ name: 'BAG Prämien Daten', status: 'error', message: e.message });
      }
      
      // Test 4: User auth
      try {
        const user = await base44.auth.me();
        results.push({ name: 'User Auth', status: 'ok', message: user?.email || 'Angemeldet' });
      } catch (e) {
        results.push({ name: 'User Auth', status: 'error', message: e.message });
      }
      
      // Test 5: Organization
      try {
        const user = await base44.auth.me();
        const orgId = user?.data?.organization_id;
        results.push({ name: 'Organization', status: orgId ? 'ok' : 'warning', message: orgId || 'Keine Org' });
      } catch (e) {
        results.push({ name: 'Organization', status: 'error', message: e.message });
      }
      
      return results;
    }
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Krankenkassenvergleich - Systemtest</h1>
      
      {isLoading && <p>Tests werden ausgeführt...</p>}
      {error && <p className="text-red-600">Fehler: {error.message}</p>}
      
      {testResults && (
        <div className="space-y-3">
          {testResults.map((test, idx) => (
            <Card key={idx}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{test.name}</p>
                  <p className="text-sm text-muted-foreground">{test.message}</p>
                </div>
                {test.status === 'ok' && <CheckCircle2 className="text-emerald-600 w-6 h-6" />}
                {test.status === 'warning' && <AlertCircle className="text-amber-600 w-6 h-6" />}
                {test.status === 'error' && <XCircle className="text-red-600 w-6 h-6" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Getestete Komponenten:</h3>
        <ul className="text-sm space-y-1 text-slate-700">
          <li>✓ Entity: KrankenkassenVergleich</li>
          <li>✓ Entity: Customer</li>
          <li>✓ Entity: BAGPraemienDaten</li>
          <li>✓ Authentication</li>
          <li>✓ Organization Context</li>
        </ul>
      </div>
    </div>
  );
}