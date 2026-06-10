import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowRight, 
  ExternalLink, 
  CheckCircle2, 
  Save,
  Info,
  Building2,
  User,
  Calendar,
  MapPin
} from 'lucide-react';
import CustomerSelector from '@/components/krankenkassen/CustomerSelector';

export default function KrankenkassenVergleich() {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [formData, setFormData] = useState({
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    plz: '',
    kanton: '',
    aktuelle_krankenkasse: '',
    aktuelles_modell: '',
    aktuelle_franchise: '',
    aktuelle_praemie: '',
  });
  const [resultData, setResultData] = useState({
    neue_krankenkasse: '',
    neues_modell: '',
    neue_franchise: '',
    neue_praemie: '',
    ersparnis: '',
    notizen: ''
  });

  const handleLoadCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData({
      vorname: customer.first_name || '',
      nachname: customer.last_name || '',
      geburtsdatum: customer.birthdate || '',
      plz: customer.zip_code || '',
      kanton: customer.canton || '',
      aktuelle_krankenkasse: '',
      aktuelles_modell: '',
      aktuelle_franchise: '',
      aktuelle_praemie: '',
    });
  };

  const openPrimInfo = () => {
    const url = `https://www.priminfo.admin.ch/de/praemien`;
    window.open(url, '_blank');
    setShowResultDialog(true);
  };

  const handleSaveVergleich = async () => {
    try {
      const user = await base44.auth.me();
      const organizationId = selectedCustomer?.organization_id || user.data?.organization_id;
      
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
          kanton: formData.kanton
        },
        ausgangslage: {
          krankenkasse: formData.aktuelle_krankenkasse,
          modell: formData.aktuelles_modell,
          franchise: parseFloat(formData.aktuelle_franchise) || 0,
          praemie_aktuell: parseFloat(formData.aktuelle_praemie) || 0
        },
        empfehlung: {
          empfohlene_krankenkasse: resultData.neue_krankenkasse,
          empfohlenes_modell: resultData.neues_modell,
          empfohlene_franchise: parseFloat(resultData.neue_franchise) || 0,
          praemie_empfohlen: parseFloat(resultData.neue_praemie) || 0,
          ersparnis_jaehrlich: parseFloat(resultData.ersparnis) || 0,
          ersparnis_prozent: formData.aktuelle_praemie ? 
            ((parseFloat(resultData.ersparnis) || 0) * 12 / (parseFloat(formData.aktuelle_praemie) * 12)) * 100 : 0
        },
        status: 'beratung_erfolgt',
        notizen: resultData.notizen
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
      vorname: 'Peter',
      nachname: 'Adam',
      geburtsdatum: '1968-10-07',
      plz: '4304',
      kanton: 'BL',
      aktuelle_krankenkasse: 'Mutuel',
      aktuelles_modell: 'Telmed',
      aktuelle_franchise: '300',
      aktuelle_praemie: '381.25'
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ExternalLink className="w-6 h-6 text-primary" />
            Krankenkassenvergleich
          </h1>
          <p className="text-muted-foreground mt-1">
            Gateway zum offiziellen BAG-Rechner (priminfo.admin.ch)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleTestDaten} className="text-xs">
          🧪 Testdaten laden
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Kunde auswählen
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Aktuelle Versicherung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Krankenkasse</Label>
                <Input 
                  value={formData.aktuelle_krankenkasse} 
                  onChange={e => setFormData({...formData, aktuelle_krankenkasse: e.target.value})}
                  placeholder="z.B. Mutuel, CSS, Helsana"
                />
              </div>
              <div>
                <Label>Modell</Label>
                <Input 
                  value={formData.aktuelles_modell} 
                  onChange={e => setFormData({...formData, aktuelles_modell: e.target.value})}
                  placeholder="z.B. Telmed, Hausarzt, Standard"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Franchise</Label>
                  <Input 
                    type="number"
                    value={formData.aktuelle_franchise} 
                    onChange={e => setFormData({...formData, aktuelle_franchise: e.target.value})}
                    placeholder="300"
                  />
                </div>
                <div>
                  <Label>Prämie (mtl.)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.aktuelle_praemie} 
                    onChange={e => setFormData({...formData, aktuelle_praemie: e.target.value})}
                    placeholder="381.25"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full" 
            size="lg"
            onClick={openPrimInfo}
            disabled={!formData.plz || !formData.geburtsdatum || !formData.aktuelle_krankenkasse}
          >
            Zum BAG-Rechner
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <Info className="w-4 h-4 inline mr-1.5" />
            Der offizielle BAG-Rechner öffnet sich in einem neuen Tab. Nach dem Vergleich kannst du die Ergebnisse hier speichern.
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Kundendaten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Name:</span>
                <span className="text-sm font-medium">{formData.vorname} {formData.nachname || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Geburtsdatum:</span>
                <span className="text-sm font-medium">{formData.geburtsdatum || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">PLZ:</span>
                <span className="text-sm font-medium">{formData.plz || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Kanton:</span>
                <span className="text-sm font-medium">{formData.kanton || '-'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                So funktioniert's
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <p className="text-sm text-muted-foreground">Kundendaten erfassen oder Kunden auswählen</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <p className="text-sm text-muted-foreground">Aktuelle Versicherungsdaten eingeben</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <p className="text-sm text-muted-foreground">BAG-Rechner öffnet sich (neuer Tab)</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</div>
                <p className="text-sm text-muted-foreground">Ergebnisse vergleichen und hier speichern</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Vergleichsergebnis speichern
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium">{formData.vorname} {formData.nachname}</p>
              <p className="text-xs text-muted-foreground">
                {formData.aktuelle_krankenkasse} → Neue Kasse wählen
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Neue Krankenkasse</Label>
                <Input 
                  value={resultData.neue_krankenkasse} 
                  onChange={e => setResultData({...resultData, neue_krankenkasse: e.target.value})}
                  placeholder="z.B. CSS, Helsana"
                />
              </div>
              <div>
                <Label>Neues Modell</Label>
                <Input 
                  value={resultData.neues_modell} 
                  onChange={e => setResultData({...resultData, neues_modell: e.target.value})}
                  placeholder="z.B. Telmed, Hausarzt"
                />
              </div>
              <div>
                <Label>Neue Franchise</Label>
                <Input 
                  type="number"
                  value={resultData.neue_franchise} 
                  onChange={e => setResultData({...resultData, neue_franchise: e.target.value})}
                  placeholder="300"
                />
              </div>
              <div>
                <Label>Neue Prämie (mtl.)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={resultData.neue_praemie} 
                  onChange={e => setResultData({...resultData, neue_praemie: e.target.value})}
                  placeholder="350.00"
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Label className="text-emerald-800">Jährliche Ersparnis</Label>
              <Input 
                type="number"
                step="0.01"
                value={resultData.ersparnis} 
                onChange={e => setResultData({...resultData, ersparnis: e.target.value})}
                className="mt-1 bg-white"
                placeholder="0.00"
              />
              <p className="text-xs text-emerald-700 mt-1">
                Berechnung: (Alte Prämie - Neue Prämie) × 12
              </p>
            </div>

            <div>
              <Label>Berater-Notizen</Label>
              <Input 
                value={resultData.notizen} 
                onChange={e => setResultData({...resultData, notizen: e.target.value})}
                placeholder="Optionale Notizen zum Vergleich..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveVergleich}>
              <Save className="w-4 h-4 mr-2" />
              Vergleich speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}