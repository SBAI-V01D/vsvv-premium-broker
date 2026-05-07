// Duplicate Prevention & Customer Matching
// Safely finds or creates customer records without duplication

export function matchCustomers(customers, searchTerm) {
  if (!searchTerm || !customers) return customers;
  const term = searchTerm.toLowerCase();
  return customers.filter(c => {
    const fullName = `${c.first_name || ''} ${c.last_name || ''} ${c.company_name || ''}`.toLowerCase();
    const email = (c.email || '').toLowerCase();
    return fullName.includes(term) || email.includes(term);
  });
}

export async function findOrCreateCustomer(extractedData, organizationId, base44) {
  if (!base44 || !extractedData) {
    throw new Error('Missing base44 SDK or extracted data');
  }

  // Import detection functions
  const { detectCustomerType, parseCompanyData, parsePrivateCustomerData, extractCommonData } = 
    await import('./customerTypeDetection.js');

  const customerType = detectCustomerType(extractedData);
  const commonData = extractCommonData(extractedData);
  
  // Build search criteria
  const searchCriteria = [];
  
  // Search by email (strongest match)
  if (commonData.email) {
    searchCriteria.push({ email: commonData.email.toLowerCase() });
  }
  
  // Search by name for private customers
  if (customerType === 'private') {
    const privData = parsePrivateCustomerData(extractedData);
    if (privData.first_name && privData.last_name) {
      searchCriteria.push({
        first_name: privData.first_name,
        last_name: privData.last_name
      });
    }
  } else {
    // Search by company name for business customers
    const compData = parseCompanyData(extractedData);
    if (compData.company_name) {
      searchCriteria.push({ company_name: compData.company_name });
    }
  }
  
  // Search by UID/CHE for business customers
  if (customerType === 'company') {
    const compData = parseCompanyData(extractedData);
    if (compData.uid_number) {
      searchCriteria.push({ uid_number: compData.uid_number });
    }
  }

  // Try to find existing customer
  for (const criteria of searchCriteria) {
    try {
      const existing = await base44.entities.Customer.filter(criteria, '-created_date', 1);
      if (existing && existing.length > 0) {
        console.log(`[CUSTOMER_MATCHER] Found existing customer by ${Object.keys(criteria)[0]}`);
        // Enrich existing customer with missing data
        await enrichCustomer(existing[0].id, extractedData, customerType, base44);
        return existing[0];
      }
    } catch (e) {
      console.warn(`[CUSTOMER_MATCHER] Search failed: ${e.message}`);
    }
  }

  // No existing customer found, create new one
  console.log(`[CUSTOMER_MATCHER] Creating new ${customerType} customer`);
  const newCustomerData = await buildCustomerData(extractedData, customerType, organizationId);
  
  try {
    const created = await base44.entities.Customer.create(newCustomerData);
    console.log(`[CUSTOMER_MATCHER] Created customer ${created.id}`);
    return created;
  } catch (e) {
    console.error(`[CUSTOMER_MATCHER] Creation failed: ${e.message}`);
    throw e;
  }
}

export async function enrichCustomer(customerId, extractedData, customerType, base44) {
  const { extractCommonData, parsePrivateCustomerData, parseCompanyData } = 
    await import('./customerTypeDetection.js');

  const commonData = extractCommonData(extractedData);
  const updateData = {};

  // Only add if not already set
  if (commonData.email && !updateData.email) updateData.email = commonData.email;
  if (commonData.phone && !updateData.phone) updateData.phone = commonData.phone;
  if (commonData.mobile && !updateData.mobile) updateData.mobile = commonData.mobile;
  if (commonData.street && !updateData.street) updateData.street = commonData.street;
  if (commonData.zip_code && !updateData.zip_code) updateData.zip_code = commonData.zip_code;
  if (commonData.city && !updateData.city) updateData.city = commonData.city;
  if (commonData.canton && !updateData.canton) updateData.canton = commonData.canton;

  if (customerType === 'private') {
    const privData = parsePrivateCustomerData(extractedData);
    if (privData.first_name && !updateData.first_name) updateData.first_name = privData.first_name;
    if (privData.last_name && !updateData.last_name) updateData.last_name = privData.last_name;
    if (privData.birthdate && !updateData.birthdate) updateData.birthdate = privData.birthdate;
    if (privData.profession && !updateData.profession) updateData.profession = privData.profession;
  } else {
    const compData = parseCompanyData(extractedData);
    if (compData.company_name && !updateData.company_name) updateData.company_name = compData.company_name;
    if (compData.legal_form && !updateData.legal_form) updateData.legal_form = compData.legal_form;
    if (compData.uid_number && !updateData.uid_number) updateData.uid_number = compData.uid_number;
    if (compData.industry && !updateData.industry) updateData.industry = compData.industry;
    if (compData.contact_person_firstname && !updateData.contact_person_firstname) updateData.contact_person_firstname = compData.contact_person_firstname;
    if (compData.contact_person_lastname && !updateData.contact_person_lastname) updateData.contact_person_lastname = compData.contact_person_lastname;
  }

  if (Object.keys(updateData).length > 0) {
    try {
      await base44.entities.Customer.update(customerId, updateData);
      console.log(`[CUSTOMER_MATCHER] Enriched customer ${customerId}`);
    } catch (e) {
      console.warn(`[CUSTOMER_MATCHER] Enrichment failed: ${e.message}`);
    }
  }
}

async function buildCustomerData(extractedData, customerType, organizationId) {
  const { parseCompanyData, parsePrivateCustomerData, extractCommonData } = 
    await import('./customerTypeDetection.js');

  const commonData = extractCommonData(extractedData);
  const baseData = {
    customer_type: customerType,
    status: 'active',
    mandate_status: 'pending',
    organization_id: organizationId,
    ...commonData,
  };

  if (customerType === 'private') {
    const privData = parsePrivateCustomerData(extractedData);
    return {
      ...baseData,
      first_name: privData.first_name || 'Unknown',
      last_name: privData.last_name || 'Unknown Customer',
      birthdate: privData.birthdate || '',
      profession: privData.profession || '',
    };
  } else {
    const compData = parseCompanyData(extractedData);
    return {
      ...baseData,
      company_name: compData.company_name || 'Unknown Company',
      legal_form: compData.legal_form || '',
      uid_number: compData.uid_number || '',
      industry: compData.industry || '',
      contact_person_firstname: compData.contact_person_firstname || '',
      contact_person_lastname: compData.contact_person_lastname || '',
      first_name: compData.contact_person_firstname || 'Company',
      last_name: compData.contact_person_lastname || compData.company_name || 'Account',
    };
  }
}