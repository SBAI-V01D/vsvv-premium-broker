import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 100;
  let matches = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) matches++;
  }
  return Math.round((matches / Math.max(s1.length, s2.length)) * 100);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity_type, email, phone, mobile, policy_number, first_name, last_name, birthdate } = await req.json();

    const duplicates = [];

    if (entity_type === 'customer') {
      // Use targeted filters instead of full table scan
      let candidates = [];

      if (email) {
        const byEmail = await base44.entities.Customer.filter({ email }, '-created_date', 50);
        candidates.push(...byEmail);
      }

      if (first_name && last_name) {
        const byName = await base44.entities.Customer.filter({ first_name, last_name }, '-created_date', 50);
        byName.forEach(c => {
          if (!candidates.find(x => x.id === c.id)) candidates.push(c);
        });
      }

      // Deduplicate candidates by id
      const seen = new Set();
      candidates = candidates.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

      for (const existing of candidates) {
        let confidence = 0;
        const matchedCriteria = [];

        if (email && existing.email === email) { confidence += 40; matchedCriteria.push('email'); }
        if (phone && existing.phone === phone) { confidence += 20; matchedCriteria.push('phone'); }
        if (mobile && existing.mobile === mobile) { confidence += 20; matchedCriteria.push('mobile'); }

        if (first_name && last_name && birthdate &&
            existing.first_name === first_name &&
            existing.last_name === last_name &&
            existing.birthdate === birthdate) {
          confidence = 95;
          matchedCriteria.push('name_birthdate');
        }

        if (first_name && last_name && existing.first_name && existing.last_name) {
          const similarity = (calculateSimilarity(first_name, existing.first_name) +
                              calculateSimilarity(last_name, existing.last_name)) / 2;
          if (similarity > 80 && birthdate && existing.birthdate === birthdate) {
            confidence += 30;
            matchedCriteria.push('name_fuzzy');
          }
        }

        if (confidence > 0 && matchedCriteria.length > 0) {
          duplicates.push({
            existing_id: existing.id,
            existing_name: `${existing.first_name} ${existing.last_name}`,
            confidence: Math.min(100, confidence),
            matched_criteria: matchedCriteria,
          });
        }
      }
    }

    // Only create DuplicateAlert if we have a real new entity to compare against (not just a check)
    // Don't create alerts with 'pending' as duplicate_entity_id — skip alert creation here,
    // let the caller create the alert once the new entity is saved.

    return Response.json({ duplicates, warning: duplicates.length > 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});