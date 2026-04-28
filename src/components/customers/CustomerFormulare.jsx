import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

const FORM_TYPES = [
  { value: 'mandat', label: 'Mandat', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'vag', label: 'VAG', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'datenschutz', label: 'Datenschutzerklärung', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'vollmacht', label: 'Vollmacht', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'gesundheitsfragebogen', label: 'Gesundheitsfragebogen', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'antrag', label: 'Antragsformular', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'sonstiges', label: 'Sonstiges', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

function FormTypeBadge({ type }) {
  const ft = FORM_TYPES.find(f => f.value === type) || FORM_TYPES[FORM_TYPES.length - 1];
  return (
    <span className={`text-xs font-medium border px-2 py-0.5 rounded-full ${ft.color}`}>
      {ft.label}
    </span>
  );
}

export default function CustomerFormulare({ customerId, customerName }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('mandat');

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', 'formulare', customerId],
    queryFn: () => base44.entities.Document.filter(
      { customer_id: customerId, category: 'korrespondenz' },
      '-created_date'
    ),
    enabled: !!customerId,
  });

  // We store forms as documents with a special tag in notes
  const forms = documents.filter(d => d.notes?.startsWith('formular:'));

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'formulare', customerId] });
      queryClient.invalidateQueries({ queryKey: ['documents', customerId] });
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const ft = FORM_TYPES.find(f => f.value === selectedType);
    await base44.entities.Document.create({
      customer_id: customerId,
      customer_name: customerName,
      name: ft ? ft.label : file.name.replace(/\.[^.]+$/, ''),
      file_url,
      category: 'korrespondenz',
      notes: `formular:${selectedType}`,
      uploaded_by_role: 'broker',
    });
    queryClient.invalidateQueries({ queryKey: ['documents', 'formulare', customerId] });
    queryClient.invalidateQueries({ queryKey: ['documents', customerId] });
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      {/* Upload Panel */}
      <Card className="p-4 mb-4 bg-muted/30">
        <p className="text-sm font-semibold mb-3">Formular hochladen</p>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <Label className="text-xs mb-1 block">Formulartyp</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORM_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="cursor-pointer">
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            <Button type="button" variant="default" className="gap-2" asChild>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Hochladen...' : 'PDF hochladen'}
              </span>
            </Button>
          </label>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden...</p>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <FileText className="w-10 h-10 opacity-20" />
          <p className="text-sm">Keine Kundenformulare vorhanden</p>
          <p className="text-xs">Laden Sie Mandat, VAG oder andere Formulare hoch.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {forms.map(doc => {
            const formType = doc.notes?.replace('formular:', '');
            return (
              <Card key={doc.id} className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <FormTypeBadge type={formType} />
                      <span className="text-xs text-muted-foreground">
                        {doc.created_date ? new Date(doc.created_date).toLocaleDateString('de-CH') : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(doc.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}