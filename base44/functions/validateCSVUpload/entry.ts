import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Validate that a CSV file can be parsed safely
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'Missing file_url' }, { status: 400 });
    }

    // Fetch the file
    console.log(`[ValidateCSV] Validating: ${file_url}`);
    
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return Response.json({
        status: 'error',
        error: 'Datei konnte nicht heruntergeladen werden',
        details: `HTTP ${fileResponse.status}`
      }, { status: 400 });
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    console.log(`[ValidateCSV] File size: ${fileBuffer.byteLength} bytes`);

    // Check size
    if (fileBuffer.byteLength > 50 * 1024 * 1024) {
      return Response.json({
        status: 'error',
        error: `Datei zu groß (${(fileBuffer.byteLength / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB`,
        size: fileBuffer.byteLength
      });
    }

    // Detect encoding
    const uint8Array = new Uint8Array(fileBuffer);
    let encoding = 'UTF-8';
    let bom = false;

    if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
      encoding = 'UTF-8 BOM';
      bom = true;
    } else if ((uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) || 
               (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF)) {
      encoding = 'UTF-16';
    }

    // Decode file content
    let fileContent = new TextDecoder().decode(uint8Array);
    
    // Remove BOM if present
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    // Check if content is valid
    if (!fileContent || fileContent.trim().length === 0) {
      return Response.json({
        status: 'error',
        error: 'Datei ist leer oder konnte nicht gelesen werden'
      });
    }

    const lines = fileContent.split('\n').filter(l => l.trim());
    console.log(`[ValidateCSV] Lines detected: ${lines.length}`);

    if (lines.length < 2) {
      return Response.json({
        status: 'error',
        error: 'Datei hat keine Datenzeilen (nur Header vorhanden)'
      });
    }

    // Detect delimiter
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ',';
    if (semicolonCount > commaCount) delimiter = ';';
    if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';

    console.log(`[ValidateCSV] Delimiter detected: ${delimiter === ',' ? 'comma' : delimiter === ';' ? 'semicolon' : 'tab'}`);

    // Parse first line to get column count
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

    const headers = parseCSVLine(firstLine);
    console.log(`[ValidateCSV] Columns detected: ${headers.length}`);

    return Response.json({
      status: 'success',
      validation: {
        file_size: fileBuffer.byteLength,
        file_size_mb: (fileBuffer.byteLength / 1024 / 1024).toFixed(2),
        encoding,
        has_bom: bom,
        delimiter: delimiter === ',' ? 'comma' : delimiter === ';' ? 'semicolon' : 'tab',
        columns: headers.length,
        headers: headers.slice(0, 10), // First 10 headers
        data_rows: lines.length - 1,
        is_valid: true
      }
    });
  } catch (error) {
    console.error(`[ValidateCSV] Error: ${error.message}`);
    return Response.json({
      status: 'error',
      error: error.message,
      details: 'CSV-Datei konnte nicht validiert werden'
    }, { status: 500 });
  }
});