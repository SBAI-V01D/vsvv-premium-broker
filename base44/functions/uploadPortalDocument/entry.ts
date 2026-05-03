import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const customer_id = formData.get('customer_id');
    const customer_name = formData.get('customer_name');
    const category = formData.get('category');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload file
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ 
      file 
    });

    // Create document record
    await base44.asServiceRole.entities.Document.create({
      customer_id,
      customer_name,
      name: file.name.replace(/\.[^.]+$/, ''),
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