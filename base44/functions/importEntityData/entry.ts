import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Detailed logging for enterprise debugging
const log = (step, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[IMPORT:${step}] ${timestamp} — ${message}`, data || '');
};

// Validate customer record before insertion
const validateCustomerRecord = (record, rowNum) => {
  const errors = [];

  // Required fields
  if (!record.first_name || !record.first_name.trim()) {
    errors.push('Vorname erforderlich');
  }
  if (!record.last_name || !record.last_name.trim()) {
    errors.push('Nachname erforderlich');
  }
  if (!record.email || !record.email.trim()) {
    errors.push('E-Mail erforderlich');
  }

  // Email format validation
  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email.trim())) {
    errors.push(`Ungültiges E-Mail-Format: ${record.email}`);
  }

  // Field length limits
  if (record.first_name && record.first_name.length > 100) {
    errors.push('Vorname zu lang (max. 100 Zeichen)');
  }
  if (record.last_name && record.last_name.length > 100) {
    errors.push('Nachname zu lang (max. 100 Zeichen)');
  }
  if (record.notes && record.notes.length > 5000) {
    errors.push('Notizen zu lang (max. 5000 Zeichen)');
  }

  // Phone validation (if provided)
  if (record.phone && record.phone.length > 50) {
    errors.push('Telefonnummer zu lang');
  }
  if (record.mobile && record.mobile.length > 50) {
    errors.push('Mobilnummer zu lang');
  }

  // Zip code validation (if provided)
  if (record.zip_code && !/^\d{4}$/.test(record.zip_code.replace(/\s/g, ''))) {
    errors.push(`Ungültige PLZ-Format: ${record.zip_code}`);
  }

  // Date validation (if provided)
  const dateFields = ['birthdate', 'drivers_license_date'];
  for (const field of dateFields) {
    if (record[field]) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(record[field])) {
        errors.push(`Ungültiges Datumsformat in ${field}: ${record[field]}`);
      } else {
        const date = new Date(record[field]);
        if (isNaN(date.getTime())) {
          errors.push(`Ungültiges Datum in ${field}: ${record[field]}`);
        }
      }
    }
  }

  return errors;
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

    // Auto-detect delimiter (comma, semicolon, tab)
    const lines = fileContent.split('\n').filter(l => l.trim());
    if (lines.length < 1) {
      return Response.json({ error: 'File is empty' }, { status: 400 });
    }

    let delimiter = ',';
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semicolonCount > commaCount) delimiter = ';';
    if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';

    // Parse CSV with robust quoted field handling
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
          fields.push(current.replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.replace(/^"|"$/g, '').trim());
      return fields;
    };

    // Parse headers - normalize column names
    const headerLine = parseCSVLine(lines[0]);
    const headers = headerLine.map(h => normalizeColumnName(h));
    log('HEADERS', `Detected ${headers.length} columns`, headers);
    
    // Standard field mappings
    const fieldMap = {
      'vorname': 'first_name',
      'firstname': 'first_name',
      'first_name': 'first_name',
      'name': 'last_name',
      'nachname': 'last_name',
      'lastname': 'last_name',
      'last_name': 'last_name',
      'email': 'email',
      'e-mail': 'email',
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
      'geburtsdatum': 'birthdate',
      'birthdate': 'birthdate',
      'notizen': 'notes',
      'notes': 'notes',
      'firmennaam': 'company_name',
      'company': 'company_name',
    };

    const mappedHeaders = headers.map(h => fieldMap[h] || h);
    log('MAPPING', `Mapped headers`, mappedHeaders);
    
    // Parse data rows
    const records = [];
    const duplicates = [];
    const validationErrors = [];
    const processedEmails = new Set();
    
    // Get existing emails for duplicate check
    log('EXISTING', `Fetching existing customers...`);
    let existingCustomers = [];
    try {
      existingCustomers = await base44.entities.Customer.list('', 1000) || [];
      log('EXISTING', `Found ${existingCustomers.length} existing customers`);
    } catch (err) {
      log('EXISTING', `Error fetching customers: ${err.message}`);
    }
    const existingEmails = new Set(existingCustomers.map(c => c.email?.toLowerCase()));

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
          log('VALIDATION_ERROR', `Row ${i + 1}: Vorname fehlt`);
          validationErrors.push({
            row: i + 1,
            error: 'Vorname erforderlich'
          });
          continue;
        }

        if (!record.last_name || !record.last_name.trim()) {
          log('VALIDATION_ERROR', `Row ${i + 1}: Nachname fehlt`);
          validationErrors.push({
            row: i + 1,
            error: 'Nachname erforderlich'
          });
          continue;
        }

        if (!record.email || !record.email.trim()) {
          log('VALIDATION_ERROR', `Row ${i + 1}: E-Mail fehlt`);
          validationErrors.push({
            row: i + 1,
            error: 'E-Mail erforderlich'
          });
          continue;
        }

        // Sanitize and validate email
        record.email = record.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
          log('VALIDATION_ERROR', `Row ${i + 1}: Ungültiges E-Mail-Format`);
          validationErrors.push({
            row: i + 1,
            error: `Ungültiges E-Mail-Format: ${record.email}`
          });
          continue;
        }

        // Duplicate check (existing OR in current batch)
        if (existingEmails.has(record.email)) {
          log('DUPLICATE', `Row ${i + 1}: ${record.email} (existing)`);
          duplicates.push({
            row: i + 1,
            email: record.email,
            name: `${record.first_name} ${record.last_name}`
          });
          continue;
        }

        if (processedEmails.has(record.email)) {
          log('DUPLICATE', `Row ${i + 1}: ${record.email} (in batch)`);
          duplicates.push({
            row: i + 1,
            email: record.email,
            name: `${record.first_name} ${record.last_name}`
          });
          continue;
        }

        processedEmails.add(record.email);

        // Run full validation
        const fieldErrors = validateCustomerRecord(record, i + 1);
        if (fieldErrors.length > 0) {
          log('VALIDATION_ERROR', `Row ${i + 1}: ${fieldErrors.join(', ')}`);
          validationErrors.push({
            row: i + 1,
            error: fieldErrors.join('; ')
          });
          continue;
        }

        // Set safe defaults
        if (!record.organization_id) {
          const orgs = await base44.entities.Organization.list('', 1);
          record.organization_id = orgs?.[0]?.id || 'ORG_IMPORT_DEFAULT';
        }
        if (!record.customer_type) record.customer_type = 'private';
        if (!record.status) record.status = 'active';
        if (!record.mandate_status) record.mandate_status = 'pending';
        if (!record.association_membership) record.association_membership = 'none';
        record.is_family_member = false;
        
        log('VALIDATION_PASS', `Row ${i + 1}: ${record.first_name} ${record.last_name} (${record.email})`);
        records.push({ rowNum: i + 1, data: record });
        
      } catch (error) {
        log('PARSE_ERROR', `Row ${i + 1}: ${error.message}`);
        validationErrors.push({
          row: i + 1,
          error: `Parse error: ${error.message.substring(0, 100)}`
        });
      }
    }

    // Batch creation with safe error recovery
    log('INSERTION', `Starting batch insertion of ${records.length} validated records...`);
    
    let successful = 0;
    let failed = 0;
    const failedRecords = [];
    const createdIds = [];
    const batchSize = 5;
    const delayMs = 1500;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);
      log('BATCH', `Processing batch ${batchNum}/${totalBatches} (${batch.length} records)`);
      
      for (const item of batch) {
        let rowError = null;
        try {
          log('CREATE', `Creating: Row ${item.rowNum} - ${item.data.first_name} ${item.data.last_name}`);
          const created = await base44.entities[entity_name].create(item.data);
          
          if (created?.id) {
            createdIds.push(created.id);
            log('SUCCESS', `Row ${item.rowNum}: ID ${created.id}`);
            successful++;
          } else {
            rowError = 'Keine ID zurückgegeben';
            throw new Error(rowError);
          }
        } catch (error) {
          const errMsg = error?.message || 'Unbekannter Fehler';
          log('CREATE_ERROR', `Row ${item.rowNum}: ${errMsg}`);
          failed++;
          failedRecords.push({
            row: item.rowNum,
            email: item.data.email,
            name: `${item.data.first_name} ${item.data.last_name}`,
            error: errMsg.substring(0, 200)
          });
        }
      }
      
      if (i + batchSize < records.length) {
        log('DELAY', `Batch ${batchNum}/${totalBatches} done. Delaying ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    log('INSERTION_COMPLETE', `Successful: ${successful}, Failed: ${failed}`);
    log('CREATED_IDS', `Total created IDs: ${createdIds.length}`, createdIds.slice(0, 5));

    log('FINAL', `Import complete: ${successful} successful, ${failed} failed, ${duplicates.length} duplicates, ${validationErrors.length} validation errors`);
    
    const response = {
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
        imported: {
          count: successful,
          ids: createdIds.slice(0, 5)
        },
        failed_rows: failedRecords.slice(0, 50),
        duplicates: duplicates.slice(0, 50),
        validation_errors: validationErrors.slice(0, 50)
      },
      enterprise: {
        import_id: `IMPORT_${Date.now()}`,
        processed_at: new Date().toISOString(),
        batch_strategy: `${batchSize} records per batch`,
        rate_limit_delay_ms: delayMs
      }
    };
    
    return Response.json(response);
  } catch (error) {
    return Response.json({ 
      error: error.message,
      status: 'error'
    }, { status: 500 });
  }
});

function normalizeColumnName(name) {
  return name.toLowerCase().replace(/[\s\-_.]/g, '');
}