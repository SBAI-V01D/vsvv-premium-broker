import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink, CheckCircle2, Save, Info, Building2, User,
  Calendar, MapPin, Search, X, Loader2, TrendingDown, Star, RefreshCw
} from 'lucide-react';
import CustomerSelector from '@/components/krankenkassen/CustomerSelector';

const ALLE_KRANKENKASSEN = [
  'Agrisano','AMB Assurance (Groupe Mutuel)','Aquilana','Assura','Atupri',
  'Avenir (Groupe Mutuel)','CMVEO','Concordia','CSS','Curaulta','EGK',
  'Einsiedler Krankenkasse','Galenos (Visana)','Glarner Krankenversicherung',
  'Helsana','KPT','Krankenkasse Birchmeier','Krankenkasse Luzerner Hinterland',
  'Krankenkasse Steffisburg','Krankenkasse Wädenswil','SLKK',
  'Mutuel (Groupe Mutuel)','ÖKK','Philos (Groupe Mutuel)','rhenusana',
  'sana24 (Visana)','Sanitas','sodalis','Sumiswalder Krankenkasse',
  'SWICA','Visana','Vivao Sympany','easy sana (Groupe Mutuel)',
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

function calcAgeClass(age) {
  if (age === null) return null;
  if (age <= 18) return 'kind';
  if (age <= 25) return 'jugend';
  return 'erwachsen';
}

export default function KrankenkassenVergleich() {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [kasseSearch, setKasseSearch] = useState('');
  const [showKasseDropdown, setShowKasseDropdown] = useState(false);
  const kasseRef = useRef(null);

  const [formData, setFormData] = useState({
    vorname: '', nachname: '', geburtsdatum: '',
    plz: '', wohnort: '', kanton: '',
    aktuelle_krankenkasse: '',
    aktuelles_modell: '',
    aktuelle_franchise: '',
    unfall: false,
  });

  // Vergleichsergebnisse
  const [vergleichResults, setVergleichResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [saveNotes, setSaveNotes] = useState('');

  const alter = calcAge(formData.geburtsdatum);
  const ageClass = calcAgeClass(alter);
  const isKind = ageClass === 'kind' || ageClass === 'jugend';
  const franchiseOptions = isKind ? FRANCHISE_KINDER : FRANCHISE_ERWACHSENE;

  const filteredKassen = kasseSearch.length >= 1
    ? ALLE_KRANKENKASSEN.filter(k => k.toLowerCase().includes(kasseSearch.toLowerCase()))
    : ALLE_KRANKENKASSEN;

  // Dropdown schliessen bei Klick ausserhalb
  useEffect(() => {
    const handler = (e) => {
      if (kasseRef.current && !kasseRef.current.contains(e.target)) setShowKasseDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canCompare = !!(formData.plz && formData.geburtsdatum && formData.aktuelle_franchise);

  // PrimAI API aufrufen — offiziell BAG-Daten
  const handleVergleich = async () => {
    if (!canCompare) return;
    setIsLoading(true);
    setApiError('');
    setVergleichResults(null);
    setSelectedResult(null);

    try {
      const age = calcAge(formData.geburtsdatum);
      const url = `https://api.primai.ch/ai/compare?plz=${formData.plz}&age=${age}&deductible=${formData.aktuelle_franchise}&accident=${formData.unfall}&limit=all`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API Fehler: ${res.status}`);
      const data = await res.json();
      setVergleichResults(data);
    } catch (err) {
      setApiError('Vergleich konnte nicht geladen werden: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Aktuelle Kasse aus Ergebnissen finden
  const currentInsurers = vergleichResults?.offers?.filter(o =>
    formData.aktuelle_krankenkasse &&
    o.insurer?.toLowerCase().includes(formData.aktuelle_krankenkasse.split(' ')[0].toLowerCase())
  ) || [];
  const currentOffer = currentInsurers[0];
  const currentPraemie = currentOffer?.monthly_premium;

  // Ergebnis speichern
  const handleSave = async () => {
    if (!selectedResult) return;
    try {
      const user = await base44.auth.me();
      const organizationId = selectedCustomer?.organization_id || user.data?.organization_id;
      const ersparnisMonatlich = currentPraemie ? (currentPraemie - selectedResult.monthly_premium) : 0;

      await base44.entities.VergleichsAnalyse.create({
        customer_id: selectedCustomer?.id,
        customer_name: `${formData.vorname} ${formData.nachname}`,
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
          praemie_aktuell: currentPraemie || 0,
        },
        empfehlung: {
          empfohlene_krankenkasse: selectedResult.insurer,
          empfohlenes_modell: selectedResult.model,
          empfohlene_franchise: selectedResult.deductible,
          praemie_empfohlen: selectedResult.monthly_premium,
          ersparnis_jaehrlich: ersparnisMonatlich * 12,
          ersparnis_prozent: currentPraemie ? (ersparnisMonatlich / currentPraemie) * 100 : 0,
        },
        status: 'beratung_erfolgt',
        notizen: saveNotes,
      });

      queryClient.invalidateQueries({ queryKey: ['vergleichs-analysen'] });
      setShowSaveDialog(false);
      setSaveNotes('');
      alert('✅ Vergleich gespeichert!');
    } catch (error) {
      alert('❌ Fehler: ' + error.message);
    }
  };

  const handleTestDaten = () => {
    setFormData({
      vorname: 'Peter', nachname: 'Adam',
      geburtsdatum: '1968-10-07',
      plz: '4304', wohnort: 'Giebenach', kanton: 'BL',
      aktuelle_krankenkasse: 'Mutuel (Groupe Mutuel)',
      aktuelles_modell: 'Telmed',
      aktuelle_franchise: '300',
      unfall: false,
    });
    setVergleichResults(null);
  };

  const offers = vergleichResults?.offers || [];
  const summary = vergleichResults?.summary;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-primary" />
            Krankenkassenvergleich
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Automatischer Prämienvergleich via offizieller BAG-Daten (PrimAI / priminfo.admin.ch)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleTestDaten} className="text-xs">
          🧪 Testdaten
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Linke Spalte: Eingabe */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4 text-primary" />Kundendaten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerSelector formData={formData} setFormData={setFormData} onSelect={setSelectedCustomer} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4 text-primary" />Aktuelle Versicherung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Krankenkasse Suchfeld */}
              <div>
                <Label>Krankenkasse</Label>
                <div className="relative mt-1" ref={kasseRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <input
                    type="text"
                    value={formData.aktuelle_krankenkasse}
                    onChange={e => {
                      setKasseSearch(e.target.value);
                      setFormData(p => ({ ...p, aktuelle_krankenkasse: e.target.value }));
                      setShowKasseDropdown(true);
                    }}
                    onFocus={() => setShowKasseDropdown(true)}
                    placeholder="Krankenkasse suchen..."
                    className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-8 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {formData.aktuelle_krankenkasse && (
                    <button type="button" onClick={() => { setFormData(p => ({ ...p, aktuelle_krankenkasse: '' })); setKasseSearch(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {showKasseDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg">
                      {filteredKassen.map(k => (
                        <button key={k} type="button"
                          onMouseDown={() => { setFormData(p => ({ ...p, aktuelle_krankenkasse: k })); setKasseSearch(''); setShowKasseDropdown(false); }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent">
                          {k}
                        </button>
                      ))}
                      {filteredKassen.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Keine gefunden</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Modell */}
              <div>
                <Label>Modell</Label>
                <Select value={formData.aktuelles_modell} onValueChange={v => setFormData(p => ({ ...p, aktuelles_modell: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Modell wählen" /></SelectTrigger>
                  <SelectContent>{MODELL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Franchise */}
              <div>
                <Label>
                  Franchise <span className="text-destructive">*</span>
                  {isKind && <span className="text-xs text-blue-600 ml-1">(Kind/Jugend: CHF 0–600)</span>}
                </Label>
                <Select
                  value={String(formData.aktuelle_franchise)}
                  onValueChange={v => setFormData(p => ({ ...p, aktuelle_franchise: v }))}
                  disabled={!formData.geburtsdatum}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={formData.geburtsdatum ? 'Franchise wählen' : 'Zuerst Geburtsdatum'} />
                  </SelectTrigger>
                  <SelectContent>{franchiseOptions.map(f => <SelectItem key={f} value={String(f)}>CHF {f}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Unfalleinschluss */}
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="unfall" checked={formData.unfall}
                  onChange={e => setFormData(p => ({ ...p, unfall: e.target.checked }))}
                  className="w-4 h-4 rounded border-input" />
                <Label htmlFor="unfall" className="text-sm cursor-pointer">Mit Unfalldeckung</Label>
              </div>
            </CardContent>
          </Card>

          {/* Vergleich starten */}
          <Button className="w-full" size="lg" onClick={handleVergleich} disabled={!canCompare || isLoading}>
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Berechne Prämien...</> : <><RefreshCw className="w-4 h-4 mr-2" />Vergleich berechnen</>}
          </Button>
          {!canCompare && (
            <p className="text-xs text-amber-600 text-center -mt-1">PLZ, Geburtsdatum und Franchise nötig</p>
          )}

          {/* Fallback: BAG Rechner */}
          <button
            onClick={() => window.open('https://www.priminfo.admin.ch/de/praemien', '_blank')}
            className="w-full text-xs text-muted-foreground hover:text-primary underline text-center"
          >
            Alternativ: Offizieller BAG-Rechner öffnen ↗
          </button>

          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {apiError}
            </div>
          )}
        </div>

        {/* Rechte 2 Spalten: Ergebnisse */}
        <div className="lg:col-span-2 space-y-4">
          {/* Zusammenfassung */}
          {!vergleichResults && !isLoading && (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="w-4 h-4 text-primary" />Zusammenfassung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-6">
                  {[
                    ['Name', `${formData.vorname} ${formData.nachname}`.trim() || '–'],
                    ['Geburtsdatum / Alter', formData.geburtsdatum ? `${new Date(formData.geburtsdatum).toLocaleDateString('de-CH')} · ${alter} Jahre` : '–'],
                    ['Altersklasse', ageClass ? { kind: 'Kind (0–18)', jugend: 'Jugend (19–25)', erwachsen: 'Erwachsen (26+)' }[ageClass] : '–'],
                    ['PLZ / Ort / Kanton', [formData.plz, formData.wohnort, formData.kanton].filter(Boolean).join(' / ') || '–'],
                    ['Krankenkasse', formData.aktuelle_krankenkasse || '–'],
                    ['Modell / Franchise', [formData.aktuelles_modell, formData.aktuelle_franchise ? `CHF ${formData.aktuelle_franchise}` : ''].filter(Boolean).join(' · ') || '–'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-xs text-muted-foreground">{label}:</span>
                      <span className={`text-sm font-medium ${value === '–' ? 'text-muted-foreground' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <Info className="w-4 h-4 inline mr-1.5" />
                  Daten eingeben und «Vergleich berechnen» klicken — alle Prämien 2026 werden direkt aus offiziellen BAG-Daten geladen.
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
                  <p className="text-xs text-muted-foreground mt-1">Quelle: PrimAI / priminfo.admin.ch</p>
                </div>
              </CardContent>
            </Card>
          )}

          {vergleichResults && !isLoading && (
            <>
              {/* Summary Banner */}
              {summary && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Angebote', value: summary.total_offers || offers.length, color: 'blue' },
                    { label: 'Günstigste Prämie', value: summary.cheapest_monthly ? `CHF ${summary.cheapest_monthly.toFixed(2)}` : '–', color: 'green' },
                    { label: 'Max. Ersparnis/J.', value: currentPraemie && summary.cheapest_monthly
                        ? `CHF ${((currentPraemie - summary.cheapest_monthly) * 12).toFixed(0)}`
                        : '–', color: 'emerald' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`p-3 rounded-xl border bg-${color}-50 border-${color}-200 text-center`}>
                      <p className={`text-xs text-${color}-600 font-medium`}>{label}</p>
                      <p className={`text-lg font-bold text-${color}-800 mt-0.5`}>{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Ergebnisliste */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Alle Angebote {formData.aktuelle_franchise && `· Franchise CHF ${formData.aktuelle_franchise}`}</span>
                    <span className="text-xs text-muted-foreground font-normal">{offers.length} Angebote · Quelle: BAG 2026</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[480px] overflow-y-auto">
                    {/* Aktuelle Kasse hervorheben */}
                    {currentOffer && (
                      <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                        <p className="text-xs font-semibold text-amber-700">Aktuelle Versicherung</p>
                        <div className="flex items-center justify-between mt-1">
                          <div>
                            <p className="text-sm font-bold">{currentOffer.insurer}</p>
                            <p className="text-xs text-muted-foreground">{currentOffer.model} · CHF {currentOffer.deductible} Franchise</p>
                          </div>
                          <p className="text-lg font-bold text-amber-800">CHF {currentOffer.monthly_premium?.toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    <div className="divide-y divide-border">
                      {offers
                        .sort((a, b) => (a.monthly_premium || 0) - (b.monthly_premium || 0))
                        .map((offer, idx) => {
                          const isSelected = selectedResult?.insurer === offer.insurer && selectedResult?.model === offer.model;
                          const savings = currentPraemie ? currentPraemie - offer.monthly_premium : null;
                          const savingsYear = savings ? (savings * 12).toFixed(0) : null;
                          const isCheapest = idx === 0;

                          return (
                            <button
                              key={`${offer.insurer}-${offer.model}-${idx}`}
                              onClick={() => setSelectedResult(isSelected ? null : offer)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                            >
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold truncate">{offer.insurer}</p>
                                  {isCheapest && <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Günstigste</Badge>}
                                  {isSelected && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Ausgewählt</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">{offer.model}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold">CHF {offer.monthly_premium?.toFixed(2)}</p>
                                {savingsYear && savings > 0 && (
                                  <p className="text-xs text-emerald-600 font-medium">−CHF {savingsYear}/J.</p>
                                )}
                                {savingsYear && savings < 0 && (
                                  <p className="text-xs text-red-500 font-medium">+CHF {Math.abs(Number(savingsYear))}/J.</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Speichern */}
              {selectedResult && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Ausgewählt: {selectedResult.insurer}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedResult.model} · CHF {selectedResult.monthly_premium?.toFixed(2)}/M.
                        {currentPraemie && ` · Ersparnis CHF ${((currentPraemie - selectedResult.monthly_premium) * 12).toFixed(0)}/J.`}
                      </p>
                    </div>
                    <Button onClick={() => setShowSaveDialog(true)}>
                      <Save className="w-4 h-4 mr-2" />Speichern
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Speichern Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />Vergleich speichern
            </DialogTitle>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kunde:</span>
                  <span className="font-medium">{formData.vorname} {formData.nachname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aktuell:</span>
                  <span>{formData.aktuelle_krankenkasse || '–'} {currentPraemie ? `· CHF ${currentPraemie.toFixed(2)}/M.` : ''}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Empfehlung:</span>
                  <span>{selectedResult.insurer} · CHF {selectedResult.monthly_premium?.toFixed(2)}/M.</span>
                </div>
                {currentPraemie && (
                  <div className="flex justify-between text-emerald-600 font-bold pt-1 border-t border-border">
                    <span>Jährl. Ersparnis:</span>
                    <span>CHF {((currentPraemie - selectedResult.monthly_premium) * 12).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <Label>Notizen (optional)</Label>
                <Input value={saveNotes} onChange={e => setSaveNotes(e.target.value)} placeholder="Berater-Notizen..." className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}