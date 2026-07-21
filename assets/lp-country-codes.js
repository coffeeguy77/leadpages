(function(global){
const COUNTRIES = [
  { code: 'af', name: 'Afghanistan' },
  { code: 'al', name: 'Albania' },
  { code: 'dz', name: 'Algeria' },
  { code: 'as', name: 'American Samoa' },
  { code: 'ad', name: 'Andorra' },
  { code: 'ao', name: 'Angola' },
  { code: 'ai', name: 'Anguilla' },
  { code: 'aq', name: 'Antarctica' },
  { code: 'ag', name: 'Antigua and Barbuda' },
  { code: 'ar', name: 'Argentina', aliases: ['argentine', 'argentinian'] },
  { code: 'am', name: 'Armenia' },
  { code: 'aw', name: 'Aruba' },
  { code: 'au', name: 'Australia', aliases: ['australian', 'aussie'] },
  { code: 'at', name: 'Austria', aliases: ['austrian'] },
  { code: 'az', name: 'Azerbaijan' },
  { code: 'bs', name: 'Bahamas' },
  { code: 'bh', name: 'Bahrain' },
  { code: 'bd', name: 'Bangladesh', aliases: ['bangladeshi'] },
  { code: 'bb', name: 'Barbados' },
  { code: 'by', name: 'Belarus' },
  { code: 'be', name: 'Belgium', aliases: ['belgian'] },
  { code: 'bz', name: 'Belize' },
  { code: 'bj', name: 'Benin' },
  { code: 'bm', name: 'Bermuda' },
  { code: 'bt', name: 'Bhutan' },
  { code: 'bo', name: 'Bolivia' },
  { code: 'ba', name: 'Bosnia and Herzegovina' },
  { code: 'bw', name: 'Botswana' },
  { code: 'br', name: 'Brazil', aliases: ['brazilian'] },
  { code: 'bn', name: 'Brunei' },
  { code: 'bg', name: 'Bulgaria', aliases: ['bulgarian'] },
  { code: 'bf', name: 'Burkina Faso' },
  { code: 'bi', name: 'Burundi' },
  { code: 'cv', name: 'Cabo Verde' },
  { code: 'kh', name: 'Cambodia' },
  { code: 'cm', name: 'Cameroon' },
  { code: 'ca', name: 'Canada', aliases: ['canadian'] },
  { code: 'ky', name: 'Cayman Islands' },
  { code: 'cf', name: 'Central African Republic' },
  { code: 'td', name: 'Chad' },
  { code: 'cl', name: 'Chile', aliases: ['chilean'] },
  { code: 'cn', name: 'China', aliases: ['chinese'] },
  { code: 'co', name: 'Colombia', aliases: ['colombian'] },
  { code: 'km', name: 'Comoros' },
  { code: 'cg', name: 'Congo' },
  { code: 'cd', name: 'Congo (DRC)' },
  { code: 'ck', name: 'Cook Islands' },
  { code: 'cr', name: 'Costa Rica' },
  { code: 'ci', name: 'Côte d’Ivoire', aliases: ['ivory coast', "cote d'ivoire"] },
  { code: 'hr', name: 'Croatia', aliases: ['croatian'] },
  { code: 'cu', name: 'Cuba', aliases: ['cuban'] },
  { code: 'cw', name: 'Curaçao' },
  { code: 'cy', name: 'Cyprus' },
  { code: 'cz', name: 'Czechia', aliases: ['czech republic', 'czech'] },
  { code: 'dk', name: 'Denmark', aliases: ['danish'] },
  { code: 'dj', name: 'Djibouti' },
  { code: 'dm', name: 'Dominica' },
  { code: 'do', name: 'Dominican Republic' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'eg', name: 'Egypt', aliases: ['egyptian'] },
  { code: 'sv', name: 'El Salvador' },
  { code: 'gq', name: 'Equatorial Guinea' },
  { code: 'er', name: 'Eritrea' },
  { code: 'ee', name: 'Estonia' },
  { code: 'sz', name: 'Eswatini', aliases: ['swaziland'] },
  { code: 'et', name: 'Ethiopia' },
  { code: 'fj', name: 'Fiji' },
  { code: 'fi', name: 'Finland', aliases: ['finnish'] },
  { code: 'fr', name: 'France', aliases: ['french'] },
  { code: 'gf', name: 'French Guiana' },
  { code: 'pf', name: 'French Polynesia' },
  { code: 'ga', name: 'Gabon' },
  { code: 'gm', name: 'Gambia' },
  { code: 'ge', name: 'Georgia' },
  { code: 'de', name: 'Germany', aliases: ['german'] },
  { code: 'gh', name: 'Ghana', aliases: ['ghanaian'] },
  { code: 'gi', name: 'Gibraltar' },
  { code: 'gr', name: 'Greece', aliases: ['greek'] },
  { code: 'gl', name: 'Greenland' },
  { code: 'gd', name: 'Grenada' },
  { code: 'gp', name: 'Guadeloupe' },
  { code: 'gu', name: 'Guam' },
  { code: 'gt', name: 'Guatemala' },
  { code: 'gg', name: 'Guernsey' },
  { code: 'gn', name: 'Guinea' },
  { code: 'gw', name: 'Guinea-Bissau' },
  { code: 'gy', name: 'Guyana' },
  { code: 'ht', name: 'Haiti' },
  { code: 'hn', name: 'Honduras' },
  { code: 'hk', name: 'Hong Kong' },
  { code: 'hu', name: 'Hungary', aliases: ['hungarian'] },
  { code: 'is', name: 'Iceland' },
  { code: 'in', name: 'India', aliases: ['indian'] },
  { code: 'id', name: 'Indonesia', aliases: ['indonesian'] },
  { code: 'ir', name: 'Iran', aliases: ['iranian'] },
  { code: 'iq', name: 'Iraq', aliases: ['iraqi'] },
  { code: 'ie', name: 'Ireland', aliases: ['irish'] },
  { code: 'im', name: 'Isle of Man' },
  { code: 'il', name: 'Israel', aliases: ['israeli'] },
  { code: 'it', name: 'Italy', aliases: ['italian'] },
  { code: 'jm', name: 'Jamaica', aliases: ['jamaican'] },
  { code: 'jp', name: 'Japan', aliases: ['japanese'] },
  { code: 'je', name: 'Jersey' },
  { code: 'jo', name: 'Jordan' },
  { code: 'kz', name: 'Kazakhstan' },
  { code: 'ke', name: 'Kenya', aliases: ['kenyan'] },
  { code: 'ki', name: 'Kiribati' },
  { code: 'kp', name: 'North Korea' },
  { code: 'kr', name: 'South Korea', aliases: ['korea', 'korean'] },
  { code: 'kw', name: 'Kuwait' },
  { code: 'kg', name: 'Kyrgyzstan' },
  { code: 'la', name: 'Laos' },
  { code: 'lv', name: 'Latvia' },
  { code: 'lb', name: 'Lebanon' },
  { code: 'ls', name: 'Lesotho' },
  { code: 'lr', name: 'Liberia' },
  { code: 'ly', name: 'Libya' },
  { code: 'li', name: 'Liechtenstein' },
  { code: 'lt', name: 'Lithuania' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'mo', name: 'Macao' },
  { code: 'mg', name: 'Madagascar' },
  { code: 'mw', name: 'Malawi' },
  { code: 'my', name: 'Malaysia', aliases: ['malaysian'] },
  { code: 'mv', name: 'Maldives' },
  { code: 'ml', name: 'Mali' },
  { code: 'mt', name: 'Malta' },
  { code: 'mh', name: 'Marshall Islands' },
  { code: 'mq', name: 'Martinique' },
  { code: 'mr', name: 'Mauritania' },
  { code: 'mu', name: 'Mauritius' },
  { code: 'yt', name: 'Mayotte' },
  { code: 'mx', name: 'Mexico', aliases: ['mexican'] },
  { code: 'fm', name: 'Micronesia' },
  { code: 'md', name: 'Moldova' },
  { code: 'mc', name: 'Monaco' },
  { code: 'mn', name: 'Mongolia' },
  { code: 'me', name: 'Montenegro' },
  { code: 'ms', name: 'Montserrat' },
  { code: 'ma', name: 'Morocco', aliases: ['moroccan'] },
  { code: 'mz', name: 'Mozambique' },
  { code: 'mm', name: 'Myanmar', aliases: ['burma'] },
  { code: 'na', name: 'Namibia' },
  { code: 'nr', name: 'Nauru' },
  { code: 'np', name: 'Nepal' },
  { code: 'nl', name: 'Netherlands', aliases: ['dutch', 'holland'] },
  { code: 'nc', name: 'New Caledonia' },
  { code: 'nz', name: 'New Zealand', aliases: ['kiwi'] },
  { code: 'ni', name: 'Nicaragua' },
  { code: 'ne', name: 'Niger' },
  { code: 'ng', name: 'Nigeria', aliases: ['nigerian'] },
  { code: 'nu', name: 'Niue' },
  { code: 'nf', name: 'Norfolk Island' },
  { code: 'mk', name: 'North Macedonia' },
  { code: 'mp', name: 'Northern Mariana Islands' },
  { code: 'no', name: 'Norway', aliases: ['norwegian'] },
  { code: 'om', name: 'Oman' },
  { code: 'pk', name: 'Pakistan', aliases: ['pakistani'] },
  { code: 'pw', name: 'Palau' },
  { code: 'ps', name: 'Palestine' },
  { code: 'pa', name: 'Panama' },
  { code: 'pg', name: 'Papua New Guinea' },
  { code: 'py', name: 'Paraguay' },
  { code: 'pe', name: 'Peru', aliases: ['peruvian'] },
  { code: 'ph', name: 'Philippines', aliases: ['filipino', 'philippine'] },
  { code: 'pl', name: 'Poland', aliases: ['polish'] },
  { code: 'pt', name: 'Portugal', aliases: ['portuguese'] },
  { code: 'pr', name: 'Puerto Rico' },
  { code: 'qa', name: 'Qatar' },
  { code: 're', name: 'Réunion' },
  { code: 'ro', name: 'Romania', aliases: ['romanian'] },
  { code: 'ru', name: 'Russia', aliases: ['russian'] },
  { code: 'rw', name: 'Rwanda' },
  { code: 'ws', name: 'Samoa' },
  { code: 'sm', name: 'San Marino' },
  { code: 'st', name: 'Sao Tome and Principe' },
  { code: 'sa', name: 'Saudi Arabia', aliases: ['saudi'] },
  { code: 'sn', name: 'Senegal' },
  { code: 'rs', name: 'Serbia', aliases: ['serbian'] },
  { code: 'sc', name: 'Seychelles' },
  { code: 'sl', name: 'Sierra Leone' },
  { code: 'sg', name: 'Singapore', aliases: ['singaporean'] },
  { code: 'sx', name: 'Sint Maarten' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'si', name: 'Slovenia' },
  { code: 'sb', name: 'Solomon Islands' },
  { code: 'so', name: 'Somalia' },
  { code: 'za', name: 'South Africa', aliases: ['south african'] },
  { code: 'ss', name: 'South Sudan' },
  { code: 'es', name: 'Spain', aliases: ['spanish'] },
  { code: 'lk', name: 'Sri Lanka' },
  { code: 'sd', name: 'Sudan' },
  { code: 'sr', name: 'Suriname' },
  { code: 'se', name: 'Sweden', aliases: ['swedish'] },
  { code: 'ch', name: 'Switzerland', aliases: ['swiss'] },
  { code: 'sy', name: 'Syria', aliases: ['syrian'] },
  { code: 'tw', name: 'Taiwan', aliases: ['taiwanese'] },
  { code: 'tj', name: 'Tajikistan' },
  { code: 'tz', name: 'Tanzania' },
  { code: 'th', name: 'Thailand', aliases: ['thai'] },
  { code: 'tl', name: 'Timor-Leste' },
  { code: 'tg', name: 'Togo' },
  { code: 'tk', name: 'Tokelau' },
  { code: 'to', name: 'Tonga' },
  { code: 'tt', name: 'Trinidad and Tobago' },
  { code: 'tn', name: 'Tunisia' },
  { code: 'tr', name: 'Turkey', aliases: ['turkish', 'turkiye'] },
  { code: 'tm', name: 'Turkmenistan' },
  { code: 'tc', name: 'Turks and Caicos Islands' },
  { code: 'tv', name: 'Tuvalu' },
  { code: 'ug', name: 'Uganda' },
  { code: 'ua', name: 'Ukraine', aliases: ['ukrainian'] },
  { code: 'ae', name: 'United Arab Emirates', aliases: ['uae', 'emirati'] },
  { code: 'gb', name: 'United Kingdom', aliases: ['uk', 'britain', 'british', 'england', 'english', 'scotland', 'wales'] },
  { code: 'us', name: 'United States', aliases: ['usa', 'america', 'american'] },
  { code: 'uy', name: 'Uruguay' },
  { code: 'uz', name: 'Uzbekistan' },
  { code: 'vu', name: 'Vanuatu' },
  { code: 've', name: 'Venezuela' },
  { code: 'vn', name: 'Vietnam', aliases: ['vietnamese'] },
  { code: 'vg', name: 'British Virgin Islands' },
  { code: 'vi', name: 'U.S. Virgin Islands' },
  { code: 'wf', name: 'Wallis and Futuna' },
  { code: 'eh', name: 'Western Sahara' },
  { code: 'ye', name: 'Yemen' },
  { code: 'zm', name: 'Zambia' },
  { code: 'zw', name: 'Zimbabwe' }
];

function norm(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/’/g, "'");
}

function countryHaystack(c) {
  return [c.code, c.name].concat(c.aliases || []).map(norm);
}

/**
 * Resolve free text to an ISO alpha-2 code (lowercase), or '' if unknown.
 * Accepts codes ("au"), names ("Australia"), and common demonyms ("Indian").
 */
function resolveCountryCode(input) {
  const q = norm(input);
  if (!q) return '';
  let i;
  // Exact code / name / alias match first (so "uk" → gb, not a fake ISO code)
  for (i = 0; i < COUNTRIES.length; i++) {
    const parts = countryHaystack(COUNTRIES[i]);
    if (parts.indexOf(q) >= 0) return COUNTRIES[i].code;
  }
  if (/^[a-z]{2}$/.test(q)) return q; // allow uncommon codes typed directly
  for (i = 0; i < COUNTRIES.length; i++) {
    const parts = countryHaystack(COUNTRIES[i]);
    if (parts.some(function (p) { return p.startsWith(q); })) return COUNTRIES[i].code;
  }
  return '';
}

/**
 * Autocomplete search — returns up to `limit` matches for a typed query.
 */
function searchCountries(query, limit) {
  const q = norm(query);
  const max = Math.max(1, Math.min(20, parseInt(limit, 10) || 8));
  if (!q) return COUNTRIES.slice(0, max).map(function (c) {
    return { code: c.code, name: c.name };
  });
  const scored = [];
  for (let i = 0; i < COUNTRIES.length; i++) {
    const c = COUNTRIES[i];
    const parts = countryHaystack(c);
    let score = 0;
    if (c.code === q) score = 100;
    else if (parts.indexOf(q) >= 0) score = 90;
    else if (parts.some(function (p) { return p.startsWith(q); })) score = 70;
    else if (parts.some(function (p) { return p.indexOf(q) >= 0; })) score = 40;
    if (score) scored.push({ score: score, code: c.code, name: c.name });
  }
  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });
  return scored.slice(0, max).map(function (x) {
    return { code: x.code, name: x.name };
  });
}

function countryLabel(code) {
  const c = String(code || '').trim().toLowerCase();
  for (let i = 0; i < COUNTRIES.length; i++) {
    if (COUNTRIES[i].code === c) return COUNTRIES[i].name + ' — ' + c.toUpperCase();
  }
  return c ? c.toUpperCase() : '';
}

global.LPCountryCodes = {
  COUNTRIES,
  resolveCountryCode,
  searchCountries,
  countryLabel
};
})(typeof window !== "undefined" ? window : global);
