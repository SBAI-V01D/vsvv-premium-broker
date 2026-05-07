import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Detailed logging for enterprise debugging
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
    const errors = [];
    const validationDetails = [];
    
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
        let hasRequiredFields = false;

        mappedHeaders.forEach((header, idx) => {
          const value = values[idx]?.trim();
          if (value && header) {
            record[header] = value;
            if (header === 'first_name' || header === 'last_name' || header === 'email') {
              hasRequiredFields = true;
            }
          }
        });

        if (!hasRequiredFields) {
          const msg = `Row ${i + 1}: Missing required fields`;
          log('VALIDATION_ERROR', msg);
          errors.push(msg);
          validationDetails.push({ row: i + 1, issue: msg, data: record });
          continue;
        }

        // Duplicate check
        if (record.email && existingEmails.has(record.email.toLowerCase())) {
          log('DUPLICATE', `Row ${i + 1}: ${record.email}`);
          duplicates.push({
            row: i + 1,
            email: record.email,
            name: `${record.first_name || ''} ${record.last_name || ''}`.trim()
          });
          continue;
        }

        // Set defaults — CRITICAL: ensure visibility + database persistence
        if (!record.organization_id) {
          // Get first org or use placeholder
          const orgs = await base44.entities.Organization.list('', 1);
          record.organization_id = orgs?.[0]?.id || 'ORG_IMPORT_DEFAULT';
          log('ORG_ASSIGN', `Row ${i + 1}: Assigned org ${record.organization_id}`);
        }
        if (!record.customer_type) {
          record.customer_type = 'private';
        }
        if (!record.status) {
          record.status = 'active'; // CRITICAL: Active = visible
        }
        if (!record.association_membership) {
          record.association_membership = 'none';
        }
        
        // CRITICAL: Force visibility by never setting hidden flags
        record.is_family_member = false; // Always primary customer
        
        log('VALIDATION_PASS', `Row ${i + 1}: ${record.first_name} ${record.last_name}`);

        records.push({ rowNum: i + 1, data: record });
        if (record.email) {
          existingEmails.add(record.email.toLowerCase());
        }
      } catch (error) {
        const msg = `Row ${i + 1}: ${error.message?.substring(0, 100)}`;
        log('PARSE_ERROR', msg);
        errors.push(msg);
        validationDetails.push({ row: i + 1, error: error.message, data: record });
      }
    }

    // Batch create with aggressive rate limiting
    log('INSERTION', `Starting batch insertion of ${records.length} records...`);
    
    let successful = 0;
    let failed = 0;
    const failedRecords = [];
    const createdIds = [];
    const batchSize = 2;
    const delayMs = 1500;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      log('BATCH', `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      
      for (const item of batch) {
        try {
          log('CREATE', `Creating customer: ${item.data.first_name} ${item.data.last_name} (${item.data.email})`);
          const created = await base44.entities[entity_name].create(item.data);
          
          if (created?.id) {
            createdIds.push(created.id);
            log('SUCCESS', `Row ${item.rowNum}: Created ID ${created.id}`);
            
            // Verify record was actually inserted
            try {
              const verified = await base44.entities[entity_name].filter({ id: created.id });
              if (verified && verified.length > 0) {
                log('VERIFY', `Row ${item.rowNum}: Record verified in database`);
                successful++;
              } else {
                log('VERIFY_FAIL', `Row ${item.rowNum}: Record not found after creation!`);
                failed++;
                failedRecords.push({
                  row: item.rowNum,
                  error: 'Record created but not found in database'
                });
              }
            } catch (verifyErr) {
              log('VERIFY_ERROR', `Row ${item.rowNum}: Verification error: ${verifyErr.message}`);
              successful++; // Still count as success if created
            }
          } else {
            log('CREATE_NO_ID', `Row ${item.rowNum}: No ID returned`);
            failed++;
            failedRecords.push({
              row: item.rowNum,
              error: 'No ID returned from creation'
            });
          }
        } catch (error) {
          const errMsg = error.message?.substring(0, 150) || 'Unknown error';
          log('CREATE_ERROR', `Row ${item.rowNum}: ${errMsg}`);
          failed++;
          failedRecords.push({
            row: item.rowNum,
            error: errMsg
          });
        }
      }
      
      if (i + batchSize < records.length) {
        log('DELAY', `Waiting ${delayMs}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    log('INSERTION_COMPLETE', `Successful: ${successful}, Failed: ${failed}`);
    log('CREATED_IDS', `Total created IDs: ${createdIds.length}`, createdIds.slice(0, 5));

    log('RESPONSE', `Preparing response: ${successful} successful, ${failed} failed`);
    
    const response = {
      status: 'success',
      summary: {
        total_rows: lines.length - 1,
        successfully_imported: successful,
        failed: failed,
        duplicates_detected: duplicates.length,
        skipped: errors.length,
        success_rate: successful > 0 ? ((successful / records.length) * 100).toFixed(1) : 0
      },
      details: {
        imported_count: successful,
        failed_records: failedRecords.slice(0, 20),
        duplicates: duplicates.slice(0, 20),
        validation_errors: errors.slice(0, 20),
        created_ids: createdIds.slice(0, 10)
      },
      debug: {
        total_records_parsed: records.length,
        batch_size: batchSize,
        delay_ms: delayMs,
        timestamp_completed: new Date().toISOString()
      }
    };
    
    log('FINAL', `Response ready`, { successful, failed, duplicates: duplicates.length });
    
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