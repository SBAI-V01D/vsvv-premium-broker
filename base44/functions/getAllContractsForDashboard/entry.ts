import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Liefert ALLE aktiven/abgelaufenen Verträge für das Dashboard
 * Nur für Admins - umgeht RLS
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use asServiceRole to bypass RLS completely
    const contracts = await base44.asServiceRole.entities.Contract.filter(
      { status: ['active', 'expired'] }, 
      '-end_date', 
      500
    );

    return Response.json({ data: contracts });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});