#!/usr/bin/env node
/**
 * Builds icons-pack.js — the editor's extra stroke icon pack (butchery, farm animals, food & drink,
 * shop & order) from Iconify JSON packages. Icons are normalised to a 24px grid.
 *
 *   npm i --no-save @iconify-json/tabler @iconify-json/hugeicons @iconify-json/icon-park-outline \
 *     @iconify-json/lucide-lab @iconify-json/tdesign @iconify-json/healthicons @iconify-json/ph
 *   node scripts/build-icon-pack.js [./node_modules]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'node_modules'));
const cache = {};
function set(s) { return cache[s] || (cache[s] = JSON.parse(fs.readFileSync(path.join(ROOT, '@iconify-json', s, 'icons.json'), 'utf8'))); }
function info(s) { return JSON.parse(fs.readFileSync(path.join(ROOT, '@iconify-json', s, 'info.json'), 'utf8')); }
function get(s, n) {
  const j = set(s); let ic = j.icons[n]; if (!ic && j.aliases && j.aliases[n]) ic = j.icons[j.aliases[n].parent];
  if (!ic) return null;
  const w = ic.width || j.width || 24, h = ic.height || j.height || 24, l = ic.left || 0, t = ic.top || 0;
  let b = ic.body;
  if (w !== 24 || h !== 24 || l || t) {
    const k = 24 / Math.max(w, h); const dx = (24 - w * k) / 2 - l * k, dy = (24 - h * k) / 2 - t * k;
    b = '<g transform="translate(' + (+dx.toFixed(3)) + ' ' + (+dy.toFixed(3)) + ') scale(' + (+k.toFixed(5)) + ')">' + b + '</g>';
  }
  return b;
}
const CATS={
 'Butchery':['meat','beef','steak','ham','bacon','sausage','drumstick','chicken-leg','chicken-thighs','bone','salami','knife','cleaver','kitchen-knife','chef','apron','scale','weight','cutting','grill','bbq','barbecue','roast','skewer','pepper'],
 'Farm animals':['cow','bull','pig','sheep','lamb','goat','chicken','hen','rooster','turkey','duck','goose','fish','rabbit','deer','horse','crab','shrimp','prawn','lobster','egg','barn','tractor','farm','fence','field','wheat','bee','dog','cat'],
 'Food & drink':['bread','croissant','baguette','pie','cake','cheese','pizza','burger','hotdog','sandwich','salad','soup','noodles','rice','carrot','onion','garlic','chili','tomato','potato','herb','lemon','apple','wine','beer','coffee','cup','bowl','pot','pan','oven','microwave','fork','spoon','whisk','spatula','chopsticks','cookie','ice-cream','milk','bottle','glass','bbq'],
 'Shop & order':['cart','basket','shopping','bag','store','shop','receipt','order','delivery','truck','package','gift','discount','coupon','checkout','courier','pickup','christmas','snowflake','menu-food','restaurant']
};
// Everyday words people search for → the icon names' words.
const SYN={cow:['beef','cattle','bull','steer'],bull:['beef','cattle','cow'],pig:['pork','hog','swine','bacon'],sheep:['lamb','mutton','ewe'],lamb:['sheep'],goat:['lamb'],
  chicken:['poultry','hen','chook'],hen:['chicken','poultry'],rooster:['chicken','poultry'],turkey:['poultry','christmas','roast'],duck:['poultry'],drumstick:['chicken','poultry','leg'],
  meat:['beef','steak','butcher'],steak:['beef','meat'],beef:['cow','steak','meat'],ham:['pork','christmas','leg'],sausage:['snag','pork','bbq'],bacon:['pork'],bone:['meat','dog'],
  knife:['butcher','cleaver','blade','cut'],cleaver:['butcher','knife'],cutting:['board','knife'],grill:['bbq','barbecue'],bbq:['grill','barbecue'],barbecue:['bbq','grill'],
  fish:['seafood'],shrimp:['prawn','seafood'],prawn:['shrimp','seafood'],crab:['seafood'],cart:['order','online','shop','buy','trolley'],basket:['order','shop','buy'],
  bag:['order','shopping','buy'],shopping:['order','buy','shop'],store:['shop'],shop:['store'],truck:['delivery'],delivery:['truck','shipping'],package:['parcel','box','delivery'],
  receipt:['order','invoice'],gift:['present','christmas','voucher'],snowflake:['christmas','winter','cold'],christmas:['xmas','festive'],tree:['christmas'],chef:['cook','kitchen'],
  apron:['butcher','cook'],scale:['weight','weigh','kg'],weight:['scale','kg'],pie:['bakery','pastry'],bread:['bakery'],cake:['bakery'],coffee:['cafe'],wine:['drink'],beer:['drink']};
const SETS={'tabler':'Tabler','hugeicons':'Hugeicons','icon-park-outline':'IconPark','lucide-lab':'Lucide Lab','tdesign':'TDesign','healthicons':'Healthicons','ph':'Phosphor'};
const BAD=/(^|-)(filled|fill|solid|bold|duotone|thin|light|negative|off|zodiac-off|square|circle-check|money)(-|$)/;
const out={icons:{},tags:{},cats:{}}; const seen=new Set();
for(const [cat,words] of Object.entries(CATS)){
  out.cats[cat]=[];
  for(const s of Object.keys(SETS)){
    const j=set(s); let names=Object.keys(j.icons);
    if(s==='healthicons') names=names.filter(n=>/-outline$/.test(n)&&/^(animal|food|ppe-apron|meat)/.test(n));
    if(s==='ph') names=names.filter(n=>!/-(bold|fill|duotone|thin|light)$/.test(n)&&/^(cow|knife|barn|fork-knife|horse|rabbit|shrimp|egg|fish|bone|tractor|cooking-pot|oven|bread|cheese|carrot|pepper|orange|hamburger|pizza|coffee|wine|beer-bottle|beer-stein|bowl-food|cake|cookie|shopping-cart|basket|storefront|truck|package|receipt|tag|gift|cow|bird|paw-print|dog|cat|grains|plant|leaf)$/.test(n));
    for(const n of names){
      if(BAD.test(n)) continue;
      if(/(brand|apple-(finder|intell|news|remind|stocks|vision)|git-|arrow|zoom|medic|pill|vaccine|blood|baby|flower|perfume|spray|dispens|saving|toot|bitcoin)/.test(n)) continue;
      if(s==='icon-park-outline'&&/^pie(-|$)/.test(n)) continue;
      if(cat==='Shop & order'&&(/-(bolt|cancel|code|cog|dollar|down|exclamation|heart|minus|pause|pin|question|search|share|star|up|x|remove|secure|view|sent|return|in|out|edit|euro|yen|yuan|rupee|pound|swiss|russian|turkish|japanese|indian|cent|refund|tax|bitcoin|add-\d+|ascending|descending|adjustment|list|export|import|movie|move|open|process|receive|plus|check|search|dimensions|delivered|sent|tracking|location|locati|manage|verified|electric|monster|return|02|03|04|05)($|-)/.test(n)||/(garbage|tanker|golf|lift|tow|container|semi|undertake|app-store|play-store|stop-loss|limit-order|market-order|flag|filter|pencil|location|navigation|map-|menu-order|safe-deliver|boxing|thermometer|travel|commodity|eye-discount|heart-discount|rv-truck|sending|express|mail)/.test(n))) continue;
      if(/(field|geo|resize|soccer|justice|3d|three-d|increase|fahrenheit|soil|rocking|toy|rubber|(^|-)cat($|-)|(^|-)dog($|-)|cat-big|custom|dropdown|body-weight|^roast$|cutting-one|^cutting$|dashboard|chart|game|sport|music|medal|award|trophy)/.test(n)) continue;
      const parts=n.split('-'); if(!words.some(w=>parts.includes(w)||n===w||n.startsWith(w+'-')||n.endsWith('-'+w))) continue;
      const key=('x-'+s+'-'+n).replace(/[^a-z0-9-]/g,'-');
      if(seen.has(key)){ continue; }
      const b=get(s,n); if(!b||b.length>6000||/<(?!\/?(path|circle|rect|line|polyline|polygon|ellipse|g)\b)[a-z]/i.test(b)||/\son[a-z]+\s*=|javascript:|href|style\s*=|url\(/i.test(b)) continue;
      seen.add(key); out.icons[key]=b; out.cats[cat].push(key);
      const base=parts.filter(p=>!/^\d+$/.test(p));
      const syn=[].concat(...base.map(p=>SYN[p]||[]));
      out.tags[key]=[...new Set(base.concat(syn,[cat.toLowerCase(),SETS[s].toLowerCase()],cat==='Butchery'?['butcher','butchery']:[]))];
    }
  }
}

console.log(Object.entries(out.cats).map(([k,v])=>k+':'+v.length).join(' '), 'total', Object.keys(out.icons).length, 'bytes', JSON.stringify(out.icons).length);

const credits = Object.keys(SETS).map((s) => { const i = info(s); return { set: s, name: i.name, author: i.author && i.author.name, url: i.author && i.author.url, license: i.license && i.license.spdx }; });
const head = '/* LeadPages icon pack (editor only): butchery, farm animals, food & drink, shop & order.\n' +
  ' * Generated by scripts/build-icon-pack.js — do not edit by hand.\n' +
  ' * Icons from: ' + credits.map((c) => c.name + ' (' + c.author + ', ' + c.license + ', ' + c.url + ')').join('; ') + '.\n' +
  ' * Each set keeps its own licence; see docs/features/Icons.md. */\n';
const js = head + '(function(){var P=' + JSON.stringify({ cats: out.cats, icons: out.icons, tags: out.tags, credits }) + ';' +
  'window.LP_ICON_PACK=P;var M=window.LP_ICONS_MORE=window.LP_ICONS_MORE||{};var T=window.LP_ICON_TAGS=window.LP_ICON_TAGS||{};' +
  'for(var k in P.icons){if(!M[k])M[k]=P.icons[k];T[k]=(T[k]||[]).concat(P.tags[k]||[]);}})();\n';
fs.writeFileSync(path.join(__dirname, '..', 'icons-pack.js'), js);
console.log(Object.entries(out.cats).map(([k, v]) => k + ':' + v.length).join(' '), 'total', Object.keys(out.icons).length, 'bytes', js.length);
