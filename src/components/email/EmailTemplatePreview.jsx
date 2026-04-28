import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function EmailTemplatePreview({ subject, body, customer, contract }) {
  const replacePlaceholders = (text) => {
    if (!text) return text;
    let result = text;
    
    // Customer placeholders
    if (customer) {
      result = result.replace(/{{\s*customer_name\s*}}/g, `${customer.first_name} ${customer.last_name}`);
      result = result.replace(/{{\s*customer_firstname\s*}}/g, customer.first_name || '');
      result = result.replace(/{{\s*customer_email\s*}}/g, customer.email || '');
      result = result.replace(/{{\s*customer_phone\s*}}/g, customer.phone || customer.mobile || '');
      result = result.replace(/{{\s*customer_city\s*}}/g, customer.city || '');
      result = result.replace(/{{\s*customer_zip\s*}}/g, customer.zip_code || '');
    }
    
    // Contract placeholders
    if (contract) {
      result = result.replace(/{{\s*contract_type\s*}}/g, contract.insurance_type || '');
      result = result.replace(/{{\s*contract_provider\s*}}/g, contract.provider || '');
      result = result.replace(/{{\s*contract_policy\s*}}/g, contract.policy_number || '');
      result = result.replace(/{{\s*contract_premium\s*}}/g, contract.premium_yearly ? `CHF ${contract.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '');
      result = result.replace(/{{\s*contract_start\s*}}/g, contract.start_date ? new Date(contract.start_date).toLocaleDateString('de-CH') : '');
      result = result.replace(/{{\s*contract_end\s*}}/g, contract.end_date ? new Date(contract.end_date).toLocaleDateString('de-CH') : '');
    }
    
    return result;
  };

  const processedSubject = useMemo(() => replacePlaceholders(subject), [subject, customer, contract]);
  const processedBody = useMemo(() => replacePlaceholders(body), [body, customer, contract]);

  return (
    <div className="space-y-3">
      <Card className="bg-slate-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase text-muted-foreground">Vorschau</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Betreff:</p>
            <div className="bg-white border border-border rounded p-2 text-sm font-medium">
              {processedSubject || '–'}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nachricht:</p>
            <div className="bg-white border border-border rounded p-3 text-sm whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
              {processedBody || '–'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}