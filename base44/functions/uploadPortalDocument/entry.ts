import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_base64, filename, customer_id, session_token, customer_name, category } = await req.json();

    if (!customer_id || !file_base64 || !filename) {
      return Response.json({ error: 'Fehlende Pflichtfelder' }, { status: 400 });
    }

    // ── SESSION VALIDATION ──────────────────────────────────────────
    if (!session_token) {
      return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const customer = await base44.asServiceRole.entities.Customer.get(customer_id);
    if (!customer) {
      return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    }

    if (!customer.portal_enabled && !customer.portal_access_enabled) {
      return Response.json({ error: 'Portal-Zugriff nicht aktiviert' }, { status: 403 });
    }

    // Validate session token
    const encoder = new TextEncoder();
    const sessionData = encoder.encode(customer_id + (customer.portal_password_hash || ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', sessionData);
    const expectedToken = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    if (session_token !== expectedToken) {
      return Response.json({ error: 'Ungültige Sitzung' }, { status: 401 });
    }

    // ── FILE VALIDATION ─────────────────────────────────────────────
    // Decode base64 and check size
    let bytes;
    try {
      const binaryString = atob(file_base64);
      if (binaryString.length > MAX_FILE_SIZE_BYTES) {
        return Response.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 });
      }
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } catch {
      return Response.json({ error: 'Ungültige Datei' }, { status: 400 });
    }

    // Check file extension as basic MIME guard
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return Response.json({ error: 'Dateityp nicht erlaubt. Erlaubt: PDF, JPG, PNG, DOC, DOCX' }, { status: 400 });
    }

    // ── UPLOAD & SAVE ────────────────────────────────────────────────
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: bytes });

    const doc = await base44.asServiceRole.entities.Document.create({
      customer_id,
      customer_name: customer_name || `${customer.first_name} ${customer.last_name}`,
      name: filename.replace(/\.[^.]+$/, ''),
      file_url,
      category: category || 'other',
      uploaded_by_role: 'customer',
      visible_in_portal: true,
    });

    return Response.json({ success: true, file_url, document: doc });
  } catch (error) {
    console.error('[uploadPortalDocument] ERROR:', error.message);
    return Response.json({ error: error.message || 'Fehler beim Hochladen' }, { status: 500 });
  }
});