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
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Fetch file
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return Response.json({ error: 'File fetch failed' }, { status: 400 });
    }

    let fileContent = await fileResponse.text();
    
    // Remove BOM
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    const lines = fileContent.split('\n').filter(l => l.trim());
    
    if (lines.length < 1) {
      return Response.json({ error: 'Empty file' }, { status: 400 });
    }

    // Detect delimiter
    const countDelimiters = (line, delim) => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"' && (i === 0 || line[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (line[i] === delim && !inQuotes) {
          count++;
        }
      }
      return count;
    };

    let delimiter = ',';
    const firstLine = lines[0];
    const counts = {
      ',': countDelimiters(firstLine, ','),
      ';': countDelimiters(firstLine, ';'),
      '\t': countDelimiters(firstLine, '\t')
    };

    if (counts[';'] > counts[',']) delimiter = ';';
    if (counts['\t'] > counts[';'] && counts['\t'] > counts[',']) delimiter = '\t';

    console.log(`[IMPORT] Delimiter: ${delimiter}, Rows: ${lines.length}`);

    // Parse CSV
    const parseCSVLine = (line) => {
      const fields = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          fields.push(current.trim().replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      fields.push(current.trim().replace(/^"|"$/g, '').trim());
      return fields;
    };

    // Normalize headers
    const normalizeHeader = (h) => h.toLowerCase().replace(/[\s\-_.]/g, '');

    const fieldMap = {
      'vorname': 'first_name', 'firstname': 'first_name', 'first_name': 'first_name',
      'name': 'last_name', 'nachname': 'last_name', 'lastname': 'last_name', 'last_name': 'last_name',
      'email': 'email', 'emai': 'email',
      'telefon': 'phone', 'phone': 'phone',
      'mobile': 'mobile', 'mobilnummer': 'mobile',
      'strasse': 'street', 'street': 'street',
      'plz': 'zip_code', 'zipcode': 'zip_code', 'zip_code': 'zip_code',
      'ort': 'city', 'city': 'city', 'stadt': 'city',
    };

    const headerLine = parseCSVLine(lines[0]);
    const headers = headerLine.map(normalizeHeader);
    const mappedHeaders = headers.map(h => fieldMap[h] || h);

    console.log(`[IMPORT] Headers: ${mappedHeaders.slice(0, 8).join(', ')}`);

    // Get default organization
    let defaultOrgId = null;
    try {
      const orgs = await base44.entities.Organization.list('', 1);
      defaultOrgId = orgs?.[0]?.id;
      console.log(`[IMPORT] Default org: ${defaultOrgId}`);
    } catch (e) {
      console.log(`[IMPORT] No orgs found, will skip org requirement`);
    }

    // Parse data
    const records = [];
    let rowCount = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        // Skip empty rows
        if (values.every(v => !v || v === '')) continue;

        const record = {};
        mappedHeaders.forEach((header, idx) => {
          const value = values[idx];
          if (value && header) {
            record[header] = value;
          }
        });

        // ONLY require first_name and last_name
        if (!record.first_name || !record.first_name.trim()) continue;
        if (!record.last_name || !record.last_name.trim()) continue;

        // Clean up names
        record.first_name = record.first_name.trim();
        record.last_name = record.last_name.trim();

        // Generate email if missing
        if (!record.email || !record.email.trim()) {
          record.email = `import_${Date.now()}_${i}@local.vsvv`;
        } else {
          record.email = record.email.trim().toLowerCase();
        }

        // Set required org
        if (defaultOrgId) {
          record.organization_id = defaultOrgId;
        } else {
          record.organization_id = 'ORG_IMPORT_DEFAULT';
        }

        // Set safe defaults
        record.customer_type = 'private';
        record.status = 'active';
        record.mandate_status = 'pending';
        record.is_family_member = false;

        records.push({ rowNum: i + 1, data: record });
        rowCount++;

      } catch (e) {
        console.log(`[IMPORT] Row ${i + 1} parse error: ${e.message}`);
      }
    }

    console.log(`[IMPORT] Parsed ${rowCount} valid records from ${lines.length - 1} data rows`);

    // Batch insert
    let successful = 0;
    let failed = 0;
    const failedRows = [];
    const batchSize = 10;
    const delayMs = 500;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const item of batch) {
        try {
          const created = await base44.entities[entity_name].create(item.data);
          if (created?.id) {
            successful++;
            if (successful % 100 === 0) {
              console.log(`[IMPORT] Progress: ${successful}/${rowCount}`);
            }
          } else {
            failed++;
            failedRows.push({ row: item.rowNum, error: 'No ID returned' });
          }
        } catch (error) {
          failed++;
          failedRows.push({ row: item.rowNum, email: item.data.email, error: error.message?.substring(0, 80) });
        }
      }
      
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[IMPORT] Complete: ${successful} OK, ${failed} failed`);

    return Response.json({
      status: 'success',
      summary: {
        total_rows_in_file: lines.length - 1,
        successfully_imported: successful,
        failed: failed,
        duplicates_skipped: 0,
        validation_errors: 0,
        total_processed: successful + failed,
        success_rate: rowCount > 0 ? ((successful / rowCount) * 100).toFixed(1) : 0
      },
      details: {
        failed_rows: failedRows.slice(0, 20)
      }
    });
    
  } catch (error) {
    console.error('[IMPORT] Error:', error.message);
    return Response.json({ 
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
});