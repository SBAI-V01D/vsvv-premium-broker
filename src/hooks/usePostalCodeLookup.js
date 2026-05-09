import { useState, useCallback } from 'react';
import { lookupPostalCode, isValidPostalCode } from '@/lib/swissPostalCodes';

/**
 * Hook for postal code lookup and automatic city/canton assignment
 */
export function usePostalCodeLookup() {
  const [plzError, setPlzError] = useState('');
  const [plzSuggestions, setPlzSuggestions] = useState(null);

  const handlePostalCodeChange = useCallback((plz, onUpdate) => {
    setPlzError('');
    setPlzSuggestions(null);

    if (!plz) {
      onUpdate({ city: '', canton: '' });
      return;
    }

    // Only process when 4 digits entered
    if (plz.length !== 4) {
      return;
    }

    if (!isValidPostalCode(plz)) {
      setPlzError('Ungültige PLZ (4 Ziffern erforderlich)');
      onUpdate({ city: '', canton: '' });
      return;
    }

    const result = lookupPostalCode(plz);

    if (!result) {
      // PLZ not in DB — allow manual input, don't clear fields, no error shown
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

    // Multiple matches - show dropdown
    if (result.length > 1) {
      setPlzSuggestions(result);
      onUpdate({ city: '', canton: '' });
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