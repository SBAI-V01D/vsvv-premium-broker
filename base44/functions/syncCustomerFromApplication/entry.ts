import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Syncs customer data from application extraction
 * - Searches for existing customer (duplicate check)
 * - Updates if found
 * - Creates new if not found
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      first_name,
      last_name,
      email,
      phone,
      mobile,
      street,
      zip_code,
      city,
      canton,
      birthdate,
      ahv_number,
      nationality,
      organization_id,
    } = payload;

    // Validate required fields
    if (!first_name || !last_name) {
      return Response.json(
        { error: 'Missing required fields: first_name, last_name' },
        { status: 400 }
      );
    }

    // Fetch all customers for matching
    const allCustomers = await base44.entities.Customer.list(null, 1000);

    // Search for potential match
    const matchedCustomer = findCustomerMatch(allCustomers, {
      first_name,
      last_name,
      email,
      birthdate,
      street,
      zip_code,
    });

    let result;

    if (matchedCustomer) {
      // Customer exists - update with new data
      const updateData = buildUpdateData({
        first_name,
        last_name,
        email,
        phone,
        mobile,
        street,
        zip_code,
        city,
        canton,
        birthdate,
        ahv_number,
        nationality,
      });

      await base44.entities.Customer.update(matchedCustomer.id, updateData);

      result = {
        action: 'updated',
        customer_id: matchedCustomer.id,
        message: `Kunde aktualisiert: ${first_name} ${last_name}`,
      };
    } else {
      // New customer - create
      const newCustomer = await base44.entities.Customer.create({
        first_name,
        last_name,
        email,
        phone: phone || '',
        mobile: mobile || '',
        street: street || '',
        zip_code: zip_code || '',
        city: city || '',
        canton: canton || '',
        birthdate: birthdate || '',
        ahv_number: ahv_number || '',
        nationality: nationality || 'CH',
        organization_id: organization_id || '',
        status: 'prospect',
        customer_type: 'private',
        is_family_member: false,
      });

      result = {
        action: 'created',
        customer_id: newCustomer.id,
        message: `Neuer Kunde erstellt: ${first_name} ${last_name}`,
      };
    }

    return Response.json(result);
  } catch (error) {
    console.error('Error syncing customer:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Find customer match using name, email, birthdate, address
 */
function findCustomerMatch(customers, extractedData) {
  const {
    first_name: fname,
    last_name: lname,
    email: mail,
    birthdate: bday,
    street: str,
    zip_code: zip,
  } = extractedData;

  let bestMatch = null;
  let bestScore = 0;

  for (const customer of customers) {
    if (customer.is_family_member) continue; // Only match primary customers

    let score = 0;

    // Name match (strict - primary criteria)
    const nameMatch =
      normalizeString(customer.first_name) === normalizeString(fname) &&
      normalizeString(customer.last_name) === normalizeString(lname);

    if (!nameMatch) continue; // Name is mandatory

    score += 100; // Base score for name match

    // Email match
    if (customer.email && normalizeString(customer.email) === normalizeString(mail)) {
      score += 50;
    }

    // Birthdate match
    if (customer.birthdate === bday && bday) {
      score += 40;
    }

    // Address match
    if (
      customer.zip_code &&
      customer.zip_code === zip &&
      normalizeString(customer.street) === normalizeString(str)
    ) {
      score += 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = customer;
    }
  }

  // Return match only if score is sufficiently high (name match required)
  return bestScore >= 100 ? bestMatch : null;
}

/**
 * Build update data, only including non-empty values
 */
function buildUpdateData(data) {
  const update = {};

  for (const [key, value] of Object.entries(data)) {
    if (value && value.trim && value.trim() !== '') {
      update[key] = value;
    } else if (value && typeof value === 'string' && value !== '') {
      update[key] = value;
    }
  }

  return update;
}

/**
 * Normalize string for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}