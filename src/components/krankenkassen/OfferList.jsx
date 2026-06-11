import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Offizielle BAG-Produktnamen je Versicherer + Modellkategorie
// Quelle: BAG priminfo 2026 / krankenversicherung.ch — verifizierte offizielle Bezeichnungen
// HINWEIS: Die PrimAI API liefert Modell-Keys wie 'standard', 'telmed', 'gp', 'hmo', 'other'
// Diese werden via MODEL_ALIAS_MAP auf die Standard-Kategorien normalisiert.

// Normalisiert API-Modell-Keys → Standard-Kategorie
export const MODEL_ALIAS_MAP = {
  // Standard / freie Arztwahl
  'standard': 'Standard',
  'free_choice': 'Standard',
  'freie_arztwahl': 'Standard',
  // Telmed
  'telmed': 'Telmed',
  'phone_first': 'Telmed',
  'telemedicine': 'Telmed',
  'tel': 'Telmed',
  // Hausarzt / GP
  'gp': 'Hausarzt',
  'hausarzt': 'Hausarzt',
  'family_doctor': 'Hausarzt',
  'managed_care': 'Hausarzt',
  // HMO
  'hmo': 'HMO',
  'group_practice': 'HMO',
  // Andere (als Standard behandeln)
  'other': 'Standard',
};

// Groupe Mutuel Produkt-Mapping (gilt für alle GM-Varianten)
const GM = {
  'Standard': 'Primaflex (freie Arztwahl)',
  'Hausarzt': 'PrimaCare',
  'Telmed': 'SanaTel',
  'HMO': 'OptiMed',
};

