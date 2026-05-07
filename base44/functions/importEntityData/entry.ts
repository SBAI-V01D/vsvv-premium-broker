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
    
    // Parse data rows
    const records = [];
    const duplicates = [];
    const errors = [];
    
    // Get existing emails for duplicate check
    const existingCustomers = await base44.entities.Customer.list('', 1000) || [];
    const existingEmails = new Set(existingCustomers.map(c => c.email?.toLowerCase()));

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.every(v => !v || v === '')) continue; // Skip empty rows

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
          errors.push(`Row ${i + 1}: Missing required fields (first_name, last_name, or email)`);
          continue;
        }

        // Duplicate check
        if (record.email && existingEmails.has(record.email.toLowerCase())) {
          duplicates.push({
            row: i + 1,
            email: record.email,
            name: `${record.first_name || ''} ${record.last_name || ''}`.trim()
          });
          continue;
        }

        // Set defaults — CRITICAL: ensure visibility
        if (!record.organization_id) {
          // Fetch default org if exists, otherwise set to first org
          record.organization_id = 'ORG_IMPORT_DEFAULT';
        }
        if (!record.customer_type) {
          record.customer_type = 'private';
        }
        if (!record.status) {
          record.status = 'active'; // Active = visible
        }
        if (!record.association_membership) {
          record.association_membership = 'none'; // No association by default
        }
        // Force visibility flags
        record._import_visibility = true;
        record._import_timestamp = new Date().toISOString();

        records.push({ rowNum: i + 1, data: record });
        if (record.email) {
          existingEmails.add(record.email.toLowerCase());
        }
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message?.substring(0, 100)}`);
      }
    }

    // Batch create with aggressive rate limiting
    let successful = 0;
    let failed = 0;
    const failedRecords = [];
    const batchSize = 2;
    const delayMs = 1500;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const item of batch) {
        try {
          const created = await base44.entities[entity_name].create(item.data);
          
          // Force-refresh cache for this record
          if (created?.id) {
            try {
              await base44.entities[entity_name].filter({ id: created.id });
            } catch {}
          }
          
          successful++;
        } catch (error) {
          failed++;
          failedRecords.push({
            row: item.rowNum,
            error: error.message?.substring(0, 100) || 'Unknown error'
          });
        }
      }
      
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return Response.json({
      status: 'success',
      summary: {
        total_rows: lines.length - 1,
        successful,
        failed,
        duplicates: duplicates.length,
        skipped: errors.length
      },
      details: {
        imported: successful,
        failed_records: failedRecords.slice(0, 20),
        duplicates: duplicates.slice(0, 20),
        validation_errors: errors.slice(0, 20)
      }
    });
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