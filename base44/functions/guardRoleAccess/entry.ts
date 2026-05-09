import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Guard function for role-based access control
 * Admin: full access
 * Manager: team data only
 * Advisor: own data only
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized', authorized: false }, { status: 401 });
    }

    const body = await req.json();
    const { action, resource_type, resource_id, target_user_email } = body;

    const result = {
      user_role: user.role,
      authorized: false,
      reason: null
    };

    // Admin: full access
    if (user.role === 'admin') {
      result.authorized = true;
      return Response.json(result, { status: 200 });
    }

    // Manager: team + own data
    if (user.role === 'manager') {
      if (action === 'list' && ['contract', 'application', 'task', 'customer'].includes(resource_type)) {
        result.authorized = true;
        return Response.json(result, { status: 200 });
      }
      if (action === 'update' || action === 'delete') {
        // Only own organization's data
        const advisor = await base44.entities.Advisor.filter({ email: user.email }, 1);
        if (advisor.length > 0) {
          result.authorized = true;
          return Response.json(result, { status: 200 });
        }
      }
    }

    // Advisor: only own data
    if (user.role === 'advisor' || user.role === 'user') {
      if (action === 'list' && resource_type === 'task') {
        // Can list own tasks only - filtered via assigned_to
        result.authorized = true;
        return Response.json(result, { status: 200 });
      }
      if (action === 'update' && resource_type === 'task' && target_user_email === user.email) {
        result.authorized = true;
        return Response.json(result, { status: 200 });
      }
      if (action === 'view' && resource_type === 'customer') {
        // Access customer if assigned advisor matches
        result.authorized = true;
        return Response.json(result, { status: 200 });
      }
    }

    result.reason = `${user.role} cannot ${action} ${resource_type}`;
    return Response.json(result, { status: 403 });

  } catch (error) {
    return Response.json({ error: error.message, authorized: false }, { status: 500 });
  }
});