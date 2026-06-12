// Mapping: Kassenname → verfügbare Modelle (basierend auf BAG/PrimAI 2026)
// Wenn Kasse nicht im Map → alle 4 Standardmodelle anbieten
export const KASSE_MODELL_MAP = {
  'Agrisano': ['Standard', 'Hausarzt', 'Telmed'],
  'Aquilana': ['Standard', 'Hausarzt', 'Telmed'],
  'Assura': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Atupri': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Avenir (Groupe Mutuel)': ['Standard', 'Telmed'],
  'easy sana (Groupe Mutuel)': ['Standard', 'Telmed'],
  'AMB Assurance (Groupe Mutuel)': ['Standard', 'Telmed'],
  'Philos (Groupe Mutuel)': ['Standard', 'Telmed'],
  'Mutuel (Groupe Mutuel)': ['Standard', 'Telmed'],
  'CMVEO': ['Standard', 'Hausarzt', 'Telmed'],
  'Concordia': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'CSS': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Curaulta': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'EGK': ['Standard', 'Hausarzt', 'Telmed'],
  'Einsiedler Krankenkasse': ['Standard', 'Hausarzt', 'Telmed'],
  'Galenos (Visana)': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Glarner Krankenversicherung': ['Standard', 'Hausarzt', 'Telmed'],
  'Helsana': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'KPT': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Krankenkasse Birchmeier': ['Standard', 'Hausarzt', 'Telmed'],
  'Krankenkasse Luzerner Hinterland': ['Standard', 'Hausarzt', 'Telmed'],
  'Krankenkasse Steffisburg': ['Standard', 'Hausarzt', 'Telmed'],
  'Krankenkasse Wädenswil': ['Standard', 'Hausarzt', 'Telmed'],
  'ÖKK': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'rhenusana': ['Standard', 'Hausarzt', 'Telmed'],
  'sana24 (Visana)': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Sanitas': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'SLKK': ['Standard', 'Hausarzt', 'Telmed'],
  'sodalis': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Sumiswalder Krankenkasse': ['Standard', 'Hausarzt', 'Telmed'],
  'SWICA': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Visana': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
  'Vivao Sympany': ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
};

export const ALL_STANDARD_MODELS = ['Standard', 'Hausarzt', 'HMO', 'Telmed'];

/** Gibt die verfügbaren Modelle für eine Kasse zurück */
export function getModelsForKasse(kasse) {
  if (!kasse) return ALL_STANDARD_MODELS;
  return KASSE_MODELL_MAP[kasse] || ALL_STANDARD_MODELS;
}