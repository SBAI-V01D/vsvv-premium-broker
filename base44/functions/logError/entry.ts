import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const {
      error_type,
      entity_type,
      entity_id,
      error_message,
      stack_trace,
      function_name,
    } = await req.json();

    const errorLog = await base44.entities.ErrorLog.create({
      error_type,
      entity_type,
      entity_id,
      error_message,
      stack_trace,
      occurred_at: new Date().toISOString(),
      user_email: user?.email,
      function_name,
      status: 'new'
    });

    return Response.json({ success: true, log_id: errorLog.id });
  } catch (error) {
    console.error('Failed to log error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});