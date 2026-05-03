import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { customer_id, data } = await req.json();

    if (!customer_id) {
      return Response.json({ error: 'customer_id required' }, { status: 400 });
    }

    // Update customer record with provided data
    const updateData = {
      first_name: data.first_name,
      last_name: data.last_name,
      street: data.street,
      zip_code: data.zip_code,
      city: data.city,
      phone: data.phone,
      mobile: data.mobile,
    };

    await base44.asServiceRole.entities.Customer.update(customer_id, updateData);

    return Response.json({ success: true, message: 'Daten erfolgreich gespeichert' });
  } catch (error) {
    console.error('Error updating customer:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});