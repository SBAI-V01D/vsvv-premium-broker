/**
 * insurerLogos.js — Mapping Gesellschaftsname → Logo-URL
 * Verwendet öffentliche CDN-Logos der Schweizer Krankenversicherer.
 * Fallback: Initialen-Avatar wenn kein Logo gefunden.
 */

const INSURER_LOGOS = {
  // Groupe Mutuel Familie
  'groupe mutuel':     'https://www.groupemutuel.ch/content/dam/groupemutuel/images/logo-groupe-mutuel.png',
  'groupemutuel':      'https://www.groupemutuel.ch/content/dam/groupemutuel/images/logo-groupe-mutuel.png',

  // CSS
  'css':               'https://www.css.ch/dam/jcr:d7b1e70d-3b6f-4f42-a1b2-9f0f6c04f0e2/css-logo.svg',

  // Helsana
  'helsana':           'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Helsana_Logo.svg/1280px-Helsana_Logo.svg.png',

  // SWICA
  'swica':             'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/SWICA_Logo.svg/1280px-SWICA_Logo.svg.png',

  // Sanitas
  'sanitas':           'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Sanitas_Logo.svg/1280px-Sanitas_Logo.svg.png',

  // Concordia
  'concordia':         'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Concordia_Logo.svg/1280px-Concordia_Logo.svg.png',

  // KPT
  'kpt':               'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/KPT_Logo.svg/1280px-KPT_Logo.svg.png',

  // Visana
  'visana':            'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Visana_Logo.svg/1280px-Visana_Logo.svg.png',

  // Atupri
  'atupri':            'https://www.atupri.ch/assets/images/atupri-logo.svg',

  // EGK
  'egk':               'https://www.egk.ch/assets/images/logo.svg',

  // Assura
  'assura':            'https://www.assura.ch/assets/images/assura-logo.svg',

  // Mutuel Assurance / Philos
  'mutuel assurance':  'https://www.groupemutuel.ch/content/dam/groupemutuel/images/logo-groupe-mutuel.png',
  'philos':            'https://www.groupemutuel.ch/content/dam/groupemutuel/images/logo-groupe-mutuel.png',
  'mutuel':            'https://www.groupemutuel.ch/content/dam/groupemutuel/images/logo-groupe-mutuel.png',

  // Sympany
  'sympany':           'https://www.sympany.ch/assets/images/sympany-logo.svg',

  // Avenir
  'avenir':            'https://www.avenir.ch/assets/images/avenir-logo.svg',

  // Supra
  'supra':             'https://www.supra.ch/assets/images/supra-logo.svg',

  // Avanex (ehem. Nationale Suisse)
  'avanex':            'https://www.avanex.ch/assets/images/avanex-logo.svg',

  // Kolping
  'kolping':           'https://www.kolping.ch/assets/images/logo.svg',
};

/**
 * Sucht Logo-URL für einen Gesellschaftsnamen (case-insensitive, partial match).
 * @param {string} name - Gesellschaftsname
 * @returns {string|null} - URL oder null
 */
export function getInsurerLogo(name) {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  
  // Exakter Match
  if (INSURER_LOGOS[normalized]) return INSURER_LOGOS[normalized];
  
  // Partial Match (enthält Schlüsselwort)
  for (const [key, url] of Object.entries(INSURER_LOGOS)) {
    if (normalized.includes(key) || key.includes(normalized)) return url;
  }
  
  return null;
}

/**
 * Gibt Initialen für Fallback-Avatar zurück (max. 2 Zeichen)
 * @param {string} name
 * @returns {string}
 */
export function getInsurerInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}