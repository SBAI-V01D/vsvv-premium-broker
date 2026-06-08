import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SWISS_ZIP_CODES } from '@/lib/swissZipCodes';

const KANTONE = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'
];

export default function CustomerSelector({ formData, setFormData, selectedCustomer, setSelectedCustomer }) {
  const { data: customers = [] } = useQuery({
    queryKey: ['krankenkassen_customer_all'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, 'last_name', 1000),
    staleTime: 5 * 60 * 1000,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = React.useRef(null);

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    const firstName = (c.first_name || '').toLowerCase();
    const lastName = (c.last_name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const customerNumber = (c.customer_number || '').toLowerCase();
    const company = (c.company_name || '').toLowerCase();
    
    // Suche in: Vorname, Nachname, Firma, Kundennummer, E-Mail
    const matchesFirstName = firstName.startsWith(q) || firstName.includes(q);
    const matchesLastName = lastName.startsWith(q) || lastName.includes(q);
    const matchesEmail = email.includes(q);
    const matchesCustomerNumber = customerNumber.includes(q);
    const matchesCompany = company.includes(q);
    
    return matchesFirstName || matchesLastName || matchesEmail || matchesCustomerNumber || matchesCompany;
  }).sort((a, b) => {
    const q = searchQuery.toLowerCase().trim();
    const aFirstName = (a.first_name || '').toLowerCase();
    const aLastName = (a.last_name || '').toLowerCase();
    const bFirstName = (b.first_name || '').toLowerCase();
    const bLastName = (b.last_name || '').toLowerCase();
    
    const aStartsWith = aFirstName.startsWith(q) || aLastName.startsWith(q);
    const bStartsWith = bFirstName.startsWith(q) || bLastName.startsWith(q);
    
    // Priorität: Beginnt mit Suchbegriff > Enthält Suchbegriff
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    
    // Sekundäre Sortierung: Alphabetisch
    const aFullName = `${aFirstName} ${aLastName}`;
    const bFullName = `${bFirstName} ${bLastName}`;
    return aFullName.localeCompare(bFullName);
  });

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setShowDropdown(false);
    setFormData({
      ...formData,
      vorname: customer.first_name || '',
      nachname: customer.last_name || '',
      geburtsdatum: customer.birthdate || '',
      wohnort: customer.city || '',
      plz: customer.zip_code || '',
      kanton: customer.canton || '',
      geschlecht: customer.geschlecht || formData.geschlecht
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(true);
    if (selectedCustomer) {
      setSelectedCustomer(null);
    }
    // Nur Vorname zurücksetzen wenn nach Name gesucht wird
    // Andere Felder behalten wir bei für manuelle Eingabe
    setFormData({
      ...formData,
      vorname: value
    });
  };

  const handlePlzChange = (plz) => {
    const plzData = SWISS_ZIP_CODES[plz];
    if (plzData) {
      setFormData(prev => ({
        ...prev,
        plz,
        wohnort: plzData.ort,
        kanton: plzData.kanton
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        plz,
        wohnort: '',
        kanton: ''
      }));
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="space-y-3">
        <div className="relative">
          <div className="flex items-center gap-2">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : searchQuery}
              onChange={handleInputChange}
              onFocus={() => { setShowDropdown(true); inputRef.current?.select(); }}
              placeholder="Kunde suchen (z.B. 'Adam')..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent pl-10 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
            {selectedCustomer && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCustomer(null);
                  setSearchQuery('');
                  setShowDropdown(false);
                  setFormData({
                    ...formData,
                    vorname: '',
                    nachname: '',
                    geburtsdatum: '',
                    wohnort: '',
                    plz: '',
                    kanton: ''
                  });
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {showDropdown && searchQuery && !selectedCustomer && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-accent rounded-sm transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {customer.first_name} {customer.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {customer.email} {customer.city && `· ${customer.city}`}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  Keine Kunden gefunden
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>PLZ</Label>
            <Input
              value={formData.plz}
              onChange={e => handlePlzChange(e.target.value)}
              placeholder="PLZ eingeben"
              maxLength={4}
            />
          </div>
          <div>
            <Label>Wohnort</Label>
            <Input
              value={formData.wohnort}
              onChange={e => setFormData({...formData, wohnort: e.target.value})}
              placeholder="Wohnort"
            />
          </div>
        </div>

        <div>
          <Label>Kanton</Label>
          <Select value={formData.kanton} onValueChange={v => setFormData({...formData, kanton: v})}>
            <SelectTrigger>
              <SelectValue placeholder="Kanton wählen" />
            </SelectTrigger>
            <SelectContent>
              {KANTONE.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}