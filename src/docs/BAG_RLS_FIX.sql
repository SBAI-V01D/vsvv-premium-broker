-- ============================================================
-- BAG RLS FIX — einmalig im Supabase SQL Editor ausführen
-- (bag_import_errors weggelassen — Tabelle existiert noch nicht)
-- ============================================================

-- 1. RLS aktivieren
ALTER TABLE public.bag_praemien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bag_import_versions ENABLE ROW LEVEL SECURITY;

-- 2. Alte Policies entfernen (idempotent)
DROP POLICY IF EXISTS admin_all_bag_praemien ON public.bag_praemien;
DROP POLICY IF EXISTS "authenticated_read_bag_praemien" ON public.bag_praemien;
DROP POLICY IF EXISTS "service_role_all_bag_praemien" ON public.bag_praemien;
DROP POLICY IF EXISTS "authenticated_read_bag_versions" ON public.bag_import_versions;
DROP POLICY IF EXISTS "service_role_all_bag_versions" ON public.bag_import_versions;

-- 3. bag_praemien Policies
CREATE POLICY "authenticated_read_bag_praemien"
  ON public.bag_praemien FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_role_all_bag_praemien"
  ON public.bag_praemien FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. bag_import_versions Policies
CREATE POLICY "authenticated_read_bag_versions"
  ON public.bag_import_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_role_all_bag_versions"
  ON public.bag_import_versions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. GRANTs
GRANT SELECT ON public.bag_praemien TO authenticated;
GRANT ALL ON public.bag_praemien TO service_role;

GRANT SELECT ON public.bag_import_versions TO authenticated;
GRANT ALL ON public.bag_import_versions TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;