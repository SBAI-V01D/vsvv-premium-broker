import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ContractDocuments({ contractId, customerId, customerName }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', 'contract', contractId],
    queryFn: () => base44.entities.Document.filter({ customer_id: customerId, linked_contract_id: contractId }, '-created_date'),
    enabled: !!contractId && !!customerId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['documents', customerId] });
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Document.create({
      customer_id: customerId,
      customer_name: customerName,
      name: file.name.replace(/\.[^.]+$/, ''),
      file_url,
      category: 'police',
      linked_contract_id: contractId,
      uploaded_by_role: 'broker',
    });
    queryClient.invalidateQueries({ queryKey: ['documents', 'contract', contractId] });
    queryClient.invalidateQueries({ queryKey: ['documents', customerId] });
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> Policen-Dokumente
        </p>
        <label className="cursor-pointer">
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
            <span>
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              {uploading ? 'Hochladen...' : 'Hochladen'}
            </span>
          </Button>
        </label>
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Noch keine Dokumente für diese Police.</p>
      ) : (
        <div className="space-y-1.5">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
              <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="flex-1 text-sm truncate">{doc.name}</span>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
              </a>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(doc.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}