import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

const SPARTEN_KEYWORDS = {
  kvg: {
    keywords: ['grundversicherung', 'krankenkasse', 'kvg', 'franchise', 'hausarztmodell', 'hmo', 'telmed', 'gesundheitsdeklaration', 'prämienbeitrag'],
    confidence: 0.9,
  },
  vvg_zusatz: {
    keywords: ['zusatzversicherung', 'vvg', 'zahnbehandlung', 'optometrie', 'komplementär', 'spitalzusatz'],
    confidence: 0.85,
  },
  hausrat: {
    keywords: ['haushaltsversicherung', 'hausrat', 'privathaftpflicht', 'feuer', 'diebstahl', 'wasser', 'einbruch', 'versicherungssumme', 'selbstbehalt'],
    confidence: 0.85,
  },
  motorfahrzeug: {
    keywords: ['motorfahrzeug', 'auto', 'fahrzeug', 'kfz', 'fahrzeugversicherung', 'haftpflicht auto', 'kaskoversicherung', 'fahrleistung'],
    confidence: 0.85,
  },
  leben: {
    keywords: ['lebensversicherung', 'risikoversicherung', 'kapitalversicherung', 'säule 3a', 'säule 3b', 'bvg', 'altersvorsorge'],
    confidence: 0.85,
  },
  gebaude_privat: {
    keywords: ['gebäudeversicherung', 'gebäude', 'hausversicherung', 'wohngebäude'],
    confidence: 0.80,
  },
  rechtsschutz: {
    keywords: ['rechtsschutzversicherung', 'rechtsschutz', 'rechtsanwalt', 'rechtshilfe'],
    confidence: 0.85,
  },
  unfall_privat: {
    keywords: ['unfallversicherung', 'unfall', 'invalidität', 'arbeitsunfallversicherung'],
    confidence: 0.80,
  },
}

export async function classifySparteFromDocumentText(textContent) {
  const normalizedText = textContent.toLowerCase()
  const scores = {}

  for (const [sparte, config] of Object.entries(SPARTEN_KEYWORDS)) {
    let hitCount = 0
    config.keywords.forEach(keyword => {
      if (normalizedText.includes(keyword)) {
        hitCount++
      }
    })
    if (hitCount > 0) {
      scores[sparte] = (hitCount / config.keywords.length) * config.confidence
    }
  }

  const sorted = Object.entries(scores).sort(([,a], [,b]) => b - a)
  if (sorted.length === 0) {
    return { sparte: null, confidence: 0 }
  }

  const [topSparte, topScore] = sorted[0]
  const isConfidentEnough = topScore > 0.5
  
  return {
    sparte: isConfidentEnough ? topSparte : null,
    confidence: topScore,
    allScores: Object.fromEntries(sorted),
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, extractedText } = await req.json()

    if (!extractedText) {
      return Response.json({ error: 'No extracted text provided' }, { status: 400 })
    }

    const result = await classifySparteFromDocumentText(extractedText)

    return Response.json({
      status: 'success',
      sparte: result.sparte,
      confidence: result.confidence,
      allScores: result.allScores,
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})