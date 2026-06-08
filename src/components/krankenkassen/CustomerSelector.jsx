import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SWISS_ZIP_CODES = {
  '8000': { ort: 'Zürich', kanton: 'ZH' }, '8001': { ort: 'Zürich', kanton: 'ZH' }, '8002': { ort: 'Zürich', kanton: 'ZH' },
  '8003': { ort: 'Zürich', kanton: 'ZH' }, '8004': { ort: 'Zürich', kanton: 'ZH' }, '8005': { ort: 'Zürich', kanton: 'ZH' },
  '8006': { ort: 'Zürich', kanton: 'ZH' }, '8008': { ort: 'Zürich', kanton: 'ZH' }, '8032': { ort: 'Zürich', kanton: 'ZH' },
  '8037': { ort: 'Zürich', kanton: 'ZH' }, '8038': { ort: 'Zürich', kanton: 'ZH' }, '8041': { ort: 'Zürich', kanton: 'ZH' },
  '8044': { ort: 'Zürich', kanton: 'ZH' }, '8045': { ort: 'Zürich', kanton: 'ZH' }, '8046': { ort: 'Zürich', kanton: 'ZH' },
  '8047': { ort: 'Zürich', kanton: 'ZH' }, '8048': { ort: 'Zürich', kanton: 'ZH' }, '8049': { ort: 'Zürich', kanton: 'ZH' },
  '8050': { ort: 'Zürich', kanton: 'ZH' }, '8051': { ort: 'Zürich', kanton: 'ZH' }, '8052': { ort: 'Zürich', kanton: 'ZH' },
  '8053': { ort: 'Zürich', kanton: 'ZH' }, '8055': { ort: 'Zürich', kanton: 'ZH' }, '8057': { ort: 'Zürich', kanton: 'ZH' },
  '8063': { ort: 'Zürich', kanton: 'ZH' }, '8064': { ort: 'Zürich', kanton: 'ZH' }, '8092': { ort: 'Zürich', kanton: 'ZH' },
  '3000': { ort: 'Bern', kanton: 'BE' }, '3001': { ort: 'Bern', kanton: 'BE' }, '3003': { ort: 'Bern', kanton: 'BE' },
  '3004': { ort: 'Bern', kanton: 'BE' }, '3005': { ort: 'Bern', kanton: 'BE' }, '3006': { ort: 'Bern', kanton: 'BE' },
  '3007': { ort: 'Bern', kanton: 'BE' }, '3008': { ort: 'Bern', kanton: 'BE' }, '3010': { ort: 'Bern', kanton: 'BE' },
  '3011': { ort: 'Bern', kanton: 'BE' }, '3012': { ort: 'Bern', kanton: 'BE' }, '3013': { ort: 'Bern', kanton: 'BE' },
  '3014': { ort: 'Bern', kanton: 'BE' }, '3015': { ort: 'Bern', kanton: 'BE' }, '3018': { ort: 'Bern', kanton: 'BE' },
  '3019': { ort: 'Bern', kanton: 'BE' }, '3027': { ort: 'Bern', kanton: 'BE' }, '3028': { ort: 'Bern', kanton: 'BE' },
  '4000': { ort: 'Basel', kanton: 'BS' }, '4001': { ort: 'Basel', kanton: 'BS' }, '4002': { ort: 'Basel', kanton: 'BS' },
  '4003': { ort: 'Basel', kanton: 'BS' }, '4004': { ort: 'Basel', kanton: 'BS' }, '4005': { ort: 'Basel', kanton: 'BS' },
  '4006': { ort: 'Basel', kanton: 'BS' }, '4007': { ort: 'Basel', kanton: 'BS' }, '4008': { ort: 'Basel', kanton: 'BS' },
  '4009': { ort: 'Basel', kanton: 'BS' }, '4010': { ort: 'Basel', kanton: 'BS' }, '4011': { ort: 'Basel', kanton: 'BS' },
  '4012': { ort: 'Basel', kanton: 'BS' }, '4013': { ort: 'Basel', kanton: 'BS' }, '4014': { ort: 'Basel', kanton: 'BS' },
  '4015': { ort: 'Basel', kanton: 'BS' }, '4016': { ort: 'Basel', kanton: 'BS' }, '4017': { ort: 'Basel', kanton: 'BS' },
  '4018': { ort: 'Basel', kanton: 'BS' }, '4019': { ort: 'Basel', kanton: 'BS' }, '4020': { ort: 'Basel', kanton: 'BS' },
  '4021': { ort: 'Basel', kanton: 'BS' }, '4022': { ort: 'Basel', kanton: 'BS' }, '4023': { ort: 'Basel', kanton: 'BS' },
  '4024': { ort: 'Basel', kanton: 'BS' }, '4025': { ort: 'Basel', kanton: 'BS' }, '4026': { ort: 'Basel', kanton: 'BS' },
  '4027': { ort: 'Basel', kanton: 'BS' }, '4028': { ort: 'Basel', kanton: 'BS' }, '4029': { ort: 'Basel', kanton: 'BS' },
  '4030': { ort: 'Basel', kanton: 'BS' }, '4031': { ort: 'Basel', kanton: 'BS' }, '4051': { ort: 'Basel', kanton: 'BS' },
  '4052': { ort: 'Basel', kanton: 'BS' }, '4053': { ort: 'Basel', kanton: 'BS' }, '4054': { ort: 'Basel', kanton: 'BS' },
  '4055': { ort: 'Basel', kanton: 'BS' }, '4056': { ort: 'Basel', kanton: 'BS' }, '4057': { ort: 'Basel', kanton: 'BS' },
  '4058': { ort: 'Basel', kanton: 'BS' }, '4059': { ort: 'Basel', kanton: 'BS' }, '4100': { ort: 'Basel', kanton: 'BS' },
  '6000': { ort: 'Luzern', kanton: 'LU' }, '6002': { ort: 'Luzern', kanton: 'LU' }, '6003': { ort: 'Luzern', kanton: 'LU' },
  '6004': { ort: 'Luzern', kanton: 'LU' }, '6005': { ort: 'Luzern', kanton: 'LU' }, '6006': { ort: 'Luzern', kanton: 'LU' },
  '6010': { ort: 'Luzern', kanton: 'LU' }, '6014': { ort: 'Luzern', kanton: 'LU' },
  '9000': { ort: 'St. Gallen', kanton: 'SG' }, '9001': { ort: 'St. Gallen', kanton: 'SG' }, '9004': { ort: 'St. Gallen', kanton: 'SG' },
  '9006': { ort: 'St. Gallen', kanton: 'SG' }, '9007': { ort: 'St. Gallen', kanton: 'SG' }, '9008': { ort: 'St. Gallen', kanton: 'SG' },
  '9010': { ort: 'St. Gallen', kanton: 'SG' }, '9011': { ort: 'St. Gallen', kanton: 'SG' }, '9014': { ort: 'St. Gallen', kanton: 'SG' },
  '9015': { ort: 'St. Gallen', kanton: 'SG' }, '9016': { ort: 'St. Gallen', kanton: 'SG' }, '9020': { ort: 'St. Gallen', kanton: 'SG' },
  '9022': { ort: 'St. Gallen', kanton: 'SG' }, '9023': { ort: 'St. Gallen', kanton: 'SG' }, '9024': { ort: 'St. Gallen', kanton: 'SG' },
  '9026': { ort: 'St. Gallen', kanton: 'SG' }, '9027': { ort: 'St. Gallen', kanton: 'SG' }, '9030': { ort: 'St. Gallen', kanton: 'SG' },
  '9032': { ort: 'St. Gallen', kanton: 'SG' }, '9034': { ort: 'St. Gallen', kanton: 'SG' }, '9036': { ort: 'St. Gallen', kanton: 'SG' },
  '9037': { ort: 'St. Gallen', kanton: 'SG' }, '9038': { ort: 'St. Gallen', kanton: 'SG' }, '9039': { ort: 'St. Gallen', kanton: 'SG' },
  '9042': { ort: 'St. Gallen', kanton: 'SG' }, '9044': { ort: 'St. Gallen', kanton: 'SG' }, '9046': { ort: 'St. Gallen', kanton: 'SG' },
  '9047': { ort: 'St. Gallen', kanton: 'SG' }, '9048': { ort: 'St. Gallen', kanton: 'SG' }, '9049': { ort: 'St. Gallen', kanton: 'SG' },
  '9050': { ort: 'St. Gallen', kanton: 'SG' }, '9052': { ort: 'St. Gallen', kanton: 'SG' }, '9053': { ort: 'St. Gallen', kanton: 'SG' },
  '9054': { ort: 'St. Gallen', kanton: 'SG' }, '9055': { ort: 'St. Gallen', kanton: 'SG' }, '9056': { ort: 'St. Gallen', kanton: 'SG' },
  '9057': { ort: 'St. Gallen', kanton: 'SG' }, '9058': { ort: 'St. Gallen', kanton: 'SG' }, '9059': { ort: 'St. Gallen', kanton: 'SG' },
  '9062': { ort: 'St. Gallen', kanton: 'SG' }, '9063': { ort: 'St. Gallen', kanton: 'SG' }, '9064': { ort: 'St. Gallen', kanton: 'SG' },
  '9065': { ort: 'St. Gallen', kanton: 'SG' }, '9066': { ort: 'St. Gallen', kanton: 'SG' }, '9067': { ort: 'St. Gallen', kanton: 'SG' },
  '9500': { ort: 'Wil', kanton: 'SG' }, '9501': { ort: 'Wil', kanton: 'SG' }, '9503': { ort: 'Wil', kanton: 'SG' },
  '9504': { ort: 'Wil', kanton: 'SG' }, '9505': { ort: 'Wil', kanton: 'SG' }, '9506': { ort: 'Wil', kanton: 'SG' },
  '9507': { ort: 'Wil', kanton: 'SG' }, '9508': { ort: 'Wil', kanton: 'SG' }, '9510': { ort: 'Wil', kanton: 'SG' },
  '9512': { ort: 'Wil', kanton: 'SG' }, '9514': { ort: 'Wil', kanton: 'SG' }, '9515': { ort: 'Wil', kanton: 'SG' },
  '9522': { ort: 'Wil', kanton: 'SG' }, '9523': { ort: 'Wil', kanton: 'SG' }, '9524': { ort: 'Wil', kanton: 'SG' },
  '9525': { ort: 'Wil', kanton: 'SG' }, '9526': { ort: 'Wil', kanton: 'SG' }, '9527': { ort: 'Wil', kanton: 'SG' },
  '9532': { ort: 'Wil', kanton: 'SG' }, '9533': { ort: 'Wil', kanton: 'SG' }, '9534': { ort: 'Wil', kanton: 'SG' },
  '9535': { ort: 'Wil', kanton: 'SG' }, '9536': { ort: 'Wil', kanton: 'SG' }, '9542': { ort: 'Wil', kanton: 'SG' },
  '9543': { ort: 'Wil', kanton: 'SG' }, '9544': { ort: 'Wil', kanton: 'SG' }, '9545': { ort: 'Wil', kanton: 'SG' },
  '9546': { ort: 'Wil', kanton: 'SG' }, '9547': { ort: 'Wil', kanton: 'SG' }, '9548': { ort: 'Wil', kanton: 'SG' },
  '9551': { ort: 'Wil', kanton: 'SG' }, '9552': { ort: 'Wil', kanton: 'SG' }, '9553': { ort: 'Wil', kanton: 'SG' },
  '9554': { ort: 'Wil', kanton: 'SG' }, '9555': { ort: 'Wil', kanton: 'SG' }, '9556': { ort: 'Wil', kanton: 'SG' },
  '9557': { ort: 'Wil', kanton: 'SG' }, '9562': { ort: 'Wil', kanton: 'SG' }, '9564': { ort: 'Wil', kanton: 'SG' },
  '9565': { ort: 'Wil', kanton: 'SG' }, '9600': { ort: 'Wil', kanton: 'SG' }, '9601': { ort: 'Wil', kanton: 'SG' },
  '9602': { ort: 'Wil', kanton: 'SG' }, '9604': { ort: 'Wil', kanton: 'SG' }, '9605': { ort: 'Wil', kanton: 'SG' },
  '9606': { ort: 'Wil', kanton: 'SG' }, '9607': { ort: 'Wil', kanton: 'SG' }, '9608': { ort: 'Wil', kanton: 'SG' },
  '9612': { ort: 'Wil', kanton: 'SG' }, '9613': { ort: 'Wil', kanton: 'SG' }, '9614': { ort: 'Wil', kanton: 'SG' },
  '9615': { ort: 'Wil', kanton: 'SG' }, '9616': { ort: 'Wil', kanton: 'SG' }, '9620': { ort: 'Wil', kanton: 'SG' },
  '9621': { ort: 'Wil', kanton: 'SG' }, '9622': { ort: 'Wil', kanton: 'SG' }, '9623': { ort: 'Wil', kanton: 'SG' },
  '9624': { ort: 'Wil', kanton: 'SG' }, '9625': { ort: 'Wil', kanton: 'SG' }, '9630': { ort: 'Wil', kanton: 'SG' },
  '9631': { ort: 'Wil', kanton: 'SG' }, '9632': { ort: 'Wil', kanton: 'SG' }, '9633': { ort: 'Wil', kanton: 'SG' },
  '9634': { ort: 'Wil', kanton: 'SG' }, '9635': { ort: 'Wil', kanton: 'SG' }, '9636': { ort: 'Wil', kanton: 'SG' },
};

const KANTONE = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'
];

export default function CustomerSelector({ formData, setFormData, selectedCustomer, setSelectedCustomer }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = React.useRef(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['krankenkassen_customer_all'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, 'last_name', 500),
    staleTime: 5 * 60 * 1000,
  });

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    return fullName.includes(q) || (c.email || '').toLowerCase().includes(q);
  }).slice(0, 10);

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
      geschlecht: customer.gender || formData.geschlecht
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(true);
    if (selectedCustomer) {
      setSelectedCustomer(null);
    }
    setFormData({
      ...formData,
      vorname: value,
      nachname: '',
      geburtsdatum: '',
      wohnort: '',
      plz: '',
      kanton: ''
    });
  };

  const handlePlzChange = (plz) => {
    setFormData({ ...formData, plz });
    const plzData = SWISS_ZIP_CODES[plz];
    if (plzData) {
      setFormData(prev => ({
        ...prev,
        wohnort: plzData.ort,
        kanton: plzData.kanton
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