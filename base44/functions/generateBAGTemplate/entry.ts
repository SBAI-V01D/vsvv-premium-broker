import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { utils, writeFile } from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = [
      {
        'Krankenkasse': 'CSS',
        'Kanton': 'ZH',
        'Region': 'Gesamt',
        'Modell': 'Standard',
        'Franchise': 300,
        'Praemie_Erwachsene': 420.50,
        'Praemie_Kinder': 120.00,
        'Geschlecht': 'm',
        'Alter_Von': 26,
        'Alter_Bis': 99
      }
    ];

    const ws = utils.json_to_sheet(template);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'BAG_Daten');

    const buffer = writeFile(wb, 'BAG_Praemien_Template.xlsx', { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="BAG_Praemien_Template.xlsx"'
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});