import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, X, Loader2, TrendingDown, RefreshCw, Printer, Save,
  CheckCircle2, Building2, User, Info, BarChart2
} from 'lucide-react';
import CustomerSelector from '@/components/krankenkassen/CustomerSelector';
import OfferList, { nettoPreis, getProduktName, normalizeModel } from '@/components/krankenkassen/OfferList';
import VergleichPrintView from '@/components/krankenkassen/VergleichPrintView';
import VergleichsAnalysenListe from './VergleichsAnalysenListe';

const ALLE_KRANKENKASSEN = [
  'Agrisano','Aquilana','Assura','Atupri','Avenir (Groupe Mutuel)','CMVEO','Concordia',
  'CSS','Curaulta','EGK','Einsiedler Krankenkasse','Galenos (Visana)',
  'Glarner Krankenversicherung','Helsana','KPT','Krankenkasse Birchmeier',
  'Krankenkasse Luzerner Hinterland','Krankenkasse Steffisburg','Krankenkasse Wädenswil',
  'Mutuel (Groupe Mutuel)','ÖKK','Philos (Groupe Mutuel)','rhenusana','sana24 (Visana)',
  'Sanitas','SLKK','sodalis','Sumiswalder Krankenkasse','SWICA','Visana','Vivao Sympany',
  'easy sana (Groupe Mutuel)','AMB Assurance (Groupe Mutuel)',
].sort();

const MODELL_OPTIONS = ['Standard', 'Telmed', 'Hausarzt', 'HMO'];
const FRANCHISE_ERWACHSENE = [300, 500, 1000, 1500, 2000, 2500];
const FRANCHISE_KINDER = [0, 100, 200, 300, 400, 500, 600];

function calcAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function KrankenkassenVergleich() {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [kasseSearch, setKasseSearch] = useState('');
  const [showKasseDropdown, setShowKasseDropdown] = useState(false);
  const kasseRef = useRef(null);
  const printRef = useRef(null);

  const [formData, setFormData] = useState({
    vorname: '', nachname: '', geburtsdatum: '',
    plz: '', wohnort: '', kanton: '',
    aktuelle_krankenkasse: '', aktuelles_modell: '', aktuelle_franchise: '', unfall: false,
  });
  // Mehrfach-Modell-Filter: welche Modelle sollen in den Ergebnissen angezeigt werden
  const [filterModelle, setFilterModelle] = useState(['Standard', 'Telmed', 'Hausarzt', 'HMO']);

  const [vergleichResults, setVergleichResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const alter = calcAge(formData.geburtsdatum);
  const isKind = alter !== null && alter <= 25;
  const franchiseOptions = isKind ? FRANCHISE_KINDER : FRANCHISE_ERWACHSENE;

  const filteredKassen = kasseSearch.length >= 1
    ? ALLE_KRANKENKASSEN.filter(k => k.toLowerCase().includes(kasseSearch.toLowerCase()))
    : ALLE_KRANKENKASSEN;

  useEffect(() => {
    const handler = (e) => {
      if (kasseRef.current && !kasseRef.current.contains(e.target)) setShowKasseDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canCompare = !!(formData.plz && formData.geburtsdatum && formData.aktuelle_franchise);

  // PrimAI API — offizielle BAG-Daten
  const handleVergleich = async () => {
    if (!canCompare) return;
    setIsLoading(true);
    setApiError('');
    setVergleichResults(null);
    setSelectedResult(null);
    try {
      const age = calcAge(formData.geburtsdatum);
      const url = `https://api.primai.ch/v1/compare?plz=${formData.plz}&age=${age}&deductible=${formData.aktuelle_franchise}&accident=${formData.unfall}&limit=500`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
      const data = await res.json();
      // v1/compare gibt {offers: [{insurer, model, deductible, price: {total}}]}
      // Normalisierung: monthly_premium aus price.total
      const normalized = {
        ...data,
        offers: (data.offers || []).map(o => ({
          ...o,
          monthly_premium: o.monthly_premium ?? o.price?.total ?? o.price?.base ?? 0,
        })),
      };
      setVergleichResults(normalized);
    } catch (err) {
      setApiError('Vergleich konnte nicht geladen werden: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const allOffers = vergleichResults?.offers || [];
  // Modell-Filter anwenden (case-insensitive)
  const offers = filterModelle.length === 4
    ? allOffers
    : allOffers.filter(o => filterModelle.some(m => o.model?.toLowerCase() === m.toLowerCase()));
  const sortedOffers = [...offers].sort((a, b) => (a.monthly_premium || 0) - (b.monthly_premium || 0));
  const cheapestOffer = sortedOffers[0] || null;

  // Aktuelle Kasse aus Ergebnissen matching
  // Normalisiert sowohl API-Modell-Keys (z.B. 'gp', 'telmed') als auch Freitext-Eingabe
  const _currentKasseKey = formData.aktuelle_krankenkasse?.split(' ')[0]?.toLowerCase();
  const _currentModellNorm = formData.aktuelles_modell ? normalizeModel(formData.aktuelles_modell) : null;
  const currentOffer = allOffers.find(o => {
    if (!_currentKasseKey) return false;
    const insurerMatch = o.insurer?.toLowerCase().includes(_currentKasseKey);
    if (!insurerMatch) return false;
    if (!_currentModellNorm) return true;
    return normalizeModel(o.model) === _currentModellNorm;
  }) || allOffers.find(o =>
    _currentKasseKey && o.insurer?.toLowerCase().includes(_currentKasseKey)
  );
  const currentPraemie = currentOffer?.monthly_premium;
  const currentNet = currentPraemie ? nettoPreis(currentPraemie) : null;
  const selectedNet = selectedResult ? nettoPreis(selectedResult.monthly_premium) : null;
  const cheapestNet = cheapestOffer ? nettoPreis(cheapestOffer.monthly_premium) : null;

  // Ersparnis Auswahl vs. aktuell (kann negativ sein — Kundenwunsch)
  const ersparnisMonat = currentNet && selectedNet ? currentNet - selectedNet : null;
  const ersparnisJahr = ersparnisMonat !== null ? Math.round(ersparnisMonat * 12) : null;
  // Max. Ersparnis (günstigste vs. aktuell)
  const maxErsparnis = currentNet && cheapestNet ? Math.round((currentNet - cheapestNet) * 12) : null;

  // Direktes Speichern ohne Dialog
  const handleSave = useCallback(async () => {
    if (!selectedResult || isSaving) return;
    setIsSaving(true);
    try {
      const user = await base44.auth.me();
      const organizationId = selectedCustomer?.organization_id || user.data?.organization_id;
      await base44.entities.VergleichsAnalyse.create({
        customer_id: selectedCustomer?.id,
        customer_name: `${formData.vorname} ${formData.nachname}`.trim() || selectedCustomer?.first_name,
        advisor_id: user.id,
        advisor_name: user.full_name || user.email,
        organization_id: organizationId,
        analyse_datum: new Date().toISOString(),
        persoenliche_daten: {
          vorname: formData.vorname,
          nachname: formData.nachname,
          geburtsdatum: formData.geburtsdatum,
          plz: formData.plz,
          kanton: formData.kanton,
        },
        ausgangslage: {
          krankenkasse: formData.aktuelle_krankenkasse,
          modell: formData.aktuelles_modell,
          franchise: Number(formData.aktuelle_franchise) || 0,
          praemie_aktuell: currentNet || 0,
        },
        empfehlung: {
          empfohlene_krankenkasse: selectedResult.insurer,
          empfohlenes_modell: getProduktName(selectedResult.insurer, selectedResult.model),
          empfohlene_franchise: selectedResult.deductible || Number(formData.aktuelle_franchise),
          praemie_empfohlen: selectedNet,
          ersparnis_jaehrlich: ersparnisJahr || 0,
          ersparnis_prozent: currentNet ? ((ersparnisMonat / currentNet) * 100) : 0,
        },
        status: 'beratung_erfolgt',
      });
      queryClient.invalidateQueries({ queryKey: ['vergleichs-analysen'] });
      // Kleines visuelles Feedback
      const btn = document.getElementById('save-btn');
      if (btn) { btn.textContent = '✓ Gespeichert'; setTimeout(() => { if (btn) btn.textContent = ''; }, 2000); }
    } catch (error) {
      alert('Fehler beim Speichern: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  }, [selectedResult, isSaving, formData, currentNet, selectedNet, ersparnisJahr, ersparnisMonat, selectedCustomer, queryClient]);

  // PDF Druck
  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>KK-Vergleich</title>
      <style>body{margin:0;padding:0;font-family:Arial,sans-serif;} @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const handleTestDaten = () => {
    setFormData({
      vorname: 'Peter', nachname: 'Adam', geburtsdatum: '1968-10-07',
      plz: '4304', wohnort: 'Giebenach', kanton: 'BL',
      aktuelle_krankenkasse: 'Mutuel (Groupe Mutuel)',
      aktuelles_modell: 'Telmed', aktuelle_franchise: '300', unfall: false,
    });
    setVergleichResults(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <Tabs defaultValue="vergleich">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-primary" />
              Krankenkassenvergleich OKP 2026
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Nettoprämien — offiziell BAG-Daten (priminfo.admin.ch)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="vergleich" className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" />Vergleich
              </TabsTrigger>
              <TabsTrigger value="auswertung" className="flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5" />Auswertung
              </TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={handleTestDaten} className="text-xs">
              🧪 Test
            </Button>
          </div>
        </div>

        <TabsContent value="vergleich" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Linke Spalte: Eingabe */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-primary" />Kundendaten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CustomerSelector formData={formData} setFormData={setFormData} onSelect={setSelectedCustomer} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-primary" />Aktuelle Versicherung
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Krankenkasse */}
                  <div>
                    <Label className="text-xs">Krankenkasse</Label>
                    <div className="relative mt-1" ref={kasseRef}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <input type="text"
                        value={formData.aktuelle_krankenkasse}
                        onChange={e => { setKasseSearch(e.target.value); setFormData(p => ({ ...p, aktuelle_krankenkasse: e.target.value })); setShowKasseDropdown(true); }}
                        onFocus={() => setShowKasseDropdown(true)}
                        placeholder="Krankenkasse suchen..."
                        className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-8 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      {formData.aktuelle_krankenkasse && (
                        <button type="button" onClick={() => { setFormData(p => ({ ...p, aktuelle_krankenkasse: '' })); setKasseSearch(''); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {showKasseDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg">
                          {filteredKassen.map(k => (
                            <button key={k} type="button"
                              onMouseDown={() => { setFormData(p => ({ ...p, aktuelle_krankenkasse: k })); setKasseSearch(''); setShowKasseDropdown(false); }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent">{k}</button>
                          ))}
                          {filteredKassen.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Keine gefunden</p>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Aktuelles Modell</Label>
                    <Select value={formData.aktuelles_modell} onValueChange={v => setFormData(p => ({ ...p, aktuelles_modell: v }))}>
                      <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Modell wählen" /></SelectTrigger>
                      <SelectContent>{MODELL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Modelle im Vergleich anzeigen</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MODELL_OPTIONS.map(m => {
                        const checked = filterModelle.includes(m);
                        return (
                          <label key={m} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition-colors ${
                            checked ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted/40'
                          }`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setFilterModelle(prev =>
                                checked
                                  ? prev.length > 1 ? prev.filter(x => x !== m) : prev // mind. 1 muss aktiv bleiben
                                  : [...prev, m]
                              )}
                              className="w-3 h-3 accent-primary"
                            />
                            {m}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">
                      Franchise <span className="text-destructive">*</span>
                      {isKind && alter !== null && <span className="text-[10px] text-blue-600 ml-1">(bis 25 J.)</span>}
                    </Label>
                    <Select value={String(formData.aktuelle_franchise)} onValueChange={v => setFormData(p => ({ ...p, aktuelle_franchise: v }))} disabled={!formData.geburtsdatum}>
                      <SelectTrigger className="mt-1 h-9 text-sm">
                        <SelectValue placeholder={formData.geburtsdatum ? 'Franchise wählen' : 'Zuerst Geburtsdatum'} />
                      </SelectTrigger>
                      <SelectContent>{franchiseOptions.map(f => <SelectItem key={f} value={String(f)}>CHF {f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="unfall" checked={formData.unfall}
                      onChange={e => setFormData(p => ({ ...p, unfall: e.target.checked }))}
                      className="w-4 h-4 rounded border-input" />
                    <Label htmlFor="unfall" className="text-xs cursor-pointer">Mit Unfalldeckung</Label>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full" onClick={handleVergleich} disabled={!canCompare || isLoading}>
                {isLoading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Berechne...</>
                  : <><RefreshCw className="w-4 h-4 mr-2" />Vergleich berechnen</>}
              </Button>
              {!canCompare && <p className="text-[11px] text-amber-600 text-center">PLZ, Geburtsdatum und Franchise erforderlich</p>}

              <button onClick={() => window.open('https://www.priminfo.admin.ch/de/praemien', '_blank')}
                className="w-full text-[11px] text-muted-foreground hover:text-primary underline text-center">
                Offizieller BAG-Rechner ↗
              </button>

              {apiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{apiError}</div>
              )}
            </div>

            {/* Rechte 2 Spalten: Ergebnisse */}
            <div className="lg:col-span-2 space-y-4">
              {!vergleichResults && !isLoading && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />Zusammenfassung
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {[
                        ['Name', `${formData.vorname} ${formData.nachname}`.trim() || '–'],
                        ['Geburtsdatum', formData.geburtsdatum ? `${new Date(formData.geburtsdatum).toLocaleDateString('de-CH')} · ${alter} J.` : '–'],
                        ['PLZ / Ort', [formData.plz, formData.wohnort, formData.kanton].filter(Boolean).join(' ') || '–'],
                        ['Krankenkasse', formData.aktuelle_krankenkasse || '–'],
                        ['Franchise', formData.aktuelle_franchise ? `CHF ${formData.aktuelle_franchise}` : '–'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between py-1.5 border-b border-border/30 last:border-0">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      <Info className="w-3.5 h-3.5 inline mr-1" />
                      Daten eingeben → «Vergleich berechnen». Prämien 2026 aus offiziellen BAG-Daten.
                      Angezeigt werden <strong>Nettoprämien</strong> (Bruttoprämie − CHF 5.15 Umweltabgabe).
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoading && (
                <Card>
                  <CardContent className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                      <p className="text-sm font-medium">Lade Prämien aus BAG-Daten...</p>
                      <p className="text-xs text-muted-foreground mt-1">priminfo.admin.ch / PrimAI</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {vergleichResults && !isLoading && (
                <>
                  {/* Summary KPIs — 4 Kacheln */}
                  <div className="grid grid-cols-4 gap-2">
                    {/* Angebote */}
                    <div className="p-3 rounded-xl border bg-blue-50 border-blue-200 text-center">
                      <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Angebote</p>
                      <p className="text-2xl font-bold text-blue-800">{offers.length}</p>
                      {filterModelle.length < 4 && (
                        <p className="text-[9px] text-blue-500 mt-0.5">{filterModelle.join(', ')}</p>
                      )}
                    </div>
                    {/* Aktuelle Prämie */}
                    <div className="p-3 rounded-xl border bg-amber-50 border-amber-200 text-center">
                      <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Aktuell/M.</p>
                      <p className="text-base font-bold text-amber-800">
                        {currentNet ? `CHF ${currentNet.toFixed(2)}` : <span className="text-sm text-amber-500">–</span>}
                      </p>
                    </div>
                    {/* Günstigste Prämie */}
                    <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-center">
                      <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Günstigste/M.</p>
                      <p className="text-base font-bold text-emerald-800">
                        {cheapestNet ? `CHF ${cheapestNet.toFixed(2)}` : '–'}
                      </p>
                    </div>
                    {/* Max. Ersparnis / Auswahl-Ersparnis */}
                    <div className={`p-3 rounded-xl border text-center ${
                      ersparnisJahr !== null
                        ? ersparnisJahr >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${
                        ersparnisJahr !== null
                          ? ersparnisJahr >= 0 ? 'text-emerald-600' : 'text-red-600'
                          : 'text-emerald-600'
                      }`}>
                        {ersparnisJahr !== null ? 'Ersparnis/J.' : 'Max. Ers./J.'}
                      </p>
                      <p className={`text-base font-bold ${
                        ersparnisJahr !== null
                          ? ersparnisJahr >= 0 ? 'text-emerald-800' : 'text-red-700'
                          : 'text-emerald-800'
                      }`}>
                        {ersparnisJahr !== null
                          ? `${ersparnisJahr >= 0 ? '−' : '+'}CHF ${Math.abs(ersparnisJahr).toLocaleString('de-CH')}`
                          : maxErsparnis !== null
                            ? `−CHF ${maxErsparnis.toLocaleString('de-CH')}`
                            : '–'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Angebotsliste */}
                  <OfferList
                    offers={offers}
                    currentOffer={currentOffer}
                    currentPraemie={currentPraemie}
                    selectedResult={selectedResult}
                    onSelect={setSelectedResult}
                    cheapestOffer={cheapestOffer}
                  />

                  {/* Auswahl-Bar mit Speichern + Drucken */}
                  {selectedResult && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm font-bold">{selectedResult.insurer}</p>
                          <p className="text-xs text-muted-foreground">
                            {getProduktName(selectedResult.insurer, selectedResult.model)}
                            {' · '}CHF {selectedNet?.toFixed(2)}/M. netto
                            {ersparnisJahr !== null && (
                              <span className={`ml-2 font-semibold ${ersparnisJahr >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {ersparnisJahr >= 0 ? '−' : '+'}CHF {Math.abs(ersparnisJahr).toLocaleString('de-CH')}/J.
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                            <Printer className="w-3.5 h-3.5" />PDF drucken
                          </Button>
                          <Button size="sm" onClick={handleSave} disabled={isSaving} id="save-btn" className="gap-1.5">
                            {isSaving
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Speichert...</>
                              : <><Save className="w-3.5 h-3.5" />Speichern</>}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="auswertung" className="mt-0">
          <VergleichsAnalysenListe />
        </TabsContent>
      </Tabs>

      {/* Versteckter Print-Container */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <VergleichPrintView
            formData={formData}
            offers={offers}
            currentOffer={currentOffer}
            currentPraemie={currentPraemie}
            selectedResult={selectedResult}
            printDate={new Date().toLocaleDateString('de-CH')}
          />
        </div>
      </div>
    </div>
  );
}