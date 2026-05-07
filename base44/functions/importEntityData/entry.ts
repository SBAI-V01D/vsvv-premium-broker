import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_name, file_url, field_mapping = {}, default_values = {} } = await req.json();

    if (!entity_name || !file_url) {
      return Response.json({ error: 'Missing entity_name or file_url' }, { status: 400 });
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

    // Robust CSV parsing with quoted field support
    const parseCSVLine = (line) => {
      const fields = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped quote
            current += '"';
            i++;
          } else {
            // Toggle quote mode
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim());
      return fields;
    };

    // Parse headers and data
    const headerLine = parseCSVLine(lines[0]);
    const headers = headerLine.map(h => h.replace(/^"|"$/g, '').trim());
    
    const dataLines = lines.slice(1);
    const records = dataLines.map((line) => {
      const values = parseCSVLine(line);
      const record = {};
      
      headers.forEach((header, idx) => {
        let value = values[idx] ? values[idx].replace(/^"|"$/g, '').trim() : '';
        
        // Apply field mapping if provided
        const mappedField = field_mapping[header] || header;
        
        // Clean value
        value = value === '' || value === 'NULL' ? null : value;
        
        if (value !== null) {
          record[mappedField] = value;
        }
      });

      // Apply default values
      Object.entries(default_values).forEach(([field, val]) => {
        if (!record[field]) {
          record[field] = val;
        }
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
        errors.push(`Row: ${error.message}`);
      }
    }

    return Response.json({
      status: 'success',
      successful,
      failed,
      total: records.length,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});