// Normalize: lowercase, trim, replace umlauts
function normalize(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/à|á|â/g, 'a').replace(/è|é|ê/g, 'e').replace(/ì|í|î/g, 'i')
    .replace(/ò|ó|ô/g, 'o').replace(/ù|ú|û/g, 'u')
}

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

// Synonyms map
const SYNONYMS = {
  'kind': ['baby', 'kind', 'tochter', 'sohn', 'kleinkind'],
  'baby': ['baby', 'kind', 'kleinkind'],
  'firma': ['firma', 'unternehmen', 'gesellschaft', 'ag', 'gmbh'],
  'unternehmen': ['firma', 'unternehmen', 'gesellschaft'],
}

function expandSynonyms(token) {
  return SYNONYMS[token] || [token]
}

// Score a single customer against a list of tokens
function scoreCustomer(customer, tokens) {
  const firstName = normalize(customer.first_name)
  const lastName = normalize(customer.last_name)
  const companyName = normalize(customer.company_name)
  
  const fields = [
    firstName,
    lastName,
    companyName,
    normalize(customer.email),
    normalize(customer.phone),
    normalize(customer.mobile),
    normalize(customer.city),
    normalize(customer.zip_code),
    normalize(customer.profession),
    normalize(customer.notes),
    normalize(customer.family_role),
    normalize(customer.customer_number),
  ].filter(f => f)

  const fullText = fields.join(' ')

  let totalScore = 0

  for (const rawToken of tokens) {
    const token = normalize(rawToken)
    const synonyms = expandSynonyms(token)
    let tokenScore = 0

    for (const syn of synonyms) {
      // Exact match in any field (especially important for customer_number)
      if (fields.some(f => f === syn)) { tokenScore = Math.max(tokenScore, 100); break }
      // Customer number exact match (e.g., "K-500")
      if (customer.customer_number && normalize(customer.customer_number) === syn) { tokenScore = Math.max(tokenScore, 100); break }
      
      // Prioritize last_name and first_name exact matches
      if (lastName === syn) { tokenScore = Math.max(tokenScore, 95) }
      if (firstName === syn) { tokenScore = Math.max(tokenScore, 95) }
      if (companyName === syn) { tokenScore = Math.max(tokenScore, 95) }
      
      // Starts with (prioritize names)
      if (lastName && lastName.startsWith(syn)) { tokenScore = Math.max(tokenScore, 85) }
      if (firstName && firstName.startsWith(syn)) { tokenScore = Math.max(tokenScore, 85) }
      if (fields.some(f => f.startsWith(syn))) { tokenScore = Math.max(tokenScore, 80) }
      
      // Contains (substring)
      if (fullText.includes(syn)) { tokenScore = Math.max(tokenScore, 60) }
      
      // Fuzzy: check each word in fullText
      const words = fullText.split(/\s+/)
      for (const word of words) {
        if (word.length < 3) continue
        const dist = levenshtein(syn, word)
        const maxLen = Math.max(syn.length, word.length)
        const similarity = 1 - dist / maxLen
        if (similarity >= 0.75) tokenScore = Math.max(tokenScore, Math.round(similarity * 50))
      }
    }

    if (tokenScore === 0) return 0 // All tokens must match
    totalScore += tokenScore
  }

  return totalScore
}

export function searchCustomers(customers, query) {
  if (!query || query.trim() === '') return customers

  const tokens = query.trim().split(/\s+/).filter(t => t.length > 0)

  const scored = customers
    .map(c => ({ customer: c, score: scoreCustomer(c, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map(({ customer }) => customer)
}