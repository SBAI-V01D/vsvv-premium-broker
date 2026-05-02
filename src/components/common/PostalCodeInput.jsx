import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PostalCodeInput({
  plz,
  city,
  canton,
  cantons,
  plzError,
  plzSuggestions,
  autoFilled,
  onPlzChange,
  onCityChange,
  onCantonChange,
  onSelectSuggestion,
  onErrorClear,
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Postleitzahl (PLZ) *</Label>
          <div className="relative mt-1">
            <Input
              type="text"
              inputMode="numeric"
              maxLength="4"
              value={plz}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                onPlzChange(val);
              }}
              placeholder="z.B. 8001"
              className={`${plzError ? 'border-red-500' : ''} ${
                autoFilled && !plzError ? 'border-green-500' : ''
              }`}
            />
            {autoFilled && !plzError && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
            )}
            {plzError && (
              <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-600" />
            )}
          </div>
          {plzError && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              {plzError}
            </p>
          )}
        </div>

        <div>
          <Label>Ort *</Label>
          <Input
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="Automatisch ergänzt"
            className="mt-1"
          />
          {autoFilled && city && (
            <p className="text-xs text-green-600 mt-1">✓ Automatisch ergänzt</p>
          )}
        </div>

        <div>
          <Label>Kanton</Label>
          <Select value={canton} onValueChange={onCantonChange}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Wählen" />
            </SelectTrigger>
            <SelectContent>
              {cantons.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {plzSuggestions && plzSuggestions.length > 1 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Mehrere Orte für PLZ {plz} gefunden. Bitte auswählen:
          </p>
          <div className="space-y-2">
            {plzSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectSuggestion(suggestion)}
                className="w-full text-left p-2 rounded hover:bg-amber-100 transition-colors border border-amber-200 text-sm"
              >
                {suggestion.ort} ({suggestion.kanton})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}