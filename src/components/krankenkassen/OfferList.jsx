import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Offizielle BAG-Produktnamen je Versicherer + Modellkategorie
// Quelle: BAG priminfo 2026 / krankenversicherung.ch — verifizierte offizielle Bezeichnungen
// HINWEIS: Die PrimAI API liefert Modell-Keys wie 'standard', 'telmed', 'gp', 'hmo', 'other'
// Diese werden via MODEL_ALIAS_MAP auf die Standard-Kategorien normalisiert.

// Normalisiert API-Modell-Keys → Standard-Kategorie
// WICHTIG: 'other' wird NICHT mehr zu 'Hausarzt' — stattdessen als eigenes Modell behalten
// damit PrimaFlex, Sanatel etc. als "Weitere Modelle" erscheinen
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
  // Hausarzt / GP — nur explizite Hausarzt-Keys
  'gp': 'Hausarzt',
  'hausarzt': 'Hausarzt',
  'family_doctor': 'Hausarzt',
  'managed_care': 'Hausarzt',
  // HMO
  'hmo': 'HMO',
  'group_practice': 'HMO',
  // 'other' wird NICHT gemappt → bleibt als "other" → erscheint als "Weitere Modelle"
};

// Groupe Mutuel Produkt-Mapping (gilt für alle GM-Varianten)
// Quelle: priminfo.ch 2026
// Standard = Grundversicherung (freie Arztwahl)
// Hausarzt = PrimaCare
// HMO = OptiMed
// Telmed = SanaTel (nicht bei allen GM-Gesellschaften verfügbar)
// Weitere = PrimaFlex, Sanatel (API liefert diese als 'other')
const GM = {
  'Standard': 'Grundversicherung (freie Arztwahl)',
  'Hausarzt': 'PrimaCare',
  'HMO': 'OptiMed',
  'Telmed': 'SanaTel',
  'Weitere': 'PrimaFlex / Sanatel',
};

