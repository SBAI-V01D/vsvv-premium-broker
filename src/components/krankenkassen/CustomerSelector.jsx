import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, X, Calendar, CheckCircle2 } from 'lucide-react';
import { SWISS_ZIP_CODES } from '@/lib/swissZipCodes';

const KANTONE = ['ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH','AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'];

export default function CustomerSelector({ formData, setFormData, onSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const containerRef = useRef(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['kkv_customers'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, 'last_name', 1000),
    staleTime: 2 * 60 * 1000,
  });

  const filtered = searchQuery.length >= 2
    ? customers.filter(c => {
        const q = searchQuery.toLowerCase();
        return (
          (c.first_name || '').toLowerCase().includes(q) ||
          (c.last_name || '').toLowerCase().includes(q) ||
          (`${c.first_name} ${c.last_name}`).toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.customer_number || '').toLowerCase().includes(q)
        );
      }).sort((a, b) => {
        const q = searchQuery.toLowerCase();
        const aName = `${a.last_name} ${a.first_name}`.toLowerCase();
        const bName = `${b.last_name} ${b.first_name}`.toLowerCase();
        const aStarts = aName.startsWith(q) || (a.last_name||'').toLowerCase().startsWith(q);
        const bStarts = bName.startsWith(q) || (b.last_name||'').toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      }).slice(0, 20)
    : [];

  const handleSelect = (customer) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setShowDropdown(false);
    // Sofort alle Daten übernehmen
    setFormData(prev => ({
      ...prev,
      vorname: customer.first_name || '',
      nachname: customer.last_name || '',
      geburtsdatum: customer.birthdate || '',
      plz: customer.zip_code || '',
      wohnort: customer.city || '',
      kanton: customer.canton || '',
    }));
    onSelect?.(customer);
  };

  const handleClear = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setFormData(prev => ({ ...prev, vorname: '', nachname: '', geburtsdatum: '', plz: '', wohnort: '', kanton: '' }));
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

  // Dropdown schliessen bei Klick ausserhalb
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-3">
      {/* Kundensuche */}
      <div>
        <Label>Kunde suchen</Label>
        <div className="relative mt-1" ref={containerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <input
            type="text"
            value={selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : searchQuery}
            onChange={e => {
              const val = e.target.value;
              setSearchQuery(val);
              setShowDropdown(true);
              if (selectedCustomer) {
                setSelectedCustomer(null);
                onSelect?.(null);
              }
            }}
            onFocus={() => { if (!selectedCustomer) setShowDropdown(true); }}
            placeholder="Name oder Kundennummer suchen..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-8 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {selectedCustomer && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {showDropdown && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {filtered.length > 0 ? (
                filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => handleSelect(c)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.birthdate
                          ? `geb. ${new Date(c.birthdate).toLocaleDateString('de-CH')}`
                          : 'kein Geburtsdatum'}
                        {c.city ? ` · ${c.zip_code || ''} ${c.city}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground text-center">Keine Kunden gefunden</p>
              )}
            </div>
          )}
        </div>
        {selectedCustomer && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Name, Geburtsdatum, PLZ, Wohnort und Kanton übernommen
          </p>
        )}
      </div>

      {/* Geburtsdatum — Pflichtfeld für Prämienberechnung */}
      <div>
        <Label>
          Geburtsdatum <span className="text-destructive">*</span>
          <span className="text-xs text-muted-foreground ml-1">(Pflicht für Prämienberechnung)</span>
        </Label>
        <div className="relative mt-1">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={formData.geburtsdatum || ''}
            onChange={e => setFormData(prev => ({ ...prev, geburtsdatum: e.target.value }))}
            className="pl-9"
          />
        </div>
        {!formData.geburtsdatum && (
          <p className="text-xs text-amber-600 mt-1">⚠ Geburtsdatum nötig für Altersklasse und Franchise</p>
        )}
      </div>

      {/* PLZ + Wohnort */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>PLZ</Label>
          <Input
            value={formData.plz || ''}
            onChange={e => handlePlzChange(e.target.value)}
            placeholder="z.B. 4304"
            maxLength={4}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Wohnort</Label>
          <Input
            value={formData.wohnort || ''}
            onChange={e => setFormData(prev => ({ ...prev, wohnort: e.target.value }))}
            placeholder="Wohnort"
            className="mt-1"
          />
        </div>
      </div>

      {/* Kanton */}
      <div>
        <Label>Kanton <span className="text-destructive">*</span></Label>
        <Select value={formData.kanton || ''} onValueChange={v => setFormData(prev => ({ ...prev, kanton: v }))}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Kanton wählen" /></SelectTrigger>
          <SelectContent>
            {KANTONE.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}