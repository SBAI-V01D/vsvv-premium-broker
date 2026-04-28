import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FolderOpen, Download, Search, FileText, File } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import PortalPageHeader from '../../components/portal/PortalPageHeader';

const docTypeColors = {
  KVG: 'bg-blue-50 text-blue-700',
  VVG: 'bg-blue-50 text-blue-700',
  Leben: 'bg-pink-50 text-pink-700',
  Haftpflicht: 'bg-purple-50 text-purple-700',
  Hausrat: 'bg-green-50 text-green-700',
  Rechtsschutz: 'bg-indigo-50 text-indigo-700',
  Motorfahrzeug: 'bg-orange-50 text-orange-700',
  BVG: 'bg-teal-50 text-teal-700',
  'Säule 3a': 'bg-yellow-50 text-yellow-700',
  Sonstige: 'bg-slate-100 text-slate-600',
};

export default function PortalDocuments() {
  const { user } = useOutletContext();
  const [search, setSearch] = useState('');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['portal-contracts', user?.id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  });

  // Flatten all documents across contracts
  const allDocs = contracts.flatMap(c =>
    (c.documents || []).map(d => ({
      ...d,
      insurance_type: c.insurance_type,
      provider: c.provider,
      policy_number: c.policy_number,
      contract_id: c.id,
    }))
  );

  const filtered = allDocs.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.insurance_type?.toLowerCase().includes(search.toLowerCase()) ||
    d.provider?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by insurance type
  const grouped = filtered.reduce((acc, doc) => {
    const key = doc.insurance_type || 'Sonstige';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div>
      <PortalPageHeader
        icon={<FolderOpen className="w-5 h-5 text-emerald-600" />}
        title="Dokumente"
        subtitle={`${allDocs.length} Dokumente insgesamt`}
      />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Dokument suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-slate-200 animate-pulse rounded-xl" />)}</div>
      ) : allDocs.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-foreground">Keine Dokumente verfügbar</p>
          <p className="text-sm text-muted-foreground mt-1">Ihr Broker wird Ihnen Dokumente zur Verfügung stellen.</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-sm">Keine Dokumente gefunden</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, docs]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${docTypeColors[type] || 'bg-slate-100 text-slate-600'}`}>
                  {type}
                </span>
                <span className="text-xs text-muted-foreground">{docs.length} {docs.length === 1 ? 'Dokument' : 'Dokumente'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <Card className="hover:shadow-md transition-all hover:border-primary/40 cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                          <File className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.provider} {doc.policy_number ? `· ${doc.policy_number}` : ''}</p>
                        </div>
                        <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}