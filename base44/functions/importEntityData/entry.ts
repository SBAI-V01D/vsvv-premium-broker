import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_name, file_url } = await req.json();

    // Get default org ONCE at start
    let defaultOrgId = null;
    try {
      const orgs = await base44.entities.Organization.list('', 1);
      if (orgs?.length > 0) defaultOrgId = orgs[0].id;
      console.log(`[IMPORT] Default org: ${defaultOrgId}`);
    } catch (e) {
      console.error(`[IMPORT] Org error: ${e.message}`);
    }

    // Fetch file
    const fileResponse = await fetch(file_url);
    let fileContent = await fileResponse.text();
    console.log(`[IMPORT] File size: ${fileContent.length} bytes`);
    
    // Remove BOM
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    const lines = fileContent.split('\n').filter(l => l.trim());
    console.log(`[IMPORT] Total lines: ${lines.length}`);

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
    console.log(`[IMPORT] Delimiter: ${delimiter === ',' ? 'comma' : delimiter === ';' ? 'semicolon' : 'tab'}`);

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

    // Parse header line
    const headerLine = parseCSV(lines[0]);
    console.log(`[IMPORT] Headers: ${headerLine.slice(0, 5).join(' | ')}`);

    // Create flexible header mapping
    const findColumnIndex = (headerLine, keywords) => {
      return headerLine.findIndex(h => {
        const lower = h.toLowerCase().trim();
        return keywords.some(k => lower.includes(k));
      });
    };

    const firstNameIdx = findColumnIndex(headerLine, ['vorname', 'firstname', 'first name', 'prénom']);
    const lastNameIdx = findColumnIndex(headerLine, ['nachname', 'lastname', 'last name', 'nom', 'surname']);
    const emailIdx = findColumnIndex(headerLine, ['email', 'e-mail', 'mail']);
    const phoneIdx = findColumnIndex(headerLine, ['telefon', 'phone', 'tel']);
    const mobileIdx = findColumnIndex(headerLine, ['mobile', 'mobilnummer', 'cell', 'handy']);
    const streetIdx = findColumnIndex(headerLine, ['strasse', 'street', 'address', 'adresse']);
    const zipIdx = findColumnIndex(headerLine, ['plz', 'zip', 'postcode', 'postal']);
    const cityIdx = findColumnIndex(headerLine, ['ort', 'city', 'stadt', 'commune']);
    const cantonIdx = findColumnIndex(headerLine, ['kanton', 'canton']);

    console.log(`[IMPORT] Columns: first=${firstNameIdx}, last=${lastNameIdx}, email=${emailIdx}`);

    // Parse records
    const records = [];
    const usedEmails = new Set();

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSV(lines[i]);
      
      // Skip completely empty rows
      if (values.every(v => !v || v.trim() === '')) continue;

      // Extract by column index
      const firstName = firstNameIdx >= 0 ? values[firstNameIdx]?.trim() : '';
      const lastName = lastNameIdx >= 0 ? values[lastNameIdx]?.trim() : '';
      const email = emailIdx >= 0 ? values[emailIdx]?.trim() : '';
      const phone = phoneIdx >= 0 ? values[phoneIdx]?.trim() : '';
      const mobile = mobileIdx >= 0 ? values[mobileIdx]?.trim() : '';
      const street = streetIdx >= 0 ? values[streetIdx]?.trim() : '';
      const zipCode = zipIdx >= 0 ? values[zipIdx]?.trim() : '';
      const city = cityIdx >= 0 ? values[cityIdx]?.trim() : '';
      const canton = cantonIdx >= 0 ? values[cantonIdx]?.trim() : '';

      // Skip if no first name AND last name
      if (!firstName && !lastName) continue;

      const record = {};
      
      // Add what we have
      if (firstName) record.first_name = firstName;
      if (lastName) record.last_name = lastName;
      if (email) record.email = email.toLowerCase();
      if (phone) record.phone = phone;
      if (mobile) record.mobile = mobile;
      if (street) record.street = street;
      if (zipCode) record.zip_code = zipCode;
      if (city) record.city = city;
      if (canton) record.canton = canton;

      // If email missing, generate from name
      if (!record.email) {
        const base = `${(firstName?.[0] || 'x').toLowerCase()}${(lastName || 'user').toLowerCase().replace(/\s/g, '')}@import.local`;
        let email = base;
        let counter = 1;
        while (usedEmails.has(email)) {
          email = `${(firstName?.[0] || 'x').toLowerCase()}${(lastName || 'user').toLowerCase().replace(/\s/g, '')}${counter}@import.local`;
          counter++;
        }
        record.email = email;
      }

      usedEmails.add(record.email);

      // Set defaults
      record.customer_type = 'private';
      record.status = 'active';
      record.mandate_status = 'pending';
      record.is_family_member = false;
      if (defaultOrgId) record.organization_id = defaultOrgId;

      records.push(record);
    }

    console.log(`[IMPORT] Parsed ${records.length} valid records`);

    // Insert in batches
    let successful = 0;
    let failed = 0;
    const failedRows = [];
    const batchSize = 5;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`[IMPORT] Processing batch ${Math.floor(i / batchSize) + 1}...`);

      const promises = batch.map(record =>
        base44.entities[entity_name].create(record)
          .then(result => {
            if (result?.id) {
              successful++;
              return true;
            }
            failed++;
            failedRows.push({ name: `${record.first_name} ${record.last_name}`, error: 'No ID' });
            return false;
          })
          .catch(e => {
            failed++;
            failedRows.push({ 
              name: `${record.first_name} ${record.last_name}`, 
              error: e.message?.substring(0, 60) || 'Error' 
            });
            return false;
          })
      );

      await Promise.all(promises);
      
      // Delay between batches
      if (i + batchSize < records.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[IMPORT] DONE: ${successful} OK, ${failed} failed`);

    return Response.json({
      status: 'success',
      summary: {
        total_rows_in_file: lines.length - 1,
        successfully_imported: successful,
        failed: failed,
        success_rate: records.length > 0 ? ((successful / records.length) * 100).toFixed(0) : 0
      },
      details: { failed_rows: failedRows.slice(0, 20) }
    });
    
  } catch (error) {
    console.error('[IMPORT] Fatal error:', error.message);
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
});