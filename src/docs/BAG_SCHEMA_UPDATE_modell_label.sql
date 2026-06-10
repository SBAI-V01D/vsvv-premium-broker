-- BAG Schema Update: modell_label für exakte Produktzuordnung
-- Problem: UPSERT-Key kollidierte verschiedene Telmed-Varianten (z.B. "BeneFit PLUS Telmed" vs "Helsana Telmed")
-- Lösung: 9-Feld Unique Constraint inkl. modell_label

-- 1. Spalte modell_label hinzufügen (wenn nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bag_praemien' 
      AND column_name = 'modell_label'
  ) THEN
    ALTER TABLE public.bag_praemien 
    ADD COLUMN modell_label TEXT;
    
    RAISE NOTICE 'Spalte modell_label hinzugefügt';
  ELSE
    RAISE NOTICE 'Spalte modell_label existiert bereits';
  END IF;
END $$;

-- 2. Alte Unique Constraint entfernen (falls vorhanden)
ALTER TABLE public.bag_praemien 
DROP CONSTRAINT IF EXISTS bag_praemien_unique;

-- 3. NEUE Unique Constraint mit 9 Feldern (inkl. modell_label)
ALTER TABLE public.bag_praemien
ADD CONSTRAINT bag_praemien_unique 
UNIQUE (
  geschaeftsjahr,
  krankenkasse,
  kanton,
  region,
  modell,
  modell_label,
  franchise,
  unfall,
  altersklasse
);

-- 4. Index für Performance (Composite Index)
DROP INDEX IF EXISTS idx_bag_praemien_produkt_unique;
CREATE INDEX idx_bag_praemien_produkt_unique 
ON public.bag_praemien (
  geschaeftsjahr,
  krankenkasse,
  kanton,
  region,
  modell,
  modell_label,
  franchise,
  unfall,
  altersklasse
);

-- 5. Bestehende Records aktualisieren (modell_label = modell als Fallback)
UPDATE public.bag_praemien
SET modell_label = CONCAT(modell, ' (Standard)')
WHERE modell_label IS NULL;

-- 6. NOT NULL Constraint (nachdem alle Records einen Wert haben)
ALTER TABLE public.bag_praemien
ALTER COLUMN modell_label SET NOT NULL;

-- Validierung
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT (geschaeftsjahr, krankenkasse, kanton, region, modell, modell_label, franchise, unfall, altersklasse)) as unique_combinations
FROM public.bag_praemien;

-- Test: Zeige Telmed-Varianten pro Krankenkasse
SELECT 
  krankenkasse,
  modell_label,
  COUNT(*) as anzahl_records,
  MIN(praemie_erwachsene) as min_praemie,
  MAX(praemie_erwachsene) as max_praemie
FROM public.bag_praemien
WHERE modell = 'telmed'
  AND geschaeftsjahr = 2026
GROUP BY krankenkasse, modell_label
ORDER BY krankenkasse, min_praemie
LIMIT 20;