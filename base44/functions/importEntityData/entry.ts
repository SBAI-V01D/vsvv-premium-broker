import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_name, file_url } = await req.json();

    if (!entity_name || !file_url) {
      return Response.json({ error: 'Missing entity_name or file_url' }, { status: 400 });
    }

    // Extract data from uploaded file
    const schema = await base44.entities[entity_name]?.schema?.();
    
    if (!schema) {
      return Response.json({ error: `Entity ${entity_name} not found` }, { status: 404 });
    }

    // Fetch file content
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: 400 });
    }

    const fileContent = await fileResponse.text();
    const lines = fileContent.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return Response.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    // Parse CSV: first line is headers
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.replace(/^"|"$/g, '').trim());
      return values;
    });

    const records = rows.map(row => {
      const record = {};
      headers.forEach((header, idx) => {
        const value = row[idx] || '';
        record[header] = value === '' ? null : value;
      });
      return record;
    });

    // Bulk create records
    let successful = 0;
    let failed = 0;
    const errors = [];

    for (const record of records) {
      try {
        await base44.entities[entity_name].create(record);
        successful++;
      } catch (error) {
        failed++;
        errors.push(`Row ${successful + failed}: ${error.message}`);
      }
    }

    return Response.json({
      status: 'success',
      successful,
      failed,
      total: records.length,
      errors: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});