// Atupri Produkt-Mapping
const ATUPRI = {
  'Standard': 'FlexCare (freie Arztwahl)',
  'Hausarzt': 'CareMed',
  'Telmed': 'TelFirst',
  'HMO': 'SmartCare',
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
  // API liefert mehrere Hausarzt-Einträge: günstiger = Flexmed R1, teurer = Hausarzt R1
  'Helsana': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'BeneFit PLUS Hausarzt / Flexmed',
    'Telmed': 'BeneFit PLUS Telmed',
    'HMO': 'Premed',
  },
  'Helsana Versicherungen AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'BeneFit PLUS Hausarzt / Flexmed',
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
  // API liefert mehrere Standard-Einträge: günstiger = Qualimed, teurer = Hausspital
  'Assura': {
    'Standard': 'Qualimed / Hausspital',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Qualimed Telemed',
    'HMO': 'Gesundheitsnetz',
  },
  'Assura-Basis SA': {
    'Standard': 'Qualimed / Hausspital',
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
  // ── Groupe Mutuel (alle Varianten identisch — API gibt "Mutuel Krankenversicherung AG" etc.)
  'Mutuel': GM,
  'Mutuel (Groupe Mutuel)': GM,
  'Mutuel Krankenversicherung AG': GM,
  'Mutuel Assurances': GM,
  'easy sana (Groupe Mutuel)': GM,
  'easy sana': GM,
  'AMB Assurance (Groupe Mutuel)': GM,
  'AMB': GM,
  'Avenir': GM,
  'Avenir (Groupe Mutuel)': GM,
  'Avenir Krankenversicherung AG': GM,
  'Philos': GM,
  'Philos (Groupe Mutuel)': GM,
  'Philos Krankenversicherung AG': GM,
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
  // ── Atupri (API-Name) ─────────────────────────────────────────────────
  'Atupri Gesundheitsversicherung AG': ATUPRI,
  // ── CONCORDIA (API-Name gross) ────────────────────────────────────────
  'CONCORDIA': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'myDoc',
    'HMO': 'HMO',
    'Telmed': 'Telmed',
  },
  // ── GALENOS (API-Name) ─────────────────────────────────────────────────
  'GALENOS AG': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Doc',
    'HMO': 'Combi Care',
  },
  // ── sana24 (API-Name ohne "(Visana)") ─────────────────────────────────
  'sana24': {
    'Standard': 'Freie Arztwahl',
    'Hausarzt': 'Managed Care',
    'Telmed': 'Tel Care',
    'HMO': 'Med Direct',
  },
  // ── vita surselva ─────────────────────────────────────────────────────
  'vita surselva': {
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

// Mappt API-Versicherernamen auf schöne Anzeigenamen
const INSURER_DISPLAY_NAMES = {
  'Assura-Basis SA': 'Assura',
  'Atupri Gesundheitsversicherung AG': 'Atupri',
  'Mutuel Krankenversicherung AG': 'Mutuel (Groupe Mutuel)',
  'Avenir Krankenversicherung AG': 'Avenir (Groupe Mutuel)',
  'Philos Krankenversicherung AG': 'Philos (Groupe Mutuel)',
  'CONCORDIA': 'Concordia',
  'GALENOS AG': 'Galenos (Visana)',
  'sana24': 'sana24 (Visana)',
  'sana24 AG': 'sana24 (Visana)',
  'vita surselva': 'Vita Surselva',
  'Sumiswalder': 'Sumiswalder KK',
  'rhenusana': 'Rhenusana',
};

export function getDisplayName(insurer) {
  return INSURER_DISPLAY_NAMES[insurer] || insurer;
}

// Fuzzy-match ob zwei Versicherernamen zur gleichen Kasse gehören
export function matchesInsurer(a, b) {
  if (!a || !b) return false;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return true;
  // Prüfe ob ein Name im anderen enthalten (erste Wort reicht)
  const aFirst = al.split(/[\s(,]/)[0];
  const bFirst = bl.split(/[\s(,]/)[0];
  if (aFirst.length > 3 && (al.includes(aFirst) && bl.includes(aFirst))) return true;
  if (bFirst.length > 3 && (al.includes(bFirst) && bl.includes(bFirst))) return true;
  return false;
}

// Normalisiert API-Modell-Key → Kategorie (z.B. 'gp' → 'Hausarzt', 'telmed' → 'Telmed')
export function normalizeModel(model) {
  if (!model) return 'Standard';
  const mapped = MODEL_ALIAS_MAP[model.toLowerCase()];
  if (mapped) return mapped;
  // Unbekannte Modelle: originalen Wert kapitalisiert zurückgeben (z.B. 'other' → 'Weitere')
  // 'other' ist der API-Key für Groupe Mutuel PrimaFlex/Sanatel und ähnliche Sondermodelle
  if (model.toLowerCase() === 'other') return 'Weitere';
  // Sonstige: Original-Key mit Grossbuchstabe
  return model.charAt(0).toUpperCase() + model.slice(1);
}

export function getProduktName(insurer, model) {
  const normalized = normalizeModel(model);
  // 1. Exakter API-Name
  if (PRODUKT_NAMEN[insurer]?.[normalized]) return PRODUKT_NAMEN[insurer][normalized];
  if (PRODUKT_NAMEN[insurer]?.[model]) return PRODUKT_NAMEN[insurer][model];
  // 2. Display-Name (z.B. API gibt "Mutuel Krankenversicherung AG", Mapping unter "Mutuel (Groupe Mutuel)")
  const displayName = INSURER_DISPLAY_NAMES[insurer];
  if (displayName && PRODUKT_NAMEN[displayName]?.[normalized]) return PRODUKT_NAMEN[displayName][normalized];
  if (displayName && PRODUKT_NAMEN[displayName]?.[model]) return PRODUKT_NAMEN[displayName][model];
  return normalized || model;
}

export function nettoPreis(bruttoPreis) {
  return Math.max(0, bruttoPreis - ABZUG_UMWELTABGABE);
}

export default function OfferList({
  offers,            // bereits sortiert von KrankenkassenVergleich
  currentKasseInput, // raw user input z.B. "Mutuel (Groupe Mutuel)"
  currentModellInput, // raw user input z.B. "Hausarzt"
  currentOffer,
  currentPraemie,
  selectedResult,
  onSelect,
  cheapestOffer,
  aktuellRef,
  onScrollToAktuellReady,
}) {
  // KEINE eigene Sortierung — offers kommen bereits sortiert rein
  const sortedOffers = offers;
  const cheapestPraemie = cheapestOffer?.monthly_premium;
  const scrollContainerRef = React.useRef(null);

  // Scroll-Helfer: scrollt den internen Container zum aktuellen Eintrag
  const scrollToAktuell = React.useCallback(() => {
    if (!aktuellRef?.current || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const el = aktuellRef.current;
    const elTop = el.offsetTop;
    const elHeight = el.offsetHeight;
    const containerHeight = container.clientHeight;
    container.scrollTo({ top: elTop - containerHeight / 2 + elHeight / 2, behavior: 'smooth' });
  }, [aktuellRef]);

  // Scroll-Funktion an Parent weitergeben (für Banner-Button)
  React.useEffect(() => {
    if (onScrollToAktuellReady) onScrollToAktuellReady(scrollToAktuell);
  }, [scrollToAktuell, onScrollToAktuellReady]);

  // Kein Auto-Scroll — Liste beginnt immer bei Rang 1 (günstigstes Angebot)
  // Aktueller Eintrag ist via Amber-Highlight visuell erkennbar beim Scrollen



  // Normalisiertes Modell des Kunden — aus direktem Input (zuverlässiger als aus currentOffer.model)
  const currentModellNorm = currentModellInput
    ? normalizeModel(currentModellInput)
    : currentOffer ? normalizeModel(currentOffer.model) : null;

  // firstCurrentIdx: Index des Eintrags der zur aktuellen Kasse + aktuellem Modell passt
  // Fallback: erster Kasse-Treffer
  const firstCurrentIdx = React.useMemo(() => {
    if (!currentKasseInput && !currentOffer) return -1;
    const matchKasse = (o) => currentKasseInput
      ? matchesInsurer(o.insurer, currentKasseInput)
      : matchesInsurer(o.insurer, currentOffer.insurer);

    // 1. Kasse + Modell
    if (currentModellNorm) {
      const exactIdx = sortedOffers.findIndex(o =>
        matchKasse(o) && normalizeModel(o.model) === currentModellNorm
      );
      if (exactIdx !== -1) return exactIdx;
    }
    // 2. Fallback: nur Kasse
    return sortedOffers.findIndex(o => matchKasse(o));
  }, [sortedOffers, currentKasseInput, currentOffer, currentModellNorm]);

  // Zähler pro Insurer+Modell für Produktvarianten-Label (z.B. "Variante 2")
  const variantCounters = React.useMemo(() => {
    const counters = new Map();
    const result = [];
    for (const o of sortedOffers) {
      const key = `${o.insurer}|||${o.model}`;
      const n = (counters.get(key) || 0) + 1;
      counters.set(key, n);
      result.push(n);
    }
    return result;
  }, [sortedOffers]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Alle Angebote</span>
          <div className="flex items-center gap-3">
            {cheapestOffer && (
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
        <div ref={scrollContainerRef} className="max-h-[680px] overflow-y-auto">
          <div className="divide-y divide-border">
            {sortedOffers.map((offer, idx) => {
              const isSelected = selectedResult?.insurer === offer.insurer &&
                selectedResult?.model === offer.model &&
                selectedResult?.monthly_premium === offer.monthly_premium;
              // isCurrent: Kasse stimmt überein UND es ist der erste Treffer dieser Kasse
              const matchesCurrent = currentKasseInput
                ? matchesInsurer(offer.insurer, currentKasseInput)
                : currentOffer
                  ? matchesInsurer(offer.insurer, currentOffer.insurer)
                  : false;
              const isCurrent = matchesCurrent && idx === firstCurrentIdx;
              const isCheapest = idx === 0;
              const nettoMonat = nettoPreis(offer.monthly_premium);
              const savings = currentPraemie ? nettoPreis(currentPraemie) - nettoMonat : null;
              const savingsYear = savings !== null ? Math.round(savings * 12) : null;
              // Produktname: bei mehreren Varianten gleicher Kasse+Modell Variante-Nummer anzeigen
              const variantN = variantCounters[idx];
              const baseProduktName = getProduktName(offer.insurer, offer.model);
              const produktName = variantN > 1 ? `${baseProduktName} (Var. ${variantN})` : baseProduktName;

              // Styling — klare visuelle Hierarchie
              let rowClass = 'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ';
              if (isSelected && isCurrent) rowClass += 'bg-amber-50 border-l-4 border-l-amber-500 ring-1 ring-amber-300 ';
              else if (isSelected) rowClass += 'bg-primary/5 border-l-4 border-l-primary ';
              else if (isCurrent) rowClass += 'bg-amber-50 border-l-4 border-l-amber-500 ';
              else rowClass += 'hover:bg-muted/40 ';

              return (
                <div
                  key={`${offer.insurer}-${offer.model}-${offer.monthly_premium}-${idx}`}
                  ref={idx === firstCurrentIdx ? aktuellRef : null}
                  className={isCurrent ? 'relative' : ''}
                >
                  <button
                    onClick={() => onSelect(isSelected ? null : offer)}
                    className={rowClass + 'w-full'}
                  >
                    {/* Rang */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                      ${isCurrent ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-400' : isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {idx + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-amber-900' : ''}`}>
                          {getDisplayName(offer.insurer)}
                        </p>
                        {isCurrent && (
                          <Badge className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-800 border-amber-400 font-bold">
                            ● Aktuell
                          </Badge>
                        )}
                        {isCheapest && !isCurrent && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Günstigste</Badge>
                        )}
                        {isCheapest && isCurrent && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Günstigste</Badge>
                        )}
                        {isSelected && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Ausgewählt</Badge>
                        )}
                      </div>
                      <p className={`text-xs ${isCurrent ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>{produktName}</p>
                    </div>

                    {/* Preis + Ersparnis */}
                    <div className="text-right shrink-0 min-w-[120px]">
                      <p className={`text-sm font-bold ${isCurrent ? 'text-amber-900' : ''}`}>
                        CHF {nettoMonat.toFixed(2)}/M.
                      </p>
                      {savingsYear !== null && savingsYear > 0 && (
                        <p className="text-xs text-emerald-600 font-semibold">−CHF {savingsYear.toLocaleString('de-CH')}/J.</p>
                      )}
                      {savingsYear !== null && savingsYear < 0 && (
                        <p className="text-xs text-red-500 font-semibold">+CHF {Math.abs(savingsYear).toLocaleString('de-CH')}/J. teurer</p>
                      )}
                      {isCurrent && savingsYear === 0 && currentPraemie && (
                        <p className="text-xs text-amber-600">aktuelle Prämie</p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}