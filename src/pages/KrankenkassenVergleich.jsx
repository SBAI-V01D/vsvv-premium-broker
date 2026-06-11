import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowRight, ExternalLink, CheckCircle2, Save, Info, Building2, User, Calendar, MapPin, Search, X
} from 'lucide-react';
import CustomerSelector from '@/components/krankenkassen/CustomerSelector';

const FRANCHISE_OPTIONS = [300, 500, 1000, 1500, 2000, 2500];
const MODELL_OPTIONS = ['Standard', 'Telmed', 'Hausarzt', 'HMO'];

// Berechne Alter aus Geburtsdatum
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
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [kasseSearch, setKasseSearch] = useState('');
  const [showKasseDropdown, setShowKasseDropdown] = useState(false);

  const [formData, setFormData] = useState({
    vorname: '', nachname: '', geburtsdatum: '',
    plz: '', wohnort: '', kanton: '',
    aktuelle_krankenkasse: '',
    aktuelles_modell: '',
    aktuelle_franchise: '300',
  });
  const [resultData, setResultData] = useState({
    neue_krankenkasse: '', neues_modell: '', neue_franchise: '',
    neue_praemie: '', ersparnis: '', notizen: ''
  });

  // Alle verfügbaren Krankenkassen aus BAGPraemienDaten
  const { data: bagData = [] } = useQuery({
    queryKey: ['bag_kassen_list'],
    queryFn: () => base44.entities.BAGPraemienDaten.filter({ aktiv: true }, 'krankenkasse', 500),
    staleTime: 10 * 60 * 1000,
  });

  const allKassen = useMemo(() => {
    const set = new Set(bagData.map(d => d.krankenkasse).filter(Boolean));
    return [...set].sort();
  }, [bagData]);

  // Prämie automatisch aus BAG-Daten ermitteln
  const aktuellerAgeClass = calcAgeClass(calcAge(formData.geburtsdatum));

  const aktuellePraemie = useMemo(() => {
    if (!formData.aktuelle_krankenkasse || !formData.kanton || !formData.aktuelle_franchise || !aktuellerAgeClass) return null;
    const modellLower = (formData.aktuelles_modell || '').toLowerCase();
    const modellMap = { telmed: 'telmed', hausarzt: 'hausarzt', hmo: 'hmo', standard: 'standard' };
    const modellKey = Object.keys(modellMap).find(k => modellLower.includes(k)) || null;

    const match = bagData.find(d =>
      d.krankenkasse?.toLowerCase() === formData.aktuelle_krankenkasse.toLowerCase() &&
      d.kanton === formData.kanton &&
      d.franchise === Number(formData.aktuelle_franchise) &&
      d.altersklasse === aktuellerAgeClass &&
      (!modellKey || d.modell === modellKey)
    );
    return match?.praemie_erwachsene || match?.praemie_kinder || null;
  }, [formData.aktuelle_krankenkasse, formData.kanton, formData.aktuelle_franchise, formData.aktuelles_modell, aktuellerAgeClass, bagData]);

  // Gefilterte Kassen für Suchfeld
  const filteredKassen = kasseSearch.length >= 1
    ? allKassen.filter(k => k.toLowerCase().includes(kasseSearch.toLowerCase()))
    : allKassen.slice(0, 15);

  const handleLoadCustomer = (customer) => {
    setSelectedCustomer(customer);
  };

  const openPrimInfo = () => {
    window.open('https://www.priminfo.admin.ch/de/praemien', '_blank');
    setShowResultDialog(true);
  };

  // Ersparnis automatisch berechnen
  const berechneteErsparnis = useMemo(() => {
    const alt = aktuellePraemie;
    const neu = parseFloat(resultData.neue_praemie);
    if (!alt || !neu || isNaN(neu)) return '';
    return ((alt - neu) * 12).toFixed(2);
  }, [aktuellePraemie, resultData.neue_praemie]);

  const handleSaveVergleich = async () => {
    try {
      const user = await base44.auth.me();
      const organizationId = selectedCustomer?.organization_id || user.data?.organization_id;
      const ersparnisJaehrlich = parseFloat(resultData.ersparnis || berechneteErsparnis) || 0;

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
          praemie_aktuell: aktuellePraemie || 0,
        },
        empfehlung: {
          empfohlene_krankenkasse: resultData.neue_krankenkasse,
          empfohlenes_modell: resultData.neues_modell,
          empfohlene_franchise: parseFloat(resultData.neue_franchise) || 0,
          praemie_empfohlen: parseFloat(resultData.neue_praemie) || 0,
          ersparnis_jaehrlich: ersparnisJaehrlich,
          ersparnis_prozent: aktuellePraemie
            ? (ersparnisJaehrlich / (aktuellePraemie * 12)) * 100 : 0,
        },
        status: 'beratung_erfolgt',
        notizen: resultData.notizen,
      });

      queryClient.invalidateQueries({ queryKey: ['vergleichs-analysen'] });
      setShowResultDialog(false);
      alert('✅ Vergleich erfolgreich gespeichert!');
    } catch (error) {
      alert('❌ Fehler beim Speichern: ' + error.message);
    }
  };

  const handleTestDaten = () => {
    setFormData({
      vorname: 'Peter', nachname: 'Adam',
      geburtsdatum: '1968-10-07',
      plz: '4304', wohnort: 'Giebenach', kanton: 'BL',
      aktuelle_krankenkasse: 'Mutuel',
      aktuelles_modell: 'Telmed',
      aktuelle_franchise: '300',
    });
  };

  const canOpenBAG = formData.plz && formData.geburtsdatum && formData.aktuelle_krankenkasse && formData.kanton;
  const alter = calcAge(formData.geburtsdatum);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ExternalLink className="w-6 h-6 text-primary" />
            Krankenkassenvergleich
          </h1>
          <p className="text-muted-foreground mt-1">Gateway zum offiziellen BAG-Rechner (priminfo.admin.ch)</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleTestDaten} className="text-xs">
          🧪 Testdaten laden
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Linke Spalte */}
        <div className="space-y-4">
          {/* Kundenauswahl */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-primary" />
                Kundendaten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerSelector
                formData={formData}
                setFormData={setFormData}
                onSelect={handleLoadCustomer}
              />
            </CardContent>
          </Card>

          {/* Aktuelle Versicherung */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5 text-primary" />
                Aktuelle Versicherung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Krankenkasse als Suchfeld */}
              <div>
                <Label>Krankenkasse <span className="text-destructive">*</span></Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={formData.aktuelle_krankenkasse || kasseSearch}
                    onChange={e => {
                      setKasseSearch(e.target.value);
                      setFormData(p => ({ ...p, aktuelle_krankenkasse: e.target.value }));
                      setShowKasseDropdown(true);
                    }}
                    onFocus={() => setShowKasseDropdown(true)}
                    onBlur={() => setTimeout(() => setShowKasseDropdown(false), 150)}
                    placeholder="Krankenkasse suchen..."
                    className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {formData.aktuelle_krankenkasse && (
                    <button
                      onClick={() => { setFormData(p => ({ ...p, aktuelle_krankenkasse: '' })); setKasseSearch(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {showKasseDropdown && filteredKassen.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg">
                      {filteredKassen.map(k => (
                        <button
                          key={k}
                          onMouseDown={() => {
                            setFormData(p => ({ ...p, aktuelle_krankenkasse: k }));
                            setKasseSearch('');
                            setShowKasseDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modell */}
              <div>
                <Label>Modell</Label>
                <Select value={formData.aktuelles_modell} onValueChange={v => setFormData(p => ({ ...p, aktuelles_modell: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Modell wählen" /></SelectTrigger>
                  <SelectContent>
                    {MODELL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Franchise */}
              <div>
                <Label>Franchise</Label>
                <Select value={String(formData.aktuelle_franchise)} onValueChange={v => setFormData(p => ({ ...p, aktuelle_franchise: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Franchise wählen" /></SelectTrigger>
                  <SelectContent>
                    {FRANCHISE_OPTIONS.map(f => <SelectItem key={f} value={String(f)}>CHF {f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Monatliche Prämie — automatisch aus BAG-Daten */}
              <div>
                <Label>Monatliche Prämie</Label>
                {aktuellePraemie ? (
                  <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-800">
                      CHF {aktuellePraemie.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Monat
                    </span>
                    <span className="text-xs text-emerald-600 ml-1">(aus BAG-Daten)</span>
                  </div>
                ) : (
                  <div className="mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-muted-foreground">
                    {!formData.aktuelle_krankenkasse ? 'Krankenkasse wählen' :
                     !formData.geburtsdatum ? 'Geburtsdatum eingeben' :
                     !formData.kanton ? 'Kanton wählen' :
                     'Keine BAG-Daten für diese Kombination gefunden'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={openPrimInfo}
            disabled={!canOpenBAG}
          >
            Zum BAG-Rechner öffnen
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
          {!canOpenBAG && (
            <p className="text-xs text-amber-600 text-center">
              Bitte Geburtsdatum, Kanton, PLZ und Krankenkasse ausfüllen
            </p>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <Info className="w-4 h-4 inline mr-1.5" />
            Der offizielle BAG-Rechner öffnet sich in einem neuen Tab. Danach Ergebnisse hier speichern.
          </div>
        </div>

        {/* Rechte Spalte — Übersicht */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5 text-primary" />
                Zusammenfassung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                ['Name', `${formData.vorname} ${formData.nachname}`.trim() || '–'],
                ['Geburtsdatum', formData.geburtsdatum ? new Date(formData.geburtsdatum).toLocaleDateString('de-CH') : '–'],
                ['Alter', alter !== null ? `${alter} Jahre` : '–'],
                ['Altersklasse', aktuellerAgeClass ? { kind: 'Kind (0–18)', jugend: 'Jugend (19–25)', erwachsen: 'Erwachsen (26+)' }[aktuellerAgeClass] : '–'],
                ['PLZ / Ort', [formData.plz, formData.wohnort].filter(Boolean).join(' ') || '–'],
                ['Kanton', formData.kanton || '–'],
                ['Krankenkasse', formData.aktuelle_krankenkasse || '–'],
                ['Modell', formData.aktuelles_modell || '–'],
                ['Franchise', formData.aktuelle_franchise ? `CHF ${formData.aktuelle_franchise}` : '–'],
                ['Prämie/Monat', aktuellePraemie ? `CHF ${aktuellePraemie.toFixed(2)}` : '–'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                  <span className="text-xs text-muted-foreground">{label}:</span>
                  <span className={`text-sm font-medium ${value === '–' ? 'text-muted-foreground' : ''}`}>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-5 h-5 text-primary" />
                Ablauf
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                'Kunden suchen oder Daten manuell eingeben',
                'Geburtsdatum, Kanton und Krankenkasse auswählen',
                'BAG-Rechner öffnen (neuer Tab)',
                'Ergebnisse vergleichen und hier speichern',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < 2 && canOpenBAG ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                    {i < 2 && canOpenBAG ? '✓' : i + 1}
                  </div>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Ergebnis erfassen */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Vergleichsergebnis erfassen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              <p className="font-medium">{formData.vorname} {formData.nachname}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Aktuell: {formData.aktuelle_krankenkasse} {formData.aktuelles_modell && `· ${formData.aktuelles_modell}`}
                {aktuellePraemie && ` · CHF ${aktuellePraemie.toFixed(2)}/M.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Neue Krankenkasse</Label>
                <Input value={resultData.neue_krankenkasse} onChange={e => setResultData(p => ({ ...p, neue_krankenkasse: e.target.value }))} placeholder="z.B. CSS, Helsana" className="mt-1" />
              </div>
              <div>
                <Label>Neues Modell</Label>
                <Select value={resultData.neues_modell} onValueChange={v => setResultData(p => ({ ...p, neues_modell: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Modell wählen" /></SelectTrigger>
                  <SelectContent>{MODELL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Neue Franchise</Label>
                <Select value={String(resultData.neue_franchise)} onValueChange={v => setResultData(p => ({ ...p, neue_franchise: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Franchise" /></SelectTrigger>
                  <SelectContent>{FRANCHISE_OPTIONS.map(f => <SelectItem key={f} value={String(f)}>CHF {f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Neue Prämie (mtl. CHF)</Label>
                <Input type="number" step="0.01" value={resultData.neue_praemie} onChange={e => setResultData(p => ({ ...p, neue_praemie: e.target.value }))} placeholder="z.B. 320.00" className="mt-1" />
              </div>
            </div>

            {/* Jährliche Ersparnis automatisch berechnet */}
            {berechneteErsparnis && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm font-semibold text-emerald-800">
                  Jährliche Ersparnis (auto): CHF {parseFloat(berechneteErsparnis).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  ({aktuellePraemie?.toFixed(2)} – {resultData.neue_praemie}) × 12 Monate
                </p>
              </div>
            )}

            <div>
              <Label>Berater-Notizen</Label>
              <Input value={resultData.notizen} onChange={e => setResultData(p => ({ ...p, notizen: e.target.value }))} placeholder="Optionale Notizen..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSaveVergleich} disabled={!resultData.neue_krankenkasse}>
              <Save className="w-4 h-4 mr-2" />
              Vergleich speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}