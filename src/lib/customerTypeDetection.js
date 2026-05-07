// Customer Type Detection Logic
// Determines if extracted data represents a PRIVATE or COMPANY customer

const COMPANY_INDICATORS = [
  'GmbH', 'AG', 'SA', 'SARL', 'Ltd', 'Inc', 'Corp', 'Corporation',
  'Company', 'LLC', 'Gesellschaft', 'Aktiengesellschaft', 'Limited',
  'Group', 'Trust', 'Fund', 'Association', 'Cooperative', 'eG',
  'OHG', 'KG', 'GbR', 'PartG', 'SL', 'SpA', 'SPA', 'NA', 'kft', 'Kft',
  'BV', 'NV', 'SE', 'CVBA', 'SCRL', 'SPRL', 'SARL'
];

export function detectCustomerType(extractedData) {
  if (!extractedData) return 'private';

  // Check company name field
  const companyName = extractedData.company_name || extractedData.kundenname || '';
  if (hasCompanyIndicator(companyName)) {
    return 'company';
  }

  // Check business identifiers (UID, CHE, etc)
  const uid = extractedData.uid_number || extractedData.che_number || extractedData.business_number || '';
  if (uid && uid.match(/CHE|UID|VAT|KVK|SIREN|SIRET|NIPT|EIN/i)) {
    return 'company';
  }

  // Check legal form
  const legalForm = extractedData.legal_form || '';
  if (hasCompanyIndicator(legalForm)) {
    return 'company';
  }

  // Check if we have corporate-level fields
  if (extractedData.industry || extractedData.contact_person_firstname || extractedData.legal_form) {
    return 'company';
  }

  return 'private';
}

export function hasCompanyIndicator(text) {
  if (!text) return false;
  const str = String(text).trim();
  return COMPANY_INDICATORS.some(indicator => 
    str.includes(indicator) || str.toUpperCase().includes(indicator)
  );
}

export function parseCompanyData(extractedData) {
  return {
    company_name: extractedData.company_name || extractedData.kundenname || '',
    legal_form: extractedData.legal_form || '',
    uid_number: extractedData.uid_number || extractedData.che_number || extractedData.business_number || '',
    industry: extractedData.industry || '',
    contact_person_firstname: extractedData.contact_person_firstname || extractedData.contact_firstname || '',
    contact_person_lastname: extractedData.contact_person_lastname || extractedData.contact_lastname || '',
  };
}

export function parsePrivateCustomerData(extractedData) {
  return {
    first_name: extractedData.first_name || extractedData.firstname || extractedData.vorname || '',
    last_name: extractedData.last_name || extractedData.lastname || extractedData.nachname || '',
    birthdate: extractedData.birthdate || extractedData.dob || '',
    profession: extractedData.profession || extractedData.beruf || '',
  };
}

export function extractCommonData(extractedData) {
  return {
    email: extractedData.email || extractedData.email_address || '',
    phone: extractedData.phone || extractedData.telefon || extractedData.phone_number || '',
    mobile: extractedData.mobile || extractedData.handy || extractedData.mobile_number || '',
    street: extractedData.street || extractedData.strasse || extractedData.address || '',
    zip_code: extractedData.zip_code || extractedData.plz || extractedData.postal_code || '',
    city: extractedData.city || extractedData.ort || extractedData.stadt || '',
    canton: extractedData.canton || extractedData.kanton || '',
    nationality: extractedData.nationality || extractedData.nationalitat || 'CH',
  };
}