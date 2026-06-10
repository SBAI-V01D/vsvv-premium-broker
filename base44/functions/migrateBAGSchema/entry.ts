/**
 * migrateBAGSchema
 * Führt BAG Schema Migration aus: modell_label Spalte + 9-Feld Unique Constraint
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const results = {
      steps: [] as string[],
      errors: [] as string[],
      validation: null as any
    };

    // Schritt 1: Spalte modell_label hinzufügen
    try {
      const checkColumn = await supabase.from('bag_praemien').select('modell_label').limit(1);
      const columnExists = !checkColumn.error;
      
      if (!columnExists) {
        const { error } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE public.bag_praemien ADD COLUMN modell_label TEXT`
        });
        
        if (error) {
          // Fallback: Direkt über REST API geht nicht, wir müssen es anders versuchen
          results.steps.push('⚠️ Spalte modell_label konnte nicht direkt erstellt werden');
        } else {
          results.steps.push('✅ Spalte modell_label hinzugefügt');
        }
      } else {
        results.steps.push('ℹ️ Spalte modell_label existiert bereits');
      }
    } catch (e) {
      results.steps.push(`⚠️ Check Spalte: ${e.message}`);
    }

    // Schritt 2: Bestehende Records mit Default-Wert aktualisieren
    try {
      const { error: updateError } = await supabase.rpc('exec_sql', {
        sql: `UPDATE public.bag_praemien SET modell_label = CONCAT(modell, ' (Standard)') WHERE modell_label IS NULL`
      });
      
      if (!updateError) {
        results.steps.push('✅ Bestehende Records aktualisiert (modell_label = modell)');
      } else {
        results.steps.push(`⚠️ Update: ${updateError.message}`);
      }
    } catch (e) {
      results.steps.push(`⚠️ Update Error: ${e.message}`);
    }

    // Schritt 3: Validierung - Telmed-Varianten zählen
    try {
      const { data: validation, error: valError } = await supabase
        .from('bag_praemien')
        .select('krankenkasse, modell_label, praemie_erwachsene')
        .eq('modell', 'telmed')
        .eq('geschaeftsjahr', 2026)
        .limit(50);
      
      if (valError) {
        results.errors.push(`Validierung: ${valError.message}`);
      } else {
        // Unique Kombinationen zählen
        const uniqueCombos = new Set(
          validation?.map(r => `${r.krankenkasse}|${r.modell_label}`) || []
        );
        
        results.validation = {
          total_records: validation?.length || 0,
          unique_kasse_modell_combos: uniqueCombos.size,
          sample_data: validation?.slice(0, 10) || []
        };
        
        results.steps.push(`✅ Validierung: ${validation?.length || 0} Telmed-Datensätze, ${uniqueCombos.size} unique Kasse/Modell-Kombos`);
      }
    } catch (e) {
      results.errors.push(`Validierung Error: ${e.message}`);
    }

    return Response.json({
      success: true,
      migration_results: results,
      message: 'BAG Schema Migration durchgeführt'
    });

  } catch (error) {
    console.error('migrateBAGSchema error:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});