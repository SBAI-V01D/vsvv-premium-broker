import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, X, Calendar, MapPin } from 'lucide-react';
import { SWISS_ZIP_CODES } from '@/lib/swissZipCodes';

const KANTONE = ['ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH','AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'];

export default function CustomerSelector({ formData, setFormData, onSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const inputRef = React.useRef(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['kkv_customers'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, 'last_name', 1000),
    staleTime: 2 * 60 * 1000,
  });

  const filtered = customers.filter(c => {
    if (!searchQuery || searchQuery.length < 2) return false;
    const q = searchQuery.toLowerCase();
    return (
      (c.first_name || '').toLowerCase().includes(q) ||
      (c.last_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.customer_number || '').toLowerCase().includes(q)
    );
  }).slice(0, 20);

  const handleSelect = (customer) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setShowDropdown(false);
    const updates = {
      ...formData,
      vorname: customer.first_name || '',
      nachname: customer.last_name || '',
      geburtsdatum: customer.birthdate || '',
      plz: customer.zip_code || '',
      wohnort: customer.city || '',
      kanton: customer.canton || '',
    };
    setFormData(updates);
    onSelect?.(customer);
  };

  const handleClear = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setFormData({ ...formData, vorname: '', nachname: '', geburtsdatum: '', plz: '', wohnort: '', kanton: '' });
    onSelect?.(null);
  };

  const handlePlzChange = (plz) => {
    const plzData = SWISS_ZIP_CODES?.[plz];
    setFormData(prev => ({
      ...prev,
      plz,
      wohnort: plzData?.ort || prev.wohnort,
      kanton: plzData?.kanton || prev.kanton,
    }));
  };

  React.useEffect(() => {
    const handler = (e) => { if (inputRef.current && !inputRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-3">
      {/* Kundensuche */}
      <div>
        <Label>Kunde suchen</Label>
        <div className="relative mt-1" ref={inputRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
              if (selectedCustomer) handleClear();
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Name oder Kundennummer suchen..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-9 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {selectedCustomer && (
            <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          {showDropdown && searchQuery && !selectedCustomer && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {filtered.length > 0 ? filtered.map(c => (
                <button
                  key={c.id}
                  onMouseDown={() => handleSelect(c)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left text-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.birthdate ? `geb. ${new Date(c.birthdate).toLocaleDateString('de-CH')}` : 'kein Datum'} · {c.city || c.zip_code || '–'}
                    </p>
                  </div>
                </button>
              )) : (
                <p className="p-3 text-center text-sm text-muted-foreground">Keine Kunden gefunden</p>
              )}
            </div>
          )}
        </div>
        {selectedCustomer && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <User className="w-3 h-3" /> Daten aus Kundenstamm übernommen
          </p>
        )}
      </div>

      {/* Geburtsdatum — Pflichtfeld */}
      <div>
        <Label>
          Geburtsdatum <span className="text-destructive">*</span>
          <span className="text-xs text-muted-foreground ml-1">(für Prämienberechnung)</span>
        </Label>
        <div className="relative mt-1">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={formData.geburtsdatum}
            onChange={e => setFormData({ ...formData, geburtsdatum: e.target.value })}
            className="pl-9"
          />
        </div>
        {!formData.geburtsdatum && (
          <p className="text-xs text-amber-600 mt-1">Geburtsdatum für Prämienberechnung zwingend nötig</p>
        )}
      </div>

      {/* PLZ + Wohnort */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>PLZ</Label>
          <Input
            value={formData.plz}
            onChange={e => handlePlzChange(e.target.value)}
            placeholder="z.B. 4304"
            maxLength={4}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Wohnort</Label>
          <Input
            value={formData.wohnort}
            onChange={e => setFormData({ ...formData, wohnort: e.target.value })}
            placeholder="Wohnort"
            className="mt-1"
          />
        </div>
      </div>

      {/* Kanton */}
      <div>
        <Label>Kanton <span className="text-destructive">*</span></Label>
        <Select value={formData.kanton} onValueChange={v => setFormData({ ...formData, kanton: v })}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Kanton wählen" /></SelectTrigger>
          <SelectContent>
            {KANTONE.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}