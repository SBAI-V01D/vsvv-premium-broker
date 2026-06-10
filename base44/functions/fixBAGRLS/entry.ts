import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Aktiviert RLS auf bag_praemien und setzt korrekte Policies:
 * - authenticated: SELECT (read-only, öffentliche BAG-Referenzdaten)
 * - service_role:  alle Operationen (INSERT/UPDATE/DELETE via Backend-Functions)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Supabase secrets not configured' }, { status: 500 });
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const statements = [
      // 1. RLS aktivieren
      `ALTER TABLE public.bag_praemien ENABLE ROW LEVEL SECURITY`,

      // 2. Bestehende Policies entfernen (idempotent)
      `DROP POLICY IF EXISTS "authenticated_read_bag_praemien" ON public.bag_praemien`,
      `DROP POLICY IF EXISTS "service_role_all_bag_praemien" ON public.bag_praemien`,
      `DROP POLICY IF EXISTS admin_all_bag_praemien ON public.bag_praemien`,

      // 3. Read-only für alle eingeloggten Nutzer (BAG-Daten sind öffentliche Referenzdaten)
      `CREATE POLICY "authenticated_read_bag_praemien"
        ON public.bag_praemien
        FOR SELECT
        TO authenticated
        USING (true)`,

      // 4. Voller Zugriff nur für service_role (Backend-Functions: Import, Delete)
      `CREATE POLICY "service_role_all_bag_praemien"
        ON public.bag_praemien
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)`,

      // 5. Gleiches Schema für Import-Versions-Tabelle
      `ALTER TABLE public.bag_import_versions ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "authenticated_read_bag_versions" ON public.bag_import_versions`,
      `DROP POLICY IF EXISTS "service_role_all_bag_versions" ON public.bag_import_versions`,
      `CREATE POLICY "authenticated_read_bag_versions"
        ON public.bag_import_versions
        FOR SELECT
        TO authenticated
        USING (true)`,
      `CREATE POLICY "service_role_all_bag_versions"
        ON public.bag_import_versions
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)`,

      // 6. bag_import_errors: nur service_role
      `ALTER TABLE public.bag_import_errors ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "service_role_all_bag_errors" ON public.bag_import_errors`,
      `CREATE POLICY "service_role_all_bag_errors"
        ON public.bag_import_errors
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)`,
    ];

    // Da exec_sql RPC nicht verfügbar ist, gib das SQL direkt zurück
    return Response.json({
      success: false,
      message: 'exec_sql RPC nicht verfügbar — führe das SQL manuell im Supabase SQL Editor aus',
      manual_sql: statements.join(';\n\n') + ';',
      steps: statements.map((s, i) => `${i + 1}. ${s.substring(0, 100).trim()}`)
    });

  } catch (error) {
    console.error('fixBAGRLS error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});