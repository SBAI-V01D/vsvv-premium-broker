import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Offizielle BAG-Produktnamen je Versicherer + Modellkategorie
// Quelle: priminfo.admin.ch / offizielle Versichererlisten
const PRODUKT_NAMEN = {
  'CSS': {
    'Standard': 'Gesundheitspraxis',
    'Hausarzt': 'Hausarztversicherung',
    'Telmed': 'CallMed',
    'HMO': 'Medbase',
  },
  'Helsana': {
    'Standard': 'Helsana+',
    'Hausarzt': 'BeneFit PLUS Hausarzt',
    'Telmed': 'BeneFit PLUS Telmed',
    'HMO': 'BeneFit PLUS HMO',
  },
  'SWICA': {
    'Standard': 'SWICA-BASIS',
    'Hausarzt': 'SWICA-CASA',
    'Telmed': 'SWICA-MEDPHON',
    'HMO': 'SWICA-MED',
  },
  'Sanitas': {
    'Standard': 'Grundversicherung',
    'Hausarzt': 'Hausarzt',
    'Telmed': 'Telmed',
    'HMO': 'HealthCare',
  },
  'Concordia': {
    'Standard': 'CONCORDIA Grundversicherung',
    'Hausarzt': 'myDoc',
    'HMO': 'NetMed',
    'Telmed': 'TelFirst',
  },
  'CONCORDIA': {
    'Standard': 'CONCORDIA Grundversicherung',
    'Hausarzt': 'myDoc',
    'HMO': 'NetMed',
    'Telmed': 'TelFirst',
  },
  'Visana': {
    'Standard': 'Visana Grundversicherung',
    'Hausarzt': 'med',
    'Telmed': 'via',
    'HMO': 'win',
  },
  'Atupri Gesundheitsversicherung AG': {
    'Standard': 'Atupri Grundversicherung',
    'Hausarzt': 'HausarztMed',
    'Telmed': 'TelFirst',
    'HMO': 'SmartCare',
  },
  'Assura-Basis SA': {
    'Standard': 'Assura Grundversicherung',
    'Hausarzt': 'Medix',
    'Telmed': 'Telemedico',
    'HMO': 'Médico',
  },
  'KPT': {
    'Standard': 'KPT/WIN.BASIC',
    'Hausarzt': 'KPT/WIN.CASA',
    'Telmed': 'KPT/WIN.PHONE',
    'HMO': 'KPT/WIN.NET',
  },
  'Aquilana': {
    'Standard': 'Aquilana Grundversicherung',
    'Telmed': 'AquiPhone',
    'Hausarzt': 'AquiDoc',
  },
  'ÖKK': {
    'Standard': 'ÖKK Grundversicherung',
    'Hausarzt': 'ÖKK Hausarzt',
    'Telmed': 'ÖKK Telmed',
    'HMO': 'ÖKK HMO',
  },
  'Agrisano': {
    'Standard': 'Agrisano Grundversicherung',
    'Hausarzt': 'Agrisano Hausarzt',
  },
  'EGK': {
    'Standard': 'EGK Grundversicherung',
    'Hausarzt': 'EGK Hausarzt',
    'Telmed': 'EGK Telmed',
  },
  'Mutuel Krankenversicherung AG': {
    'Standard': 'Mutuel Grundversicherung',
    'Hausarzt': 'Médecin de famille',
    'Telmed': 'TéléMed',
    'HMO': 'HMO Mutuel',
  },
  'GALENOS AG': {
    'Standard': 'Galenos Grundversicherung',
    'Hausarzt': 'Galenos Hausarzt',
    'Telmed': 'Galenos Telmed',
  },
  'Sumiswalder': {
    'Standard': 'Sumiswalder Grundversicherung',
    'Hausarzt': 'Sumiswalder Hausarzt',
    'Telmed': 'Sumiswalder Telmed',
  },
  'Avenir Krankenversicherung AG': {
    'Standard': 'Avenir Grundversicherung',
    'Hausarzt': 'Avenir Hausarzt',
    'Telmed': 'Avenir TéléMed',
  },
};

const ABZUG_UMWELTABGABE = 5.15;

export function getProduktName(insurer, model) {
  return PRODUKT_NAMEN[insurer]?.[model] || model;
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
                offer.model === currentOffer.model &&
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