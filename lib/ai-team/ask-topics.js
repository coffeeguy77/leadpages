'use strict';

/**
 * Popular Ask-the-Team topic pills.
 * Phase 1: every ask still runs through Atlas; `specialist` is the intended advisor
 * shown in chat + on the card (Scout / Nova / Pulse / Echo). Forge alone mutates config.
 */

const ASK_TOPICS = Object.freeze([
  {
    id: 'landing',
    label: 'Landing Page',
    specialist: 'atlas',
    specialistName: 'Atlas',
    specialistRole: 'Website Strategist',
    question: 'What would you like a landing page on?',
    placeholder: 'e.g. cold coffee options',
    hint: 'Builds one live suggestion card you can Answer, Discuss, or Draft in Forge.',
    prefix: 'landing page',
    outcome: 'plan_seo_landing',
    forgeable: true
  },
  {
    id: 'seo',
    label: 'SEO',
    specialist: 'scout',
    specialistName: 'Scout',
    specialistRole: 'SEO Specialist',
    question: 'What service or area should we target in search?',
    placeholder: 'e.g. coffee cart hire Canberra',
    hint: 'Atlas coordinates; Scout owns the SEO angle on the card.',
    prefix: 'seo',
    outcome: 'plan_seo_landing',
    forgeable: true
  },
  {
    id: 'cta',
    label: 'CTA',
    specialist: 'pulse',
    specialistName: 'Pulse',
    specialistRole: 'Conversion Specialist',
    question: 'What should the main button ask visitors to do?',
    placeholder: 'e.g. Get a free quote',
    hint: 'Locks a clear next step — then Forge can apply it when you draft.',
    prefix: 'cta',
    outcome: 'strengthen_primary_cta',
    forgeable: true
  },
  {
    id: 'quote',
    label: 'Quote Form',
    specialist: 'pulse',
    specialistName: 'Pulse',
    specialistRole: 'Conversion Specialist',
    question: 'What should people request when they contact you?',
    placeholder: 'e.g. a coffee cart quote for weddings',
    hint: 'Conversion-focused card. Forge quote-layout ops expand later — Discuss works now.',
    prefix: 'quote form',
    outcome: 'plan_quote_form',
    forgeable: false
  },
  {
    id: 'slider',
    label: 'Slider',
    specialist: 'nova',
    specialistName: 'Nova',
    specialistRole: 'Design Specialist',
    question: 'What should the hero slider showcase?',
    placeholder: 'e.g. wedding setups, corporate carts, iced drinks',
    hint: 'Design brief card with Nova. Atlas coordinates; Forge slider ops expand later.',
    prefix: 'slider',
    outcome: 'plan_hero_slider',
    forgeable: false
  },
  {
    id: 'faq',
    label: 'FAQ',
    specialist: 'echo',
    specialistName: 'Echo',
    specialistRole: 'Content Specialist',
    question: 'What objections do customers raise before they enquire?',
    placeholder: 'e.g. price, travel fees, weather backup',
    hint: 'Turns objections into an FAQ plan you can Draft in Forge.',
    prefix: 'faq',
    outcome: 'enable_faq_for_objections',
    forgeable: true
  },
  {
    id: 'services',
    label: 'Services',
    specialist: 'echo',
    specialistName: 'Echo',
    specialistRole: 'Content Specialist',
    question: 'What are the main services you sell?',
    placeholder: 'e.g. Weddings, Corporate, Private parties',
    hint: 'Saves as Site Knowledge truth — Echo can write public copy later.',
    prefix: 'services',
    outcome: 'expand_main_services',
    forgeable: false,
    knowledgeField: 'mainServices'
  }
]);

function cleanTopic(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAskTopic(id) {
  return ASK_TOPICS.find((t) => t.id === id) || null;
}

function listAskTopics() {
  return ASK_TOPICS.slice();
}

/**
 * Parse "landing page: cold coffee" / "seo: canberra coffee" style asks.
 */
function parseTopicAsk(requestText) {
  const t = cleanTopic(requestText);
  if (!t) return null;

  for (let i = 0; i < ASK_TOPICS.length; i++) {
    const topic = ASK_TOPICS[i];
    const re = new RegExp('^' + topic.prefix.replace(/\s+/g, '\\s*') + '\\s*[:\\-–]\\s*(.+)$', 'i');
    const m = t.match(re);
    if (m) {
      return {
        topic: topic,
        answer: cleanTopic(m[1]),
        requestText: t
      };
    }
  }

  // Natural landing phrasing still maps to landing topic
  if (/\blanding\s*pages?\b/i.test(t)) {
    const landing = getAskTopic('landing');
    const answer = cleanTopic(
      t
        .replace(/^(i need |we need |create |build |make |plan )?(a )?landing\s*pages?\s+(on|for|about)\s*[:\-–]?\s*/i, '')
        .replace(/^landing\s*pages?\s*[:\-–]\s*/i, '')
    );
    if (answer && answer.toLowerCase() !== t.toLowerCase()) {
      return { topic: landing, answer: answer, requestText: t };
    }
    if (/^landing\s*pages?\s*[:\-–]/i.test(t)) {
      return {
        topic: landing,
        answer: cleanTopic(t.replace(/^landing\s*pages?\s*[:\-–]\s*/i, '')),
        requestText: t
      };
    }
  }

  return null;
}

function composeTopicRequest(topicId, answer) {
  const topic = getAskTopic(topicId);
  if (!topic) return cleanTopic(answer);
  const a = cleanTopic(answer);
  if (!a) return '';
  return topic.prefix + ': ' + a;
}

function topicPromptSummary(parsed) {
  if (!parsed || !parsed.topic) return '';
  const a = cleanTopic(parsed.answer);
  if (!a) return parsed.topic.prefix;
  return (parsed.topic.prefix + ': ' + a).slice(0, 140);
}

module.exports = {
  ASK_TOPICS,
  getAskTopic,
  listAskTopics,
  parseTopicAsk,
  composeTopicRequest,
  topicPromptSummary
};
