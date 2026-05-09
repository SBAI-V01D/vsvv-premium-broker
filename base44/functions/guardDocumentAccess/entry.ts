import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Guard document access - no public document links
 * Verify user authentication and role-based access
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({
        authorized: false,
        reason: 'Not authenticated',
        error: 'Login required to access documents'
      }, { status: 401 });
    }

    const body = await req.json();
    const { document_id, customer_id, required_role } = body;

    if (!document_id) {
      return Response.json({
        authorized: false,
        reason: 'Missing document_id'
      }, { status: 400 });
    }

    // Admin: full access
    if (user.role === 'admin') {
      return Response.json({
        authorized: true,
        reason: 'Admin access',
        user_role: user.role
      }, { status: 200 });
    }

    // Check document ownership / customer assignment
    try {
      const doc = await base44.entities.Document.filter({ id: document_id }, 1);
      
      if (!doc || doc.length === 0) {
        return Response.json({
          authorized: false,
          reason: 'Document not found'
        }, { status: 404 });
      }

      // Verify user is advisor for this customer
      if (customer_id) {
        const customer = await base44.entities.Customer.filter({ id: customer_id }, 1);
        if (customer && customer.length > 0 && customer[0].assigned_broker === user.email) {
          return Response.json({
            authorized: true,
            reason: 'Assigned advisor',
            user_role: user.role
          }, { status: 200 });
        }
      }

      return Response.json({
        authorized: false,
        reason: 'No access to this document'
      }, { status: 403 });

    } catch (err) {
      return Response.json({
        authorized: false,
        reason: 'Verification failed',
        error: err.message
      }, { status: 500 });
    }

  } catch (error) {
    return Response.json({
      authorized: false,
      error: error.message
    }, { status: 500 });
  }
});