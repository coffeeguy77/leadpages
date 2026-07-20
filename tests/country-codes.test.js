/**
 * Country name → ISO code resolve + search for lead inbox blocks.
 */
const assert = require('assert');
const {
  resolveCountryCode,
  searchCountries,
  countryLabel
} = require('../lib/country-codes');
const { addBlock } = require('../lib/lead-blocklist');
const fs = require('fs');
const path = require('path');

assert.equal(resolveCountryCode('Australia'), 'au');
assert.equal(resolveCountryCode('australian'), 'au');
assert.equal(resolveCountryCode('AU'), 'au');
assert.equal(resolveCountryCode('Indian'), 'in');
assert.equal(resolveCountryCode('India'), 'in');
assert.equal(resolveCountryCode('United States'), 'us');
assert.equal(resolveCountryCode('USA'), 'us');
assert.equal(resolveCountryCode('United Kingdom'), 'gb');
assert.equal(resolveCountryCode('uk'), 'gb');
assert.ok(!resolveCountryCode('not-a-country'));

const hits = searchCountries('aust', 5);
assert.ok(hits.some(function (h) { return h.code === 'au'; }), 'Australia in aust search');
assert.ok(hits.some(function (h) { return h.code === 'at'; }), 'Austria in aust search');
assert.match(countryLabel('au'), /Australia/);

const inbox = addBlock({}, 'country', 'Australia');
assert.deepStrictEqual(inbox.blockedCountries, ['au']);
const inbox2 = addBlock(inbox, 'country', 'Indian');
assert.ok(inbox2.blockedCountries.indexOf('in') >= 0);

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
assert.ok(manage.includes('lp-country-codes.js'), 'manage loads country codes');
assert.ok(manage.includes('_dashLeadWireCountryAutocomplete'), 'autocomplete wired');
assert.ok(manage.includes('dash-block-country-suggest'), 'suggest list markup');

const themes = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-themes.css'), 'utf8');
assert.ok(themes.includes('flex-direction: column'), 'block add stacks field above button');
assert.ok(themes.includes('.dash-block-suggest'), 'suggest dropdown styles');

const asset = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-country-codes.js'), 'utf8');
assert.ok(asset.includes('LPCountryCodes'), 'browser asset exposes API');

console.log('country-codes.test.js: ok');
