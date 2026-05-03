import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customer_id, customer_name, file_base64, filename, category } = await req.json();

    // Convert base64 to Blob
    const binaryString = atob(file_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    
    // Upload file
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file: blob 
    });

    // Create document record
    await base44.asServiceRole.entities.Document.create({
      customer_id,
      customer_name,
      name: filename.replace(/\.[^.]+$/, ''),
      file_url,
      category,
      uploaded_by_role: 'customer',
      visible_in_portal: true,
    });

    return Response.json({ success: true, file_url });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});