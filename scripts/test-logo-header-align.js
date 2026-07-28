'use strict';
/** Effective header logo position classes when phone CTA visibility changes. */
function logoBarClasses(opts){
  var position = opts.position || 'left';
  var headerOn = opts.headerOn !== false;
  var showPhone = opts.showPhone !== false;
  var navInHeader = !!opts.navInHeader;
  if(navInHeader) return [];
  var phoneOn = headerOn && showPhone;
  var ctaOn = headerOn;
  var posEff = phoneOn ? 'left' : ((position === 'center' || position === 'right') ? position : 'left');
  var cls = ['lp-logo-' + posEff];
  if(!ctaOn) cls.push('lp-logo-solo');
  return cls;
}

function assert(cond, msg){ if(!cond) throw new Error(msg); }

assert(logoBarClasses({position:'left', showPhone:true}).join(' ') === 'lp-logo-left', 'phone on forces left');
assert(logoBarClasses({position:'center', showPhone:true}).join(' ') === 'lp-logo-left', 'phone on ignores center');
assert(logoBarClasses({position:'right', showPhone:true}).join(' ') === 'lp-logo-left', 'phone on ignores right');
assert(logoBarClasses({position:'left', showPhone:false}).join(' ') === 'lp-logo-left', 'phone off left');
assert(logoBarClasses({position:'center', showPhone:false}).join(' ') === 'lp-logo-center', 'phone off center');
assert(logoBarClasses({position:'right', showPhone:false}).join(' ') === 'lp-logo-right', 'phone off right');
assert(logoBarClasses({position:'center', showPhone:false, headerOn:false}).join(' ') === 'lp-logo-center lp-logo-solo', 'cta off solo center');
assert(logoBarClasses({position:'left', showPhone:false, headerOn:false}).join(' ') === 'lp-logo-left lp-logo-solo', 'cta off solo left');
assert(logoBarClasses({position:'right', navInHeader:true}).length === 0, 'nav in header skips');

// Source contains the runtime wiring
var fs = require('fs');
var path = require('path');
var js = fs.readFileSync(path.join(__dirname, '../marketplace/demos/demo-shared.js'), 'utf8');
assert(js.indexOf("lp-logo-'+_posEff") >= 0, 'runtime sets lp-logo class');
assert(js.indexOf('_phoneOn=(_Hd.on!==false&&_Hd.showPhone!==false)') >= 0, 'runtime reads showPhone');
assert(js.indexOf("marginLeft=((_lp==='right'") < 0, 'old margin-auto align removed');
var css = fs.readFileSync(path.join(__dirname, '../marketplace/demos/demo-shared.css'), 'utf8');
assert(css.indexOf('header.site .bar.lp-logo-center') >= 0, 'css has center rule');
console.log('test-logo-header-align: ok');
