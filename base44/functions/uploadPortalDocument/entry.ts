import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { file_base64, filename, customer_id, customer_name, category } = await req.json();

    if (!file_base64 || !customer_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Convert base64 to Buffer for upload
    const buffer = Buffer.from(file_base64, 'base64');

    // Upload file
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: buffer
    });

    // Create document record
    const doc = await base44.asServiceRole.entities.Document.create({
      customer_id,
      customer_name,
      name: filename.replace(/\.[^.]+$/, ''),
      file_url,
      category,
      uploaded_by_role: 'customer',
      visible_in_portal: true,
    });

    return Response.json({ 
      success: true, 
      file_url,
      document: doc
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});