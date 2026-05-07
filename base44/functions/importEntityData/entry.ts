import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const log = (step, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[IMPORT:${step}] ${timestamp} — ${message}`, data || '');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    log('AUTH', `User authenticated: ${user?.email}`);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_name, file_url } = await req.json();
    log('INPUT', `Entity: ${entity_name}, File: ${file_url.substring(0, 50)}...`);

    if (!entity_name || !file_url) {
      return Response.json({ error: 'Missing entity_name or file_url' }, { status: 400 });
    }

    // Fetch file content
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: 400 });
    }

    let fileContent = await fileResponse.text();
    
    // Handle UTF-8 BOM
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    // Parse lines
    const lines = fileContent.split('\n').filter(l => l.trim());
    if (lines.length < 1) {
      return Response.json({ error: 'File is empty' }, { status: 400 });
    }

    // Auto-detect delimiter with proper quote handling
    const countDelimitersOutsideQuotes = (line, delim) => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delim && !inQuotes) {
          count++;
        }
      }
      return count;
    };

    let delimiter = ',';
    const firstLine = lines[0];
    const semicolonCount = countDelimitersOutsideQuotes(firstLine, ';');
    const commaCount = countDelimitersOutsideQuotes(firstLine, ',');
    const tabCount = countDelimitersOutsideQuotes(firstLine, '\t');

    if (semicolonCount > commaCount) delimiter = ';';
    if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';

    log('DELIMITER', `Detected: ${delimiter === ',' ? 'Comma' : delimiter === ';' ? 'Semicolon' : 'Tab'}`);

    // Parse CSV line
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
          const value = current.trim();
          fields.push(value.replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      const lastValue = current.trim();
      fields.push(lastValue.replace(/^"|"$/g, '').trim());
      
      return fields;
    };

    // Normalize column names
    const normalizeColumnName = (name) => {
      return name.toLowerCase().replace(/[\s\-_.]/g, '');
    };

    // Field mappings
    const fieldMap = {
      'vorname': 'first_name',
      'firstname': 'first_name',
      'first_name': 'first_name',
      'name': 'last_name',
      'nachname': 'last_name',
      'lastname': 'last_name',
      'last_name': 'last_name',
      'email': 'email',
      'emai': 'email', // typo variant
      'telefon': 'phone',
      'phone': 'phone',
      'mobile': 'mobile',
      'mobilnummer': 'mobile',
      'strasse': 'street',
      'street': 'street',
      'plz': 'zip_code',
      'zipcode': 'zip_code',
      'zip_code': 'zip_code',
      'ort': 'city',
      'city': 'city',
      'stadt': 'city',
    };

    // Parse headers
    const headerLine = parseCSVLine(lines[0]);
    const headers = headerLine.map(h => normalizeColumnName(h));
    const mappedHeaders = headers.map(h => fieldMap[h] || h);
    
    log('HEADERS', `${headers.length} columns detected`, mappedHeaders.slice(0, 8));
    
    // Get existing customers
    let existingCustomers = [];
    try {
      existingCustomers = await base44.entities.Customer.list('', 1000) || [];
      log('EXISTING', `Found ${existingCustomers.length} existing customers`);
    } catch (err) {
      log('EXISTING', `Error fetching: ${err.message}`);
    }
    const existingEmails = new Set(existingCustomers.map(c => c.email?.toLowerCase()).filter(Boolean));

    // Parse data rows
    const records = [];
    const duplicates = [];
    const validationErrors = [];
    const processedEmails = new Set();
    
    log('PARSING', `Processing ${lines.length - 1} data rows...`);
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.every(v => !v || v === '')) {
          log('PARSE_SKIP', `Row ${i + 1}: Empty row`);
          continue;
        }

        const record = {};
        mappedHeaders.forEach((header, idx) => {
          const value = values[idx]?.trim();
          if (value && header) {
            record[header] = value;
          }
        });

        // Validate required fields
        if (!record.first_name || !record.first_name.trim()) {
          validationErrors.push({ row: i + 1, error: 'Vorname erforderlich' });
          continue;
        }

        if (!record.last_name || !record.last_name.trim()) {
          validationErrors.push({ row: i + 1, error: 'Nachname erforderlich' });
          continue;
        }

        // Validate/sanitize email if provided
        if (record.email && record.email.trim()) {
          record.email = record.email.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
            validationErrors.push({ row: i + 1, error: `Ungültiges E-Mail: ${record.email}` });
            continue;
          }
          
          // Check duplicates
          if (existingEmails.has(record.email) || processedEmails.has(record.email)) {
            duplicates.push({ row: i + 1, email: record.email, name: `${record.first_name} ${record.last_name}` });
            continue;
          }
          processedEmails.add(record.email);
        } else {
          // Generate unique placeholder email
          record.email = `import_${Date.now()}_${i}@local.vsvv`;
        }

        // Set defaults
        if (!record.organization_id) {
          const orgs = await base44.entities.Organization.list('', 1);
          record.organization_id = orgs?.[0]?.id || 'ORG_IMPORT_DEFAULT';
        }
        record.customer_type = record.customer_type || 'private';
        record.status = record.status || 'active';
        record.mandate_status = record.mandate_status || 'pending';
        record.association_membership = record.association_membership || 'none';
        record.is_family_member = false;
        
        log('VALIDATION_PASS', `Row ${i + 1}: ${record.first_name} ${record.last_name}`);
        records.push({ rowNum: i + 1, data: record });
        
      } catch (error) {
        log('PARSE_ERROR', `Row ${i + 1}: ${error.message}`);
        validationErrors.push({ row: i + 1, error: `Parse: ${error.message.substring(0, 50)}` });
      }
    }

    // Batch insertion
    log('INSERTION', `Starting insertion of ${records.length} records...`);
    
    let successful = 0;
    let failed = 0;
    const failedRecords = [];
    const createdIds = [];
    const batchSize = 5;
    const delayMs = 1000;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      for (const item of batch) {
        try {
          const created = await base44.entities[entity_name].create(item.data);
          
          if (created?.id) {
            createdIds.push(created.id);
            successful++;
          } else {
            failed++;
            failedRecords.push({ row: item.rowNum, email: item.data.email, error: 'No ID' });
          }
        } catch (error) {
          failed++;
          failedRecords.push({
            row: item.rowNum,
            email: item.data.email,
            error: error?.message?.substring(0, 100) || 'Unknown error'
          });
        }
      }
      
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    log('FINAL', `Complete: ${successful} OK, ${failed} failed, ${duplicates.length} dupes, ${validationErrors.length} errors`);

    return Response.json({
      status: 'success',
      summary: {
        total_rows_in_file: lines.length - 1,
        successfully_imported: successful,
        failed: failed,
        duplicates_skipped: duplicates.length,
        validation_errors: validationErrors.length,
        total_processed: successful + failed + duplicates.length + validationErrors.length,
        success_rate: records.length > 0 ? ((successful / records.length) * 100).toFixed(1) : 0
      },
      details: {
        imported: { count: successful, ids: createdIds.slice(0, 5) },
        failed_rows: failedRecords.slice(0, 50),
        duplicates: duplicates.slice(0, 50),
        validation_errors: validationErrors.slice(0, 50)
      }
    });
    
  } catch (error) {
    console.error('[IMPORT:ERROR]', error);
    return Response.json({ 
      status: 'error',
      error: error.message || 'Import failed'
    }, { status: 500 });
  }
});