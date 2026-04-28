import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FolderOpen, Download, Search, File, Upload, CheckCircle2, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const CATEGORIES = [
  { value: 'vertrag', label: 'Vertrag' },
  { value: 'schaden', label: 'Schadensfall' },
  { value: 'ausweis', label: 'Ausweis / ID' },
  { value: 'korrespondenz', label: 'Korrespondenz' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

function UploadSection({ user, contracts }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('sonstiges');
  const [linkedContract, setLinkedContract] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFilePick = (f) => {
    setFile(f);
    setName(f.name.replace(/\.[^/.]+$/, ''));
    setSuccess(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFilePick(f);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Document.create({
      customer_id: user.id,
      customer_name: user.full_name,
      name: name || file.name,
      file_url,
      category,
      linked_contract_id: linkedContract || undefined,
      uploaded_by: user.email,
      uploaded_by_role: 'customer',
    });
    queryClient.invalidateQueries({ queryKey: ['portal-my-documents', user?.id] });
    setUploading(false);
    setSuccess(true);
    setFile(null);
    setName('');
    setCategory('sonstiges');
    setLinkedContract('');
  };

  if (success) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 mb-6">
        <CardContent className="p-5 flex items-center gap-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-800">Dokument erfolgreich hochgeladen</p>
            <p className="text-sm text-emerald-700">Ihr Broker wurde automatisch benachrichtigt.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSuccess(false)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
            Weiteres Dokument
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8 border-dashed border-2 border-primary/30 bg-primary/5">
      <CardContent className="p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" /> Dokument hochladen
        </h2>
        <form onSubmit={handleUpload} className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center py-8 cursor-pointer ${dragOver ? 'border-primary bg-primary/10' : 'border-border bg-white'}`}
            onClick={() => document.getElementById('portal-file-input').click()}
          >
            <input id="portal-file-input" type="file" className="hidden" onChange={e => e.target.files[0] && handleFilePick(e.target.files[0])} />
            {file ? (
              <div className="flex items-center gap-3 text-sm">
                <File className="w-6 h-6 text-primary" />
                <span className="font-medium text-foreground">{file.name}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setName(''); }}
                  className="text-muted-foreground hover:text-destructive ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Datei hierher ziehen oder <span className="text-primary font-medium">auswählen</span></p>
              </>
            )}
          </div>

          {file && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <Label className="text-xs mb-1 block">Dokumentname</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Krankenversicherungskarte" required />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Kategorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Zugehöriger Vertrag (optional)</Label>
                <Select value={linkedContract} onValueChange={setLinkedContract}>
                  <SelectTrigger><SelectValue placeholder="Kein Vertrag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Kein Vertrag</SelectItem>
                    {contracts.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.insurance_type} – {c.provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {file && (
            <div className="flex justify-end">
              <Button type="submit" disabled={uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Hochladen...</> : <><Upload className="w-4 h-4 mr-2" />Hochladen & Broker benachrichtigen</>}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default function PortalDocuments() {
  const { user } = useOutletContext();
  const [search, setSearch] = useState('');

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['portal-contracts', user?.id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  });

  // Documents uploaded by the customer themselves
  const { data: myDocuments = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['portal-my-documents', user?.id],
    queryFn: () => base44.entities.Document.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  });

  // Documents embedded in contracts (from broker)
  const contractDocs = contracts.flatMap(c =>
    (c.documents || []).map(d => ({
      ...d,
      insurance_type: c.insurance_type,
      provider: c.provider,
      policy_number: c.policy_number,
    }))
  );

  const filteredContractDocs = contractDocs.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.insurance_type?.toLowerCase().includes(search.toLowerCase()) ||
    d.provider?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMyDocs = myDocuments.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.category?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filteredContractDocs.reduce((acc, doc) => {
    const key = doc.insurance_type || 'Sonstige';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const isLoading = loadingContracts || loadingDocs;

  return (
    <div>
      <PortalPageHeader
        icon={<FolderOpen className="w-5 h-5 text-emerald-600" />}
        title="Dokumente"
        subtitle={`${contractDocs.length + myDocuments.length} Dokumente insgesamt`}
      />

      <UploadSection user={user} contracts={contracts} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Dokument suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-slate-200 animate-pulse rounded-xl" />)}</div>
      ) : (
        <div className="space-y-8">

          {/* My uploaded documents */}
          {(filteredMyDocs.length > 0 || myDocuments.length > 0) && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Von mir hochgeladen</h3>
              {filteredMyDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine eigenen Dokumente gefunden.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredMyDocs.map(doc => (
                    <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" className="group">
                      <Card className="hover:shadow-md transition-all hover:border-primary/40 cursor-pointer">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <File className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{doc.category || 'sonstiges'}</p>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </CardContent>
                      </Card>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documents from broker / contracts */}
          {contractDocs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vom Broker bereitgestellt</h3>
              {filteredContractDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Dokumente gefunden.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(grouped).map(([type, docs]) => (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${docTypeColors[type] || 'bg-slate-100 text-slate-600'}`}>{type}</span>
                        <span className="text-xs text-muted-foreground">{docs.length} {docs.length === 1 ? 'Dokument' : 'Dokumente'}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {docs.map((doc, i) => (
                          <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="group">
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
          )}

          {contractDocs.length === 0 && myDocuments.length === 0 && (
            <Card className="p-12 text-center">
              <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="font-medium text-foreground">Noch keine Dokumente</p>
              <p className="text-sm text-muted-foreground mt-1">Laden Sie oben ein Dokument hoch oder warten Sie auf Ihren Broker.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}