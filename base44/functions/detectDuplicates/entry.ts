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
      const customers = await base44.entities.Customer.list();
      
      for (const existing of customers) {
        let confidence = 0;
        const matchedCriteria = [];
        
        // Email match
        if (email && existing.email === email) {
          confidence += 40;
          matchedCriteria.push('email');
        }
        
        // Phone match
        if (phone && existing.phone === phone) {
          confidence += 20;
          matchedCriteria.push('phone');
        }
        
        // Mobile match
        if (mobile && existing.mobile === mobile) {
          confidence += 20;
          matchedCriteria.push('mobile');
        }
        
        // Name + birthdate match
        if (first_name && last_name && birthdate && 
            existing.first_name === first_name && 
            existing.last_name === last_name && 
            existing.birthdate === birthdate) {
          confidence = 95;
          matchedCriteria.push('name_birthdate');
        }
        
        // Fuzzy name match
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
            matched_criteria: matchedCriteria
          });
        }
      }
    }
    
    if (duplicates.length > 0) {
      // Create duplicate alert
      await base44.entities.DuplicateAlert.create({
        entity_type,
        primary_entity_id: duplicates[0].existing_id,
        duplicate_entity_id: 'pending',
        match_criteria: duplicates[0].matched_criteria,
        confidence_score: duplicates[0].confidence,
        detected_at: new Date().toISOString(),
        detected_by: user.email,
        status: 'new'
      });
    }
    
    return Response.json({ duplicates, warning: duplicates.length > 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});