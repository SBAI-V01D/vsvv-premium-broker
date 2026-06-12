// Mapping: Kassenname → verfügbare Modelle für das "Aktuelles Modell"-Dropdown
// Basierend auf priminfo.ch / BAG 2026
// 'Weitere' = Sondermodelle die die API als 'other' liefert (PrimaFlex, Sanatel etc.)

export const KASSE_MODELL_MAP = {
  // ── Agrisano ──────────────────────────────────────────────────────────
  'Agrisano': ['Standard', 'Hausarzt', 'Telmed'],

  // ── Aquilana ──────────────────────────────────────────────────────────
  'Aquilana': ['Standard', 'Hausarzt', 'Telmed'],

  // ── Assura ────────────────────────────────────────────────────────────
  'Assura': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Atupri ────────────────────────────────────────────────────────────
  'Atupri': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Groupe Mutuel (alle Marken) ────────────────────────────────────────
  // Modelle gem. priminfo.ch: Standard, Hausarzt (PrimaCare), HMO (OptiMed), Weitere (PrimaFlex/Sanatel)
  'Mutuel (Groupe Mutuel)': ['Standard', 'Hausarzt', 'HMO', 'Weitere'],
  'Avenir (Groupe Mutuel)': ['Standard', 'Hausarzt', 'HMO', 'Weitere'],
  'easy sana (Groupe Mutuel)': ['Standard', 'Hausarzt', 'HMO', 'Weitere'],
  'AMB Assurance (Groupe Mutuel)': ['Standard', 'Hausarzt', 'HMO', 'Weitere'],
  'Philos (Groupe Mutuel)': ['Standard', 'Hausarzt', 'HMO', 'Weitere'],

  // ── CMVEO ─────────────────────────────────────────────────────────────
  'CMVEO': ['Standard', 'Hausarzt', 'Telmed'],

  // ── Concordia ─────────────────────────────────────────────────────────
  'Concordia': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── CSS ───────────────────────────────────────────────────────────────
  'CSS': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Curaulta ──────────────────────────────────────────────────────────
  'Curaulta': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── EGK ───────────────────────────────────────────────────────────────
  'EGK': ['Standard', 'Hausarzt', 'Telmed'],

  // ── Einsiedler ────────────────────────────────────────────────────────
  'Einsiedler Krankenkasse': ['Standard', 'Hausarzt', 'Telmed'],

  // ── Galenos (Visana) ──────────────────────────────────────────────────
  'Galenos (Visana)': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Glarner ───────────────────────────────────────────────────────────
  'Glarner Krankenversicherung': ['Standard', 'Hausarzt', 'Telmed'],

  // ── Helsana ───────────────────────────────────────────────────────────
  'Helsana': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── KPT ───────────────────────────────────────────────────────────────
  'KPT': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Kleine Kassen ─────────────────────────────────────────────────────
  'Krankenkasse Birchmeier': ['Standard', 'Hausarzt', 'Telmed'],
  'Krankenkasse Luzerner Hinterland': ['Standard', 'Hausarzt', 'Telmed'],
  'Krankenkasse Steffisburg': ['Standard', 'Hausarzt', 'Telmed'],
  'Krankenkasse Wädenswil': ['Standard', 'Hausarzt', 'Telmed'],

  // ── ÖKK ───────────────────────────────────────────────────────────────
  'ÖKK': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── rhenusana ─────────────────────────────────────────────────────────
  'rhenusana': ['Standard', 'Hausarzt', 'Telmed'],

  // ── sana24 (Visana) ───────────────────────────────────────────────────
  'sana24 (Visana)': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Sanitas ───────────────────────────────────────────────────────────
  'Sanitas': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── SLKK ──────────────────────────────────────────────────────────────
  'SLKK': ['Standard', 'Hausarzt', 'Telmed'],

  // ── sodalis ───────────────────────────────────────────────────────────
  'sodalis': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Sumiswalder ───────────────────────────────────────────────────────
  'Sumiswalder Krankenkasse': ['Standard', 'Hausarzt', 'Telmed'],

  // ── SWICA ─────────────────────────────────────────────────────────────
  'SWICA': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Visana ────────────────────────────────────────────────────────────
  'Visana': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],

  // ── Vivao Sympany ─────────────────────────────────────────────────────
  'Vivao Sympany': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
};

// Die 4 Standard-Modell-Filter-Kategorien (Checkboxen immer sichtbar)
export const ALL_STANDARD_MODELS = ['Standard', 'Hausarzt', 'HMO', 'Telmed'];

/** Gibt die verfügbaren Modelle für eine Kasse zurück (für Dropdown "Aktuelles Modell") */
export function getModelsForKasse(kasse) {
  if (!kasse) return ALL_STANDARD_MODELS;
  return KASSE_MODELL_MAP[kasse] || ALL_STANDARD_MODELS;
}