const PRODUKT_NAMEN = {
  // ── CSS ──────────────────────────────────────────────────────────────
  'CSS': {
    'Standard': 'CSS Gesundheit (freie Arztwahl)',
    'Hausarzt': 'Hausarzt Profit',
    'Telmed': 'TelMed',
    'HMO': 'Multimed',
  },
  'CSS Kranken-Versicherung AG': {
    'Standard': 'CSS Gesundheit (freie Arztwahl)',
    'Hausarzt': 'Hausarzt Profit',
    'Telmed': 'TelMed',
    'HMO': 'Multimed',
  },
  // ── Helsana ──────────────────────────────────────────────────────────
  'Helsana': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'BeneFit PLUS Hausarzt',
    'Telmed': 'BeneFit PLUS Telmed',
    'HMO': 'Premed',
  },
  'Helsana Versicherungen AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'BeneFit PLUS Hausarzt',
    'Telmed': 'BeneFit PLUS Telmed',
    'HMO': 'Premed',
  },
  // ── SWICA ────────────────────────────────────────────────────────────
  'SWICA': {
    'Standard': 'SWICA (freie Arztwahl)',
    'Hausarzt': 'BENECASA / Hausarzt',
    'Telmed': 'Telmed',
    'HMO': 'Medica / Santé',
  },
  'SWICA Krankenversicherung AG': {
    'Standard': 'SWICA (freie Arztwahl)',
    'Hausarzt': 'BENECASA / Hausarzt',
    'Telmed': 'Telmed',
    'HMO': 'Medica / Santé',
  },
  // ── Sanitas ──────────────────────────────────────────────────────────
  'Sanitas': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarztmodell',
    'Telmed': 'CallMed',
    'HMO': 'Netmed',
  },
  'Sanitas Krankenversicherung AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarztmodell',
    'Telmed': 'CallMed',
    'HMO': 'Netmed',
  },
  // ── Concordia ────────────────────────────────────────────────────────
  'Concordia': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'myDoc',
    'HMO': 'HMO',
    'Telmed': 'Telmed',
  },
  'CONCORDIA': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'myDoc',
    'HMO': 'HMO',
    'Telmed': 'Telmed',
  },
  'Concordia Kranken- und Unfallversicherung AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'myDoc',
    'HMO': 'HMO',
    'Telmed': 'Telmed',
  },
  // ── Visana ───────────────────────────────────────────────────────────
  'Visana': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Care / Tel Doc',
    'HMO': 'MedDirect',
  },
  'Visana Versicherungen AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Care / Tel Doc',
    'HMO': 'MedDirect',
  },
  // ── sana24 (Visana-Gruppe) ────────────────────────────────────────────
  'sana24': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Care / Tel Doc',
    'HMO': 'Med Direct',
  },
  'sana24 (Visana)': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Care / Tel Doc',
    'HMO': 'Med Direct',
  },
  'sana24 AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Care / Tel Doc',
    'HMO': 'Med Direct',
  },
  // ── Galenos (Visana-Gruppe) ───────────────────────────────────────────
  'Galenos': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Doc',
    'HMO': 'Combi Care',
  },
  'Galenos (Visana)': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Doc',
    'HMO': 'Combi Care',
  },
  'GALENOS AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Doc',
    'HMO': 'Combi Care',
  },
  // ── Atupri ───────────────────────────────────────────────────────────
  'Atupri': {
    'Standard': 'FlexCare (freie Arztwahl)',
    'Hausarzt': 'CareMed',
    'Telmed': 'TelFirst',
    'HMO': 'SmartCare',
  },
  'Atupri Gesundheitsversicherung AG': {
    'Standard': 'FlexCare (freie Arztwahl)',
    'Hausarzt': 'CareMed',
    'Telmed': 'TelFirst',
    'HMO': 'SmartCare',
  },
  // ── Assura ───────────────────────────────────────────────────────────
  'Assura': {
    'Standard': 'Qualimed (freie Arztwahl)',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Qualimed Telemed',
    'HMO': 'Gesundheitsnetz',
  },
  'Assura-Basis SA': {
    'Standard': 'Qualimed (freie Arztwahl)',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Qualimed Telemed',
    'HMO': 'Gesundheitsnetz',
  },
  // ── KPT ──────────────────────────────────────────────────────────────
  'KPT': {
    'Standard': 'win.easy (freie Arztwahl)',
    'Hausarzt': 'win.win',
    'Telmed': 'win.plus',
    'HMO': 'win.smart',
  },
  'KPT Krankenkasse AG': {
    'Standard': 'win.easy (freie Arztwahl)',
    'Hausarzt': 'win.win',
    'Telmed': 'win.plus',
    'HMO': 'win.smart',
  },
  // ── Aquilana ─────────────────────────────────────────────────────────
  'Aquilana': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Casamed',
    'Telmed': 'Smartmed',
  },
  'Aquilana Versicherungen': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Casamed',
    'Telmed': 'Smartmed',
  },
  // ── ÖKK ──────────────────────────────────────────────────────────────
  'ÖKK': {
    'Standard': 'Select (freie Arztwahl)',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telemedizin',
    'HMO': 'HMO / Casamed 24',
  },
  // ── Agrisano ─────────────────────────────────────────────────────────
  'Agrisano': {
    'Standard': 'AGRIsmart (freie Arztwahl)',
    'Hausarzt': 'AGRIcontact',
    'Telmed': 'AGRIeco',
  },
  'Agrisano Krankenkasse AG': {
    'Standard': 'AGRIsmart (freie Arztwahl)',
    'Hausarzt': 'AGRIcontact',
    'Telmed': 'AGRIeco',
  },
  // ── EGK ──────────────────────────────────────────────────────────────
  'EGK': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'EGK Care',
    'Telmed': 'EGK Telmed',
  },
  'EGK-Gesundheitskasse': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'EGK Care',
    'Telmed': 'EGK Telmed',
  },
  // ── Groupe Mutuel (alle Varianten identisch) ──────────────────────────
  'Mutuel': GM,
  'Mutuel (Groupe Mutuel)': GM,
  'Mutuel Krankenversicherung AG': GM,
  'Mutuel Assurances': GM,
  'easy sana (Groupe Mutuel)': GM,
  'AMB Assurance (Groupe Mutuel)': GM,
  'Avenir': GM,
  'Avenir (Groupe Mutuel)': GM,
  'Avenir Krankenversicherung AG': GM,
  'Philos': GM,
  'Philos (Groupe Mutuel)': GM,
  'Philos Krankenversicherung AG': GM,
  'easy sana': GM,
  'AMB': GM,
  'Groupe Mutuel': GM,
  // ── Vivao Sympany ────────────────────────────────────────────────────
  'Vivao Sympany': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'FlexHelp 24',
    'HMO': 'HMO',
  },
  'Vivao Sympany AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'FlexHelp 24',
    'HMO': 'HMO',
  },
  // ── Sumiswalder ───────────────────────────────────────────────────────
  'Sumiswalder': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  'Sumiswalder Krankenkasse': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Sodalis ───────────────────────────────────────────────────────────
  'sodalis': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
    'HMO': 'HMO',
  },
  // ── SLKK ───────────────────────────────────────────────────────────
  'SLKK': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── rhenusana ─────────────────────────────────────────────────────────
  'rhenusana': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Einsiedler ────────────────────────────────────────────────────────
  'Einsiedler Krankenkasse': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Krankenkasse Wädenswil ────────────────────────────────────────────
  'Krankenkasse Wädenswil': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Krankenkasse Birchmeier ───────────────────────────────────────────
  'Krankenkasse Birchmeier': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Glarner ───────────────────────────────────────────────────────────
  'Glarner Krankenversicherung': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Luzerner Hinterland ───────────────────────────────────────────────
  'Krankenkasse Luzerner Hinterland': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Steffisburg ───────────────────────────────────────────────────────
  'Krankenkasse Steffisburg': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
  // ── Curaulta ──────────────────────────────────────────────────────────
  'Curaulta': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
    'HMO': 'HMO',
  },
  // ── CMVEO ─────────────────────────────────────────────────────────────
  'CMVEO': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
  },
};

const ABZUG_UMWELTABGABE = 5.15;

// Normalisiert API-Modell-Key → Kategorie (z.B. 'gp' → 'Hausarzt', 'telmed' → 'Telmed')
export function normalizeModel(model) {
  if (!model) return 'Standard';
  return MODEL_ALIAS_MAP[model.toLowerCase()] || model;
}

export function getProduktName(insurer, model) {
  const normalized = normalizeModel(model);
  // Exakten Treffer versuchen, dann normalisierten
  return PRODUKT_NAMEN[insurer]?.[normalized] || PRODUKT_NAMEN[insurer]?.[model] || normalized || model;
}

export function nettoPreis(bruttoPreis) {
  return Math.max(0, bruttoPreis - ABZUG_UMWELTABGABE);
}

export default function OfferList({
  offers,
  currentOffer,
  currentPraemie,
  selectedResult,
  onSelect,
  cheapestOffer,
}) {
  const sortedOffers = [...offers].sort((a, b) => (a.monthly_premium || 0) - (b.monthly_premium || 0));
  const cheapestPraemie = cheapestOffer?.monthly_premium;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Alle Angebote</span>
          <div className="flex items-center gap-3">
            {selectedResult && cheapestOffer && (
              <span className="text-xs text-muted-foreground font-normal">
                Günstigste: <span className="font-semibold text-emerald-700">CHF {nettoPreis(cheapestPraemie).toFixed(2)}</span>
              </span>
            )}
            <span className="text-xs text-muted-foreground font-normal">{offers.length} Angebote · BAG 2026</span>
          </div>
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Nettoprämie (Bruttoprämie − CHF {ABZUG_UMWELTABGABE} Umweltabgabe)
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[520px] overflow-y-auto">
          <div className="divide-y divide-border">
            {sortedOffers.map((offer, idx) => {
              const isSelected = selectedResult?.insurer === offer.insurer &&
                selectedResult?.model === offer.model &&
                selectedResult?.monthly_premium === offer.monthly_premium;
              const isCurrent = currentOffer &&
                offer.insurer === currentOffer.insurer &&
                normalizeModel(offer.model) === normalizeModel(currentOffer.model) &&
                Math.abs(offer.monthly_premium - currentOffer.monthly_premium) < 0.1;
              const isCheapest = idx === 0;
              const nettoMonat = nettoPreis(offer.monthly_premium);
              const savings = currentPraemie ? nettoPreis(currentPraemie) - nettoMonat : null;
              const savingsYear = savings !== null ? Math.round(savings * 12) : null;
              const produktName = getProduktName(offer.insurer, offer.model);

              // Hintergrund-Styling
              let rowClass = 'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ';
              if (isSelected) rowClass += 'bg-primary/8 border-l-4 border-l-primary ';
              else if (isCurrent) rowClass += 'bg-amber-50 border-l-4 border-l-amber-400 ';
              else rowClass += 'hover:bg-muted/40 ';

              return (
                <button
                  key={`${offer.insurer}-${offer.model}-${offer.monthly_premium}-${idx}`}
                  onClick={() => onSelect(isSelected ? null : offer)}
                  className={rowClass}
                >
                  {/* Rang */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${isCurrent ? 'bg-amber-200 text-amber-800' : isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold truncate">{offer.insurer}</p>
                      {isCheapest && !isCurrent && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Günstigste</Badge>
                      )}
                      {isCurrent && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300">Aktuell</Badge>
                      )}
                      {isSelected && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Ausgewählt</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{produktName}</p>
                  </div>

                  {/* Preis + Ersparnis */}
                  <div className="text-right shrink-0 min-w-[110px]">
                    <p className="text-sm font-bold">CHF {nettoMonat.toFixed(2)}/M.</p>
                    {savingsYear !== null && savingsYear > 0 && (
                      <p className="text-xs text-emerald-600 font-semibold">−CHF {savingsYear.toLocaleString('de-CH')}/J.</p>
                    )}
                    {savingsYear !== null && savingsYear < 0 && (
                      <p className="text-xs text-red-500 font-semibold">+CHF {Math.abs(savingsYear).toLocaleString('de-CH')}/J. teurer</p>
                    )}
                    {savingsYear === 0 && currentPraemie && (
                      <p className="text-xs text-muted-foreground">gleiche Prämie</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}