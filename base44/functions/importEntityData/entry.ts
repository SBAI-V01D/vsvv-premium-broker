import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_name, file_url } = await req.json();

    // Fetch file
    const fileResponse = await fetch(file_url);
    let fileContent = await fileResponse.text();
    
    // Remove BOM
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    const lines = fileContent.split('\n').filter(l => l.trim());

    // Detect delimiter
    const countChar = (line, char) => {
      let count = 0, inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === char && !inQuotes) count++;
      }
      return count;
    };

    let delimiter = ',';
    const firstLine = lines[0];
    if (countChar(firstLine, ';') > countChar(firstLine, ',')) delimiter = ';';
    if (countChar(firstLine, '\t') > countChar(firstLine, ';')) delimiter = '\t';

    // CSV parser
    const parseCSV = (line) => {
      const fields = [];
      let field = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delimiter && !inQuotes) {
          fields.push(field.trim().replace(/^"|"$/g, ''));
          field = '';
        } else {
          field += char;
        }
      }
      fields.push(field.trim().replace(/^"|"$/g, ''));
      return fields;
    };

    // Map headers
    const normalize = (s) => s.toLowerCase().replace(/[\s\-_.äöü]/g, '');
    const headerLine = parseCSV(lines[0]);
    const headers = headerLine.map(normalize);
    
    const fieldMap = {
      'vorname': 'first_name', 'firstname': 'first_name',
      'nachname': 'last_name', 'name': 'last_name', 'lastname': 'last_name',
      'email': 'email', 'mail': 'email',
      'telefon': 'phone', 'phone': 'phone',
      'mobile': 'mobile', 'mobilnummer': 'mobile',
      'strasse': 'street', 'street': 'street',
      'plz': 'zip_code', 'zipcode': 'zip_code',
      'ort': 'city', 'city': 'city', 'stadt': 'city',
      'kanton': 'canton', 'canton': 'canton',
    };

    const mappedHeaders = headers.map(h => fieldMap[h] || h);

    // Get default org
    let defaultOrgId = null;
    try {
      const orgs = await base44.entities.Organization.list('', 1);
      if (orgs?.length > 0) defaultOrgId = orgs[0].id;
    } catch (e) {}

    // Parse records
    const records = [];
    const usedEmails = new Set();

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSV(lines[i]);
      if (values.every(v => !v)) continue;

      const record = {};
      mappedHeaders.forEach((header, idx) => {
        const val = values[idx]?.trim();
        if (val && header) record[header] = val;
      });

      // Validate only first_name and last_name
      if (!record.first_name || !record.last_name) continue;

      // Handle email
      if (record.email) {
        record.email = record.email.toLowerCase();
      } else {
        // Generate unique email from name
        const base = `${record.first_name.substring(0, 1).toLowerCase()}${record.last_name.toLowerCase().replace(/\s/g, '')}@import.local`;
        let email = base;
        let counter = 1;
        while (usedEmails.has(email)) {
          email = `${record.first_name.substring(0, 1).toLowerCase()}${record.last_name.toLowerCase().replace(/\s/g, '')}${counter}@import.local`;
          counter++;
        }
        record.email = email;
      }

      usedEmails.add(record.email);
      record.organization_id = defaultOrgId;
      record.customer_type = 'private';
      record.status = 'active';
      record.mandate_status = 'pending';
      record.is_family_member = false;

      records.push(record);
    }

    console.log(`[IMPORT] Importing ${records.length} records`);

    // Insert
    let successful = 0;
    let failed = 0;
    const failedRows = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const result = await base44.entities[entity_name].create(records[i]);
        if (result?.id) {
          successful++;
        } else {
          failed++;
          failedRows.push({ email: records[i].email, error: 'No ID' });
        }
      } catch (e) {
        failed++;
        failedRows.push({ email: records[i].email, error: e.message?.substring(0, 50) });
      }

      // Small delay every 10 records
      if ((i + 1) % 10 === 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return Response.json({
      status: 'success',
      summary: {
        total_rows_in_file: lines.length - 1,
        successfully_imported: successful,
        failed: failed,
        success_rate: records.length > 0 ? ((successful / records.length) * 100).toFixed(0) : 0
      },
      details: { failed_rows: failedRows.slice(0, 10) }
    });
    
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
});