/**
 * Multi-stage customer matching with scoring.
 * Input: extracted form fields + full customers array
 * Output: { autoMatch, candidates, score }
 */

function normalize(str) {
  return (str || '').toLowerCase().trim()
}

function dateEqual(a, b) {
  if (!a || !b) return false
  return normalize(a).slice(0, 10) === normalize(b).slice(0, 10)
}

function scoreCustomer(c, f) {
  let score = 0

  const nameMatch =
    normalize(c.first_name) === normalize(f.first_name) &&
    normalize(c.last_name) === normalize(f.last_name)

  const birthdateMatch = dateEqual(c.birthdate, f.birthdate)
  const plzMatch = f.zip_code && normalize(c.zip_code) === normalize(f.zip_code)
  const emailMatch = f.email && normalize(c.email) === normalize(f.email)
  const phoneMatch = f.phone && (
    normalize(c.phone) === normalize(f.phone) ||
    normalize(c.mobile) === normalize(f.phone)
  )

  if (!nameMatch) return 0 // name is mandatory base

  score += 40 // name match baseline
  if (birthdateMatch) score += 20
  if (plzMatch) score += 20
  if (emailMatch) score += 10
  if (phoneMatch) score += 10

  return score
}

/**
 * Run matching across all customers.
 * @param {object} form - flat extracted form (first_name, last_name, birthdate, zip_code, email, phone)
 * @param {Array}  customers - full customer list
 * @returns {{ autoMatch: object|null, candidates: Array<{customer, score}>, topScore: number }}
 */
export function matchCustomers(form, customers) {
  if (!form.first_name || !form.last_name) {
    return { autoMatch: null, candidates: [], topScore: 0 }
  }

  const scored = customers
    .map(c => ({ customer: c, score: scoreCustomer(c, form) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const topScore = scored[0]?.score ?? 0

  return {
    autoMatch: topScore >= 90 ? scored[0].customer : null,
    candidates: scored,
    topScore,
  }
}