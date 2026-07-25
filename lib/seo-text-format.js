'use strict';

/**
 * Format SEO Text supporting copy for on-page display.
 * Supports blank-line paragraphs, single newlines, ## / ### headings,
 * **bold**, and short title-like lines as H3.
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFmt(escaped) {
  return String(escaped || '').replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="seotxt-strong">$1</strong>'
  );
}

function looksLikeHeading(line) {
  var t = String(line || '').trim().replace(/:$/, '');
  if (!t || t.length > 72) return false;
  if (/[.!?]/.test(t)) return false;
  if (/^[-*•]/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  var words = t.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 10) return false;
  return true;
}

/**
 * @param {string} raw
 * @returns {string} safe HTML
 */
function formatSeoTextHtml(raw) {
  var text = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!text) return '';

  var blocks = text.split(/\n\s*\n/);
  var out = [];

  blocks.forEach(function (block) {
    var lines = String(block || '')
      .split('\n')
      .map(function (l) {
        return l.replace(/\s+$/g, '');
      });
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) return;

    // Entire block is a markdown / title heading — equal visual weight (seotxt-subh)
    if (lines.length === 1 && /^###?\s+/.test(lines[0].trim())) {
      out.push(
        '<h3 class="seotxt-subh">' +
          inlineFmt(esc(lines[0].trim().replace(/^###?\s+/, ''))) +
          '</h3>'
      );
      return;
    }

    // Single short title line → bold section heading
    if (lines.length === 1 && looksLikeHeading(lines[0]) && !/^##/.test(lines[0].trim())) {
      out.push(
        '<h3 class="seotxt-subh">' +
          inlineFmt(esc(lines[0].trim().replace(/:$/, ''))) +
          '</h3>'
      );
      return;
    }

    var htmlParts = [];
    var paraBuf = [];

    function flushPara() {
      if (!paraBuf.length) return;
      out.push(
        '<p class="seotxt-p">' + paraBuf.join('<br>\n') + '</p>'
      );
      paraBuf = [];
    }

    lines.forEach(function (line, i) {
      var t = line.trim();
      if (!t) {
        flushPara();
        return;
      }
      if (/^###?\s+/.test(t)) {
        flushPara();
        out.push(
          '<h3 class="seotxt-subh">' +
            inlineFmt(esc(t.replace(/^###?\s+/, ''))) +
            '</h3>'
        );
        return;
      }
      var next = (lines[i + 1] || '').trim();
      if (
        looksLikeHeading(t) &&
        next &&
        next.length > Math.min(40, t.length) &&
        !/^##/.test(next)
      ) {
        flushPara();
        out.push(
          '<h3 class="seotxt-subh">' +
            inlineFmt(esc(t.replace(/:$/, ''))) +
            '</h3>'
        );
        return;
      }
      paraBuf.push(inlineFmt(esc(t)));
    });
    flushPara();
  });

  return out.join('\n');
}

/** Browser-ready function source for trade shell applyCfg. */
function clientSource() {
  return (
    'function __lpFormatSeoText(raw){' +
    'function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}' +
    'function inlineFmt(e){return String(e||"").replace(/\\*\\*([^*]+)\\*\\*/g,"<strong class=\\"seotxt-strong\\">$1</strong>");}' +
    'function looksLikeHeading(line){var t=String(line||"").trim().replace(/:$/,"");if(!t||t.length>72)return false;if(/[.!?]/.test(t))return false;if(/^[-*•]/.test(t))return false;if(/^https?:\\/\\//i.test(t))return false;var w=t.split(/\\s+/).filter(Boolean);return w.length>=1&&w.length<=10;}' +
    'var text=String(raw||"").replace(/\\r\\n/g,"\\n").replace(/\\r/g,"\\n").trim();if(!text)return "";' +
    'var blocks=text.split(/\\n\\s*\\n/),out=[];' +
    'blocks.forEach(function(block){var lines=String(block||"").split("\\n").map(function(l){return l.replace(/\\s+$/g,"");});' +
    'while(lines.length&&!lines[0].trim())lines.shift();while(lines.length&&!lines[lines.length-1].trim())lines.pop();if(!lines.length)return;' +
    'if(lines.length===1&&/^###?\\s+/.test(lines[0].trim())){out.push("<h3 class=\\"seotxt-subh\\">"+inlineFmt(esc(lines[0].trim().replace(/^###?\\s+/,"")))+"</h3>");return;}' +
    'if(lines.length===1&&looksLikeHeading(lines[0])&&!/^##/.test(lines[0].trim())){out.push("<h3 class=\\"seotxt-subh\\">"+inlineFmt(esc(lines[0].trim().replace(/:$/,"")))+"</h3>");return;}' +
    'var paraBuf=[];function flushPara(){if(!paraBuf.length)return;out.push("<p class=\\"seotxt-p\\">"+paraBuf.join("<br>\\n")+"</p>");paraBuf=[];}' +
    'lines.forEach(function(line,i){var t=line.trim();if(!t){flushPara();return;}' +
    'if(/^###?\\s+/.test(t)){flushPara();out.push("<h3 class=\\"seotxt-subh\\">"+inlineFmt(esc(t.replace(/^###?\\s+/,"")))+"</h3>");return;}' +
    'var next=(lines[i+1]||"").trim();' +
    'if(looksLikeHeading(t)&&next&&next.length>Math.min(40,t.length)&&!/^##/.test(next)){flushPara();out.push("<h3 class=\\"seotxt-subh\\">"+inlineFmt(esc(t.replace(/:$/,"")))+"</h3>");return;}' +
    'paraBuf.push(inlineFmt(esc(t)));});flushPara();});' +
    'return out.join("\\n");}'
  );
}

module.exports = {
  formatSeoTextHtml,
  clientSource,
  looksLikeHeading,
  esc
};
