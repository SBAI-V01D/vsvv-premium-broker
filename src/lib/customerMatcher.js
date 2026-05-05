/**
 * Multi-stage customer matching with scoring (0–100).
 *
 * Scoring spec:
 *   Name (Vorname + Nachname) exact match  → 40 pts  (required base)
 *   Geburtsdatum exact match               → +20 pts  (total 60)
 *   PLZ / Adresse match                    → +20 pts  (total 80)
 *   E-Mail OR Telefon match                → +20 pts  (total 100)
 *
 * Thresholds:
 *   ≥ 80  → auto-assign (high confidence)
 *   60–79 → auto-assign with review flag
 *   < 60  → no match → auto-create new customer
 */

function normalize(str) {
  return (str || '').toLowerCase().trim()
}

function dateEqual(a, b) {
  if (!a || !b) return false
  // Accept YYYY-MM-DD and DD.MM.YYYY
  const toISO = (s) => {
    const d = normalize(s).slice(0, 10)
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) {
      const [day, month, year] = d.split('.')
      return `${year}-${month}-${day}`
    }
    return d
  }
  return toISO(a) === toISO(b)
}

function scoreCustomer(c, f) {
  let score = 0

  // ── Firmenname-Matching (Priorität für business customers) ──────────────────
  if (f.company_name && c.company_name) {
    const companyMatch = normalize(c.company_name).includes(normalize(f.company_name)) ||
      normalize(f.company_name).includes(normalize(c.company_name))
    if (companyMatch) {
      score = 50 // company name baseline
      const plzMatch = f.zip_code && normalize(c.zip_code) === normalize(f.zip_code)
      const emailMatch = f.email && normalize(c.email) === normalize(f.email)
      const phoneMatch = f.phone && (
        normalize(c.phone) === normalize(f.phone) ||
        normalize(c.mobile) === normalize(f.phone)
      )
      if (plzMatch) score += 25
      if (emailMatch || phoneMatch) score += 25
      return score
    }
  }

  // ── Personen-Matching ───────────────────────────────────────────────────────
  const nameMatch =
    normalize(c.first_name) === normalize(f.first_name) &&
    normalize(c.last_name) === normalize(f.last_name)

  if (!nameMatch) return 0

  score = 40 // name baseline

  const birthdateMatch = dateEqual(c.birthdate, f.birthdate)
  const plzMatch = f.zip_code && normalize(c.zip_code) === normalize(f.zip_code)
  const emailMatch = f.email && normalize(c.email) === normalize(f.email)
  const phoneMatch = f.phone && (
    normalize(c.phone) === normalize(f.phone) ||
    normalize(c.mobile) === normalize(f.phone)
  )

  if (birthdateMatch) score += 20
  if (plzMatch) score += 20
  if (emailMatch || phoneMatch) score += 20

  return score
}

/**
 * Run matching across all customers.
 * @param {object} form      - flat extracted fields
 * @param {Array}  customers - full customer list (no pagination)
 * @returns {{ autoMatch, candidates, topScore }}
 */
export function matchCustomers(form, customers) {
  // Allow matching even with only company_name
  if (!form.first_name && !form.last_name && !form.company_name) {
    return { autoMatch: null, candidates: [], topScore: 0 }
  }

  const scored = customers
    .map(c => ({ customer: c, score: scoreCustomer(c, form) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const topScore = scored[0]?.score ?? 0

  return {
    autoMatch: topScore >= 80 ? scored[0].customer : null,
    candidates: scored,
    topScore,
  }
}