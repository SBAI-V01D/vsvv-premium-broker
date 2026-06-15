import React, { useState } from 'react';
import { Download, FileJson, CheckCircle2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BASE = 'https://base44.app/api/apps/69f07890d7d9106eb68a2c98/files/mp/public/69f07890d7d9106eb68a2c98/';

const BAG_CHUNKS = [
  // Chunk 1–20 (aus früheren Exporten — Datum 2026-06-11 oder -15, gleiche Basis-URL)
  { chunk: 1,  file: '1_BAGPraemienDaten_chunk1_2026-06-11.json', count: 2000 },
  { chunk: 2,  file: '2_BAGPraemienDaten_chunk2_2026-06-11.json', count: 2000 },
  { chunk: 3,  file: '3_BAGPraemienDaten_chunk3_2026-06-11.json', count: 2000 },
  { chunk: 4,  file: '4_BAGPraemienDaten_chunk4_2026-06-11.json', count: 2000 },
  { chunk: 5,  file: '5_BAGPraemienDaten_chunk5_2026-06-11.json', count: 2000 },
  { chunk: 6,  file: '6_BAGPraemienDaten_chunk6_2026-06-11.json', count: 2000 },
  { chunk: 7,  file: '7_BAGPraemienDaten_chunk7_2026-06-11.json', count: 2000 },
  { chunk: 8,  file: '8_BAGPraemienDaten_chunk8_2026-06-11.json', count: 2000 },
  { chunk: 9,  file: '9_BAGPraemienDaten_chunk9_2026-06-11.json', count: 2000 },
  { chunk: 10, file: '10_BAGPraemienDaten_chunk10_2026-06-11.json', count: 2000 },
  { chunk: 11, file: '11_BAGPraemienDaten_chunk11_2026-06-11.json', count: 2000 },
  { chunk: 12, file: '12_BAGPraemienDaten_chunk12_2026-06-11.json', count: 2000 },
  { chunk: 13, file: '13_BAGPraemienDaten_chunk13_2026-06-11.json', count: 2000 },
  { chunk: 14, file: '14_BAGPraemienDaten_chunk14_2026-06-11.json', count: 2000 },
  { chunk: 15, file: '15_BAGPraemienDaten_chunk15_2026-06-11.json', count: 2000 },
  { chunk: 16, file: '16_BAGPraemienDaten_chunk16_2026-06-11.json', count: 2000 },
  { chunk: 17, file: '17_BAGPraemienDaten_chunk17_2026-06-11.json', count: 2000 },
  { chunk: 18, file: '18_BAGPraemienDaten_chunk18_2026-06-11.json', count: 2000 },
  { chunk: 19, file: '19_BAGPraemienDaten_chunk19_2026-06-11.json', count: 2000 },
  { chunk: 20, file: '20_BAGPraemienDaten_chunk20_2026-06-11.json', count: 2000 },
  // Chunk 21–55 (2026-06-15)
  { chunk: 21, url: `${BASE}4e963ca58_BAGPraemienDaten_chunk21_2026-06-15.json`, count: 2000 },
  { chunk: 22, url: `${BASE}31a283453_BAGPraemienDaten_chunk22_2026-06-15.json`, count: 2000 },
  { chunk: 23, url: `${BASE}f9395dcb9_BAGPraemienDaten_chunk23_2026-06-15.json`, count: 2000 },
  { chunk: 24, url: `${BASE}715a1c198_BAGPraemienDaten_chunk24_2026-06-15.json`, count: 2000 },
  { chunk: 25, url: `${BASE}bb649e01b_BAGPraemienDaten_chunk25_2026-06-15.json`, count: 2000 },
  { chunk: 26, url: `${BASE}15c0573bc_BAGPraemienDaten_chunk26_2026-06-15.json`, count: 2000 },
  { chunk: 27, url: `${BASE}9bcbd605e_BAGPraemienDaten_chunk27_2026-06-15.json`, count: 2000 },
  { chunk: 28, url: `${BASE}d89606567_BAGPraemienDaten_chunk28_2026-06-15.json`, count: 2000 },
  { chunk: 29, url: `${BASE}b494a6601_BAGPraemienDaten_chunk29_2026-06-15.json`, count: 2000 },
  { chunk: 30, url: `${BASE}b265ee3b1_BAGPraemienDaten_chunk30_2026-06-15.json`, count: 2000 },
  { chunk: 31, url: `${BASE}9e6a4f8d5_BAGPraemienDaten_chunk31_2026-06-15.json`, count: 2000 },
  { chunk: 32, url: `${BASE}6251a4986_BAGPraemienDaten_chunk32_2026-06-15.json`, count: 2000 },
  { chunk: 33, url: `${BASE}bcdafe891_BAGPraemienDaten_chunk33_2026-06-15.json`, count: 2000 },
  { chunk: 34, url: `${BASE}7047f482d_BAGPraemienDaten_chunk34_2026-06-15.json`, count: 2000 },
  { chunk: 35, url: `${BASE}3931a7db0_BAGPraemienDaten_chunk35_2026-06-15.json`, count: 2000 },
  { chunk: 36, url: `${BASE}6618bac86_BAGPraemienDaten_chunk36_2026-06-15.json`, count: 2000 },
  { chunk: 37, url: `${BASE}f9a603d01_BAGPraemienDaten_chunk37_2026-06-15.json`, count: 2000 },
  { chunk: 38, url: `${BASE}ccbb0fe73_BAGPraemienDaten_chunk38_2026-06-15.json`, count: 2000 },
  { chunk: 39, url: `${BASE}ef3e09f88_BAGPraemienDaten_chunk39_2026-06-15.json`, count: 2000 },
  { chunk: 40, url: `${BASE}ada7b2813_BAGPraemienDaten_chunk40_2026-06-15.json`, count: 2000 },
  { chunk: 41, url: `${BASE}0e629d457_BAGPraemienDaten_chunk41_2026-06-15.json`, count: 2000 },
  { chunk: 42, url: `${BASE}1f3c78ee1_BAGPraemienDaten_chunk42_2026-06-15.json`, count: 2000 },
  { chunk: 43, url: `${BASE}9f167a087_BAGPraemienDaten_chunk43_2026-06-15.json`, count: 2000 },
  { chunk: 44, url: `${BASE}2a30b89ba_BAGPraemienDaten_chunk44_2026-06-15.json`, count: 2000 },
  { chunk: 45, url: `${BASE}b49eaacd4_BAGPraemienDaten_chunk45_2026-06-15.json`, count: 2000 },
  { chunk: 46, url: `${BASE}e18442da2_BAGPraemienDaten_chunk46_2026-06-15.json`, count: 2000 },
  { chunk: 47, url: `${BASE}6badb3a88_BAGPraemienDaten_chunk47_2026-06-15.json`, count: 2000 },
  { chunk: 48, url: `${BASE}dec550706_BAGPraemienDaten_chunk48_2026-06-15.json`, count: 2000 },
  { chunk: 49, url: `${BASE}b6515cee0_BAGPraemienDaten_chunk49_2026-06-15.json`, count: 2000 },
  { chunk: 50, url: `${BASE}b2df91fa8_BAGPraemienDaten_chunk50_2026-06-15.json`, count: 2000 },
  { chunk: 51, url: `${BASE}d34e3af7a_BAGPraemienDaten_chunk51_2026-06-15.json`, count: 2000 },
  { chunk: 52, url: `${BASE}b104977be_BAGPraemienDaten_chunk52_2026-06-15.json`, count: 2000 },
  { chunk: 53, url: `${BASE}926299946_BAGPraemienDaten_chunk53_2026-06-15.json`, count: 2000 },
  { chunk: 54, url: `${BASE}a37731c4a_BAGPraemienDaten_chunk54_2026-06-15.json`, count: 2000 },
  { chunk: 55, url: `${BASE}ccec1f79b_BAGPraemienDaten_chunk55_2026-06-15.json`, count: 324 },
];

const TOTAL_RECORDS = BAG_CHUNKS.reduce((s, c) => s + c.count, 0);

export default function ArchiveDownload() {
  const [downloading, setDownloading] = useState(new Set());
  const [done, setDone] = useState(new Set());

  const getUrl = (c) => c.url || `${BASE}${c.file}`;

  const downloadOne = async (chunk) => {
    const url = getUrl(chunk);
    setDownloading(prev => new Set([...prev, chunk.chunk]));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Validate it's valid JSON before offering download
      JSON.parse(text);
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `BAGPraemienDaten_chunk${String(chunk.chunk).padStart(2,'0')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setDone(prev => new Set([...prev, chunk.chunk]));
    } catch (err) {
      alert(`Chunk ${chunk.chunk} konnte nicht heruntergeladen werden: ${err.message}`);
    } finally {
      setDownloading(prev => { const s = new Set(prev); s.delete(chunk.chunk); return s; });
    }
  };

  const downloadAll = async () => {
    // Sequenziell mit kurzer Pause zwischen Downloads (Browser-Limit)
    for (const chunk of BAG_CHUNKS) {
      await downloadOne(chunk);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  // Download-Index als JSON
  const downloadIndex = () => {
    const index = {
      export_date: '2026-06-15',
      total_records: TOTAL_RECORDS,
      total_chunks: BAG_CHUNKS.length,
      entity: 'BAGPraemienDaten',
      chunks: BAG_CHUNKS.map(c => ({ chunk: c.chunk, count: c.count, url: getUrl(c) })),
    };
    const blob = new Blob([JSON.stringify(index, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'BAGPraemienDaten_INDEX_2026-06-15.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">BAGPraemienDaten — Vollexport</h1>
          <p className="text-muted-foreground text-sm">
            {TOTAL_RECORDS.toLocaleString('de-CH')} Datensätze · {BAG_CHUNKS.length} Chunks · Stand 15.06.2026
          </p>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={downloadAll} className="gap-2">
          <Download className="w-4 h-4" />
          Alle {BAG_CHUNKS.length} Chunks herunterladen
        </Button>
        <Button variant="outline" onClick={downloadIndex} className="gap-2">
          <FileJson className="w-4 h-4" />
          Index-Datei herunterladen
        </Button>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Hinweis:</strong> «Alle herunterladen» lädt die Dateien nacheinander herunter. 
        Alternativ kannst du jeden Chunk einzeln herunterladen oder die <strong>Index-Datei</strong> 
        für eigene Skripte verwenden (enthält alle URLs).
      </div>

      {/* Chunk-Liste */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Chunks ({BAG_CHUNKS.length} Dateien)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
            {BAG_CHUNKS.map((chunk) => {
              const isDone = done.has(chunk.chunk);
              const isLoading = downloading.has(chunk.chunk);
              return (
                <div key={chunk.chunk} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    {isDone
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <FileJson className="w-4 h-4 text-blue-400 shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-medium">
                        Chunk {String(chunk.chunk).padStart(2, '0')}
                        <span className="text-muted-foreground font-normal ml-2 text-xs">
                          {chunk.count.toLocaleString('de-CH')} Einträge
                          · Offset {((chunk.chunk - 1) * 2000).toLocaleString('de-CH')}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={getUrl(chunk)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Öffnen ↗
                    </a>
                    <Button
                      size="sm"
                      variant={isDone ? 'secondary' : 'outline'}
                      onClick={() => downloadOne(chunk)}
                      disabled={isLoading}
                      className="h-7 text-xs gap-1.5"
                    >
                      {isLoading
                        ? '...'
                        : isDone
                          ? <><CheckCircle2 className="w-3 h-3" />OK</>
                          : <><Download className="w-3 h-3" />Download</>
                      }
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Datenquelle: BAG priminfo.admin.ch 2026 · Exportiert am 15.06.2026
      </p>
    </div>
  );
}