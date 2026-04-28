import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2 } from 'lucide-react';

export default function PolicyUploadDialog({ open, onOpenChange, contractId, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Contract.update(contractId, { policy_document_url: file_url });
      setFile(null);
      onOpenChange(false);
      onUploadSuccess();
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Police hochladen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            {file ? (
              <div className="space-y-2">
                <FileText className="w-8 h-8 text-primary mx-auto" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">PDF hierher ziehen</p>
                <p className="text-xs text-muted-foreground">oder klicken zum Auswählen</p>
              </div>
            )}
            <Input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0])}
              className="hidden"
              id="policy-file"
            />
            <label htmlFor="policy-file" className="block cursor-pointer" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); setFile(null); }} disabled={uploading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!file || uploading}>
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploading ? 'Hochladen...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}