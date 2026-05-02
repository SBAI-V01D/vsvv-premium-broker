import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

// Deterministische Klassifizierung mit harten Regeln und Prioritäten
const CLASSIFICATION_RULES = [
  {
    priority: 1,
    name: 'REGEL 1 (HAUSHALT)',
    sparte: 'hausrat',
    keywords: ['haushaltsversicherung', 'hausrat', 'privathaftpflicht'],
    mode: 'any', // Matches if ANY keyword is found
    debug: true,
  },
  {
    priority: 2,
    name: 'REGEL 2 (KRANKENVERSICHERUNG)',
    sparte: 'kvg',
    keywords: ['franchise', 'grundversicherung', 'kvg', 'zusatzversicherung', 'hmo', 'telmed', 'hausarztmodell'],
    mode: 'any',
    debug: true,
  },
  {
    priority: 3,
    name: 'REGEL 3 (MOTORFAHRZEUG)',
    sparte: 'motorfahrzeug',
    keywords: ['motorfahrzeug', 'fahrzeugversicherung', 'kfz-versicherung', 'kaskoversicherung', 'fahrzeughaftpflicht'],
    mode: 'any',
    debug: true,
  },
  {
    priority: 4,
    name: 'REGEL 4 (LEBENSVERSICHERUNG)',
    sparte: 'leben_3a',
    keywords: ['lebensversicherung', 'säule 3a', 'säule 3b', 'bvg', 'altersvorsorge'],
    mode: 'any',
    debug: true,
  },
]

export async function classifySparteWithHardRules(textContent) {
  const normalizedText = textContent.toLowerCase()
  const matchedRules = []
  let detectedKeywords = []

  // Iteriere durch alle Regeln nach Priorität
  for (const rule of CLASSIFICATION_RULES) {
    const matchedKeywords = rule.keywords.filter(kw => normalizedText.includes(kw))
    
    if (matchedKeywords.length > 0) {
      matchedRules.push({
        rule: rule.name,
        sparte: rule.sparte,
        priority: rule.priority,
        matchedKeywords,
      })
      detectedKeywords.push(...matchedKeywords)

      // STOP bei erster Regel-Match (höchste Priorität)
      const topMatch = matchedRules[0]
      return {
        sparte: topMatch.sparte,
        confidence: 1.0,
        rule: topMatch.rule,
        matchedKeywords: topMatch.matchedKeywords,
        detectedKeywords: Array.from(new Set(detectedKeywords)),
        allMatchedRules: matchedRules,
        status: 'classified',
        debug: `Sparte erkannt: ${topMatch.sparte} (Regel: ${topMatch.rule}, Keywords: ${topMatch.matchedKeywords.join(', ')})`,
      }
    }
  }

  // FALLBACK: Keine Regel matched
  return {
    sparte: null,
    confidence: 0,
    rule: 'REGEL 3 (FALLBACK)',
    matchedKeywords: [],
    detectedKeywords: [],
    allMatchedRules: [],
    status: 'unclassified_requires_review',
    debug: 'Sparte konnte nicht automatisch erkannt werden – manuelle Prüfung erforderlich',
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { extractedText } = await req.json()

    if (!extractedText) {
      return Response.json({ error: 'No extracted text provided' }, { status: 400 })
    }

    const result = await classifySparteWithHardRules(extractedText)

    return Response.json({
      status: 'success',
      data: result,
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})