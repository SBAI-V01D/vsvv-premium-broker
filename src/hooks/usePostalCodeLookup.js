import { useState, useCallback } from 'react';
import { lookupPostalCode, isValidPostalCode, fixOcrPostalCode } from '@/lib/swissPostalCodes';

/**
 * Hook for postal code lookup and automatic city/canton assignment
 */
export function usePostalCodeLookup() {
  const [plzError, setPlzError] = useState('');
  const [plzSuggestions, setPlzSuggestions] = useState(null);

  const handlePostalCodeChange = useCallback((rawPlz, onUpdate) => {
    setPlzError('');
    setPlzSuggestions(null);

    if (!rawPlz) {
      onUpdate({ city: '', canton: '' });
      return;
    }

    // Auto-fix OCR mistakes (O→0, l→1) silently
    const plz = fixOcrPostalCode(rawPlz);

    // Only process when 4 digits entered
    if (plz.length !== 4) {
      return;
    }

    if (!isValidPostalCode(plz)) {
      setPlzError('Ungültige PLZ (nur 4 Ziffern erlaubt)');
      onUpdate({ city: '', canton: '' });
      return;
    }

    const result = lookupPostalCode(plz);

    if (!result) {
      // PLZ not in DB — allow manual input, no error shown
      setPlzError('');
      return;
    }

    // Single match - auto-assign
    if (!Array.isArray(result)) {
      onUpdate({
        city: result.ort,
        canton: result.kanton,
        autoFilled: true,
      });
      return;
    }

    // Multiple matches - show dropdown (do NOT clear existing city/canton)
    if (result.length > 1) {
      setPlzSuggestions(result);
    }
  }, []);

  const selectSuggestion = useCallback((suggestion, onUpdate) => {
    onUpdate({
      city: suggestion.ort,
      canton: suggestion.kanton,
      autoFilled: true,
    });
    setPlzSuggestions(null);
  }, []);

  return {
    plzError,
    plzSuggestions,
    handlePostalCodeChange,
    selectSuggestion,
    setPlzError,
    setPlzSuggestions,
  };
}