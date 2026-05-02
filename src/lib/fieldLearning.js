/**
 * Field learning – stores user corrections in localStorage
 * so future extractions can benefit from known mappings.
 */

const STORAGE_KEY = 'base44_field_corrections'

function getCorrections() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveCorrections(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

/**
 * Record a user correction for a field.
 * @param {string} field - field key (e.g. 'kassenmodell')
 * @param {string} from  - original extracted value
 * @param {string} to    - corrected value by user
 */
export function recordCorrection(field, from, to) {
  if (!from || !to || from === to) return
  const corrections = getCorrections()
  if (!corrections[field]) corrections[field] = {}
  corrections[field][from] = to
  saveCorrections(corrections)
}

/**
 * Apply learned corrections to a normalized data object.
 * @param {object} normalized - flat normalized fields
 * @returns {object} patched normalized object
 */
export function applyLearned(normalized) {
  const corrections = getCorrections()
  const result = { ...normalized }
  for (const [field, mapping] of Object.entries(corrections)) {
    if (result[field] && mapping[result[field]]) {
      result[field] = mapping[result[field]]
    }
  }
  return result
}