const express   = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI    = require('openai');
const axios     = require('axios');
const router    = express.Router();
const { TYPES }          = require('../lib/copywriter-types');
const { PROVIDERS }      = require('../lib/ai-providers');
const brandVoiceStore    = require('../lib/brand-voice-store');
const copyStore          = require('../lib/copy-store');

// Map provider id → config for fast lookup
const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));

// ── Provider streaming handlers ──────────────────────────────────────────────

async function streamAnthropic(apiKey, model, system, messages, res) {
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({ model, max_tokens: 4096, system, messages });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
    }
  }
}

async function streamOpenAICompat(apiKey, baseURL, model, system, messages, res) {
  const client = new OpenAI({ apiKey, baseURL });
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: system }, ...messages],
    stream: true,
    max_tokens: 4096,
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
  }
}

async function streamGemini(apiKey, model, system, messages, res) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const response = await axios.post(url, {
    contents,
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: { maxOutputTokens: 4096 },
  }, { responseType: 'stream' });

  await new Promise((resolve, reject) => {
    let buf = '';
    response.data.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch {}
      }
    });
    response.data.on('end', resolve);
    response.data.on('error', reject);
  });
}

async function streamCohere(apiKey, model, system, messages, res) {
  const chatHistory = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));
  const lastMsg = messages[messages.length - 1];
  const response = await axios.post('https://api.cohere.com/v1/chat', {
    message: lastMsg.content,
    model,
    preamble: system,
    chat_history: chatHistory,
    stream: true,
    max_tokens: 4096,
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    responseType: 'stream',
  });

  await new Promise((resolve, reject) => {
    let buf = '';
    response.data.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.event_type === 'text-generation' && parsed.text) {
            res.write(`data: ${JSON.stringify({ text: parsed.text })}\n\n`);
          }
        } catch {}
      }
    });
    response.data.on('end', resolve);
    response.data.on('error', reject);
  });
}

// ── Non-streaming AI call (used by analyze-voice) ────────────────────────────

async function callAI(providerCfg, apiKey, model, prompt, maxTokens = 600) {
  if (providerCfg.type === 'anthropic') {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model, max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    console.log(`[callAI] anthropic stop_reason=${msg.stop_reason} usage=${JSON.stringify(msg.usage)} content_blocks=${msg.content.length} types=${msg.content.map(b=>b.type).join(',')}`);
    const textBlock = msg.content.find(b => b.type === 'text');
    return textBlock?.text || '';
  }
  if (providerCfg.type === 'openai-compat') {
    const client = new OpenAI({ apiKey, baseURL: providerCfg.baseUrl });
    const res = await client.chat.completions.create({
      model, max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    console.log(`[callAI] openai finish_reason=${res.choices[0]?.finish_reason} usage=${JSON.stringify(res.usage)}`);
    return res.choices[0]?.message?.content || '';
  }
  if (providerCfg.type === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const { data } = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    });
    console.log(`[callAI] gemini finish_reason=${data.candidates?.[0]?.finishReason}`);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (providerCfg.type === 'cohere') {
    const { data } = await axios.post('https://api.cohere.com/v1/chat', {
      message: prompt, model, max_tokens: maxTokens,
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    return data.text || '';
  }
  return '';
}

// ── Template HTML mockup generator ───────────────────────────────────────────

// Distinct themes for AI mode — picked randomly per generation
const AI_DESIGN_THEMES = [
  { a:'#7C3AED', b:'#4C1D95', grad:'135deg,#8B5CF6,#5B21B6' },
  { a:'#D97706', b:'#92400E', grad:'135deg,#F59E0B,#B45309' },
  { a:'#0F766E', b:'#134E4A', grad:'135deg,#14B8A6,#0D9488' },
  { a:'#DC2626', b:'#7F1D1D', grad:'135deg,#EF4444,#B91C1C' },
  { a:'#2563EB', b:'#1E3A8A', grad:'135deg,#3B82F6,#1D4ED8' },
  { a:'#16A34A', b:'#14532D', grad:'135deg,#22C55E,#15803D' },
  { a:'#E11D48', b:'#881337', grad:'135deg,#FB7185,#E11D48' },
  { a:'#4F46E5', b:'#312E81', grad:'135deg,#6366F1,#4338CA' },
  { a:'#EA580C', b:'#7C2D12', grad:'135deg,#F97316,#C2410C' },
  { a:'#0369A1', b:'#0C4A6E', grad:'135deg,#38BDF8,#0284C7' },
];

function buildTemplateHTML(copy, type, aiThemeIdx) {
  const palettes = {
    'sales-page': { a:'#D97706', b:'#92400E', grad:'135deg,#F59E0B,#B45309' },
    webinar:      { a:'#7C3AED', b:'#4C1D95', grad:'135deg,#8B5CF6,#5B21B6' },
    email:        { a:'#2563EB', b:'#1E3A8A', grad:'135deg,#3B82F6,#1D4ED8' },
    social:       { a:'#0EA5E9', b:'#075985', grad:'135deg,#38BDF8,#0284C7' },
    ads:          { a:'#DC2626', b:'#7F1D1D', grad:'135deg,#EF4444,#B91C1C' },
    blog:         { a:'#059669', b:'#064E3B', grad:'135deg,#10B981,#047857' },
    general:      { a:'#6366F1', b:'#3730A3', grad:'135deg,#818CF8,#4F46E5' },
  };
  // aiThemeIdx overrides the type palette for AI-generated designs
  const p = (aiThemeIdx !== undefined ? AI_DESIGN_THEMES[aiThemeIdx % AI_DESIGN_THEMES.length] : null)
    || palettes[type] || palettes.general;

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Format for HTML output: escapes, converts markdown, strips stray * and []
  function fmt(s) {
    let t = String(s);
    t = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    t = t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g,'<em>$1</em>');
    t = t.replace(/\*/g,'');                        // remove stray asterisks
    t = t.replace(/\[([^\]]*)\]/g,'$1');            // [text] → text (remove brackets)
    return t.trim();
  }

  // Strip all markdown for plain text comparisons
  function strip(s) {
    return String(s)
      .replace(/\*\*/g,'').replace(/\*/g,'')
      .replace(/\[([^\]]*)\]/g,'$1')
      .replace(/^#+\s*/,'').trim();
  }

  // Is this line editorial junk that shouldn't appear in the design?
  function isJunk(line) {
    const raw = line.trim();
    // Strip markdown heading markers and italic/bold wrappers for plain-text matching
    const t = raw
      .replace(/^#{1,6}\s+/, '')              // ## Heading → Heading
      .replace(/^\*{1,3}([\s\S]*?)\*{1,3}$/, '$1') // ***bold italic*** / **bold** / *italic* → plain
      .replace(/\[([^\]]*)\]/g, '$1')          // [text] → text (closed brackets only)
      .replace(/^[\(\[]\s*/, '')               // strip leading ( or [
      .trim();

    if (!raw || raw === '---' || /^-{3,}$/.test(raw)) return true;

    // Editorial / instruction notes
    if (/^(note|quick note|editor.?s? note|important note)\s*[:\-]/i.test(t)) return true;
    if (/^note\s*[:\-]/i.test(t)) return true;
    // Bracket-enclosed notes (checked on raw since [ stripped from t)
    if (/^\[(note|insert|fill in?|add |replace|include|enter|put |write |on[\s-]?screen|cut to|visual|b[\s-]roll)/i.test(raw)) return true;

    // AI conversational preamble — framing sentences before actual content
    if (/^(smart move|great choice|perfect[,!]|excellent choice|absolutely[,!]|sure[,!]|of course[,!])/i.test(t)) return true;
    if (/^(here.s (your|the|a|everything|what you|my)|i.ve (created|written|put together|crafted|designed|built))/i.test(t)) return true;
    if (/^(below (is|you.?ll|you will)|let me (walk|take|give|break|show)|this (is|covers|includes|gives))/i.test(t)) return true;
    if (/^(what follows|following (is|are)|i.m (going to|about to|now)|here are your)/i.test(t)) return true;

    // Script / video metadata lines
    if (/^target (length|duration|time|runtime)\s*:/i.test(t)) return true;
    if (/^(format|style|delivery|production)\s*:\s*(talking[\s-]head|video|slideshow|b[\s-]roll|audio|script|voiceover)/i.test(t)) return true;
    if (/^(pacing|visual|on[\s-]?screen|slide|overlay|graphic)\s*(note|cue|direction|text)?\s*:/i.test(t)) return true;
    if (/\|\s*(talking[\s-]head|slideshow|b[\s-]roll|voiceover|video format)/i.test(t)) return true;

    // Stage directions — checked on t (markdown/brackets stripped, leading ( removed)
    if (/^(cut to|fade (in|out)|b[\s-]roll|visual\s*:|on[\s-]?screen|pause|beat|hold|close[\s-]up|camera|transition|scene\s*\d*)/i.test(t)) return true;
    if (/^(pause|beat|hold|cut|fade|transition)$/i.test(t)) return true;

    // Script segment labels: "SEGMENT", "SEGMENT 1:", "SEGMENT: Hook"
    if (/^segment\b/i.test(t)) return true;

    // Script title headings (works because # already stripped into t)
    if (/^(vsl|video sales letter|sales video|webinar)\s*(script|outline|template|framework)/i.test(t)) return true;

    // Lines describing the document itself (meta-commentary in any form)
    if (/\b(word[\s-]for[\s-]word script|structured for a|with pacing (and|notes)|visual notes built in|talking[\s-]head|b[\s-]roll|conversion machine|slideshow[\s-]style|production note)\b/i.test(t)) return true;

    // Unfilled template placeholders alone on a line: [Program Name], [Your Name]
    if (/^\[[\w\s]{3,40}\]$/.test(raw)) return true;

    return false;
  }

  // Is this short text a call-to-action phrase that should render as a button?
  function isCTA(text) {
    const t = String(text).trim();
    if (t.length > 160 || t.length < 4) return false;
    return /^(click (here|now|below|to )|get (started|instant|your|access|free)|grab (your|my|the)|claim (your|my|the)|join (now|us|today)|start (today|now|your)|try (it|now|free|risk)|order now|buy now|sign up|register now|yes[,!]?\s+i |unlock (your|access|the)|get (it|them) now|take (action|the next step)|find out (more|how)|learn more|see (how|results|why)|access now|download now|enroll now|don.t miss|act now)/i.test(t);
  }

  // ── Detect if copy is a script (VSL, video, etc.) rather than page copy ──────
  function detectIsScript(text) {
    const signals = [
      /^#?\s*(vsl|video sales letter|sales video|webinar)\s*(script|outline)/im,
      /\bsegment\s*\d+\b/im,
      /^\[on[\s-]?screen\b/im,
      /\*(visual|cut to|b[\s-]roll)[\s:]/im,
      /^target\s*(length|duration)\s*:/im,
      /\btalking[\s-]head\b/im,
      /\b(b[\s-]roll|slideshow[\s-]style|production note|voiceover)\b/im,
      /^\((pause|beat)\)/im,
    ];
    return signals.filter(re => re.test(text)).length >= 2;
  }
  const isScript = detectIsScript(copy);

  // ── Normalize copy: convert LABEL: content → ## content ────────────────────
  // AI-generated copy uses labeled sections (HEADLINE:, PROBLEM:, SOLUTION:, etc.)
  // that the parser won't detect as headings. Normalize them first.
  function normalizeCopy(text) {
    const LABELS = [
      'HEADLINE','SUBHEAD(?:LINE)?','LEAD','HOOK','OPENER',
      'PROBLEM','THE PROBLEM','PAIN POINTS?','AGITATE','CHALLENGE',
      'SOLUTION','THE SOLUTION','INTRODUCING','STORY','PROOF',
      'TESTIMONIALS?','SOCIAL PROOF','RESULTS?','WHAT CLIENTS? (?:SAY|SAID|ARE SAYING)',
      'BENEFITS?','WHAT YOU(?:.?LL)? GET',"WHAT.S INCLUDED",'INCLUDED','FEATURES?',
      'HOW IT WORKS?','STEPS?','THE STEPS?',
      'OFFER','THE OFFER','GUARANTEE','OUR GUARANTEE','RISK REVERSAL',
      'CLOSE','CLOSING','THE CLOSE','CTA','CALL TO ACTION','GET STARTED',
      'P\\.S\\.?','FAQ','BONUS(?:ES)?','PRICING','PRICE',
    ].join('|');
    const LABEL_WITH  = new RegExp(`^(?:\\d+\\.\\s*)?(${LABELS})\\s*:\\s*(.+)$`, 'i');
    const LABEL_ALONE = new RegExp(`^(?:\\d+\\.\\s*)?(${LABELS})\\s*:?\\s*$`, 'i');

    return text.split('\n').map(line => {
      const t = line.trim();
      if (!t) return line;
      // Downgrade ### and deeper to ## (only ## used for section breaks)
      if (/^#{3,6}\s/.test(t)) return `## ${t.replace(/^#{3,6}\s+/, '')}`;
      if (/^#{1,2}\s/.test(t) || /^\*\*[^*]+\*\*:?\s*$/.test(t)) return line;
      const wc = t.match(LABEL_WITH);
      if (wc) return `## ${wc[2]}`; // "PROBLEM: text" → "## text"
      if (t.match(LABEL_ALONE)) return '';  // bare "PROBLEM:" → drop
      return line;
    }).join('\n');
  }

  // ── Parse into flat blocks ────────────────────────────────────────────────
  const rawLines = normalizeCopy(copy).split('\n').map(l => l.trim()).filter(l => l && !isJunk(l));
  const blocks = [];
  let curB = [];
  for (const line of rawLines) {
    if (/^[-•*✓▸→✅☑]\s/.test(line)) {
      curB.push(strip(line.replace(/^[-•*✓▸→✅☑]\s+/, '')));
    } else {
      if (curB.length) { blocks.push({ t: 'ul', items: [...curB] }); curB = []; }
      if (/^#{1,6}\s/.test(line) || /^\*\*[^*]+\*\*:?\s*$/.test(line))
        blocks.push({ t: 'h', text: strip(line) });
      else
        blocks.push({ t: 'p', text: strip(line) });
    }
  }
  if (curB.length) blocks.push({ t: 'ul', items: curB });

  // ── Group into sections: heading + everything beneath it ─────────────────
  const sections = [];
  let secCur = null;
  for (const b of blocks) {
    if (b.t === 'h') {
      secCur = { heading: b.text, paras: [], bullets: [] };
      sections.push(secCur);
    } else {
      if (!secCur) { secCur = { heading: null, paras: [], bullets: [] }; sections.push(secCur); }
      if (b.t === 'ul') secCur.bullets.push(...b.items);
      else secCur.paras.push(b.text);
    }
  }
  if (sections.length === 0) sections.push({ heading: null, paras: ['Your content here.'], bullets: [] });

  // ── Classify each section ─────────────────────────────────────────────────
  function classifySec(sec) {
    const headLow = (sec.heading || '').toLowerCase().trim();
    const allText = (headLow + ' ' + sec.paras.join(' ') + ' ' + sec.bullets.join(' ')).toLowerCase();

    // Guarantee
    if (/guarantee|refund|money.back|money-back/.test(headLow)
        || (/guarantee|refund|money.back|money-back/.test(allText) && /\b\d+.day\b/.test(allText))) return 'guarantee';

    // PS
    if (/p\.s\.|^ps:/i.test(headLow) || /^p\.s\.\s/i.test(sec.paras[0] || '')) return 'ps';

    // Pricing / Investment / Value stack — by $ content OR by explicit heading
    if (/total.*value|today.s price|your (price|investment) today|you.*get.*for just|regular.*price.*today/i.test(allText)
        || /^(your )?investment$|^pricing$|^the offer$|^offer$|^total value$|^what (it |this )?(costs?|you.ll pay)$|^how much/i.test(headLow)) return 'pricing';

    // Proof
    if (/testimonial|client said|customer said|here.s what|what .* (say|said)|raving|reviews|social proof/i.test(headLow)
        || sec.paras.filter(pp => (pp.match(/"/g) || []).length >= 2 && pp.length > 30).length >= 1) return 'proof';

    // FAQ
    if (/^faq$|^frequently asked|^common questions|^you asked|^questions answered|^have questions|^your questions|^questions &|^questions and/i.test(headLow)) return 'faq';

    // Who this is for / not for
    if (/^(who (this is|it.s) (for|not for)|is (this|it) (for you|right for)|this (is|isn.t) for|perfect for|not (for you|a fit if)|for you if|ideal (for|client|student)|who should|this works for|who (will|can) benefit)/i.test(headLow)) return 'who';

    // Features / What You Get — BUT if content has multiple $ values it's a value stack → pricing
    const dollarMatches = allText.match(/value:\s*\$[\d,]+|\(\s*\$[\d,]+|\$[\d,]+\s*value/gi) || [];
    if (dollarMatches.length >= 2) return 'pricing';

    if (sec.bullets.length >= 2
        || /^(what you.?ll get|what you get|what.?s included|included|features?|benefits?|you.?ll (also )?get|bonuses?|everything you|here.?s what you|what (this )?includes?|the complete|complete package|what.?s inside|inside the program|inside the course|what.?s in it|in the program|step \d|how it works|the process|the system|the framework|the method|the approach)/i.test(headLow)) return 'features';

    // CTA — heading is a call to action OR section is short and contains action phrases
    if ((/get started|click here|buy now|order now|claim (your|now)|enroll|join now|sign up today|grab (your|now)|get (instant|access)|limited time|act now|ready to|don.t wait|take action|start today|yes[,!]|join us|join today|register now|i.m ready|let.s go|let.s do this|i want (in|this|access)/i.test(headLow)
        || /^(join|ready|yes[,!]?$|start (now|your|today)|take (the |action)|register|get (in|started)|sign up|secure your|lock in)/i.test(headLow))
        && allText.length < 900) return 'cta';

    return 'content';
  }

  // ── Parse a testimonial string: "quote" - Name, Role ──────────────────────
  function parseTestimonial(text) {
    const clean = text.replace(/^[“”"']+|[“”"']+$/g, '');
    const m = clean.match(/^(.+?)\s*[-—]+\s*([^,\n]+),\s*(.+)$/s);
    if (m) return { q: m[1].trim(), n: m[2].trim(), r: m[3].trim() };
    const m2 = clean.match(/^(.+?)\s*[-—]+\s*(.+)$/s);
    if (m2) return { q: m2[1].trim(), n: m2[2].trim(), r: 'Verified Client' };
    return { q: clean.trim(), n: 'Verified Client', r: 'Member' };
  }

  // ── Images ────────────────────────────────────────────────────────────────
  const splitImgs = [
    'https://picsum.photos/seed/fs2024/900/650',
    'https://picsum.photos/seed/fb2024/900/650',
    'https://picsum.photos/seed/fc2024/900/650',
  ];
  const avImgs = [
    'https://picsum.photos/seed/fa1_24/80/80',
    'https://picsum.photos/seed/fa2_24/80/80',
    'https://picsum.photos/seed/fa3_24/80/80',
  ];
  let splitIdx = 0;
  let avIdx = 0;
  let hasGuarantee = false;
  let hasCTA = false;
  let altBg = false;

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F8FAFC;color:#0F172A;line-height:1.7}
img{max-width:100%;display:block}
nav{position:sticky;top:0;z-index:200;background:#fff;border-bottom:1px solid #E2E8F0;padding:0 48px;height:64px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 8px rgba(0,0,0,.06)}
.nav-logo{font-size:1.2rem;font-weight:800;color:${p.a};letter-spacing:-.02em}
.nav-links{display:flex;gap:28px}
.nav-link{font-size:.875rem;color:#64748B;font-weight:500;text-decoration:none}
.nav-cta{background:${p.a};color:#fff;padding:10px 24px;border-radius:8px;font-size:.875rem;font-weight:700;border:none;cursor:pointer}
.hero{position:relative;min-height:620px;display:flex;align-items:center;background:url('https://picsum.photos/seed/fh2024/1600/900') center/cover no-repeat;padding:100px 48px}
.hero-ov{position:absolute;inset:0;background:linear-gradient(140deg,rgba(0,0,0,.55) 0%,${p.a}cc 100%)}
.hero-inner{position:relative;z-index:1;max-width:720px}
.eyebrow{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.95);font-size:.7rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;padding:5px 16px;border-radius:100px;margin-bottom:24px}
.hero h1{color:#fff;font-size:clamp(2.2rem,5vw,3.75rem);font-weight:900;line-height:1.1;letter-spacing:-.035em;text-shadow:0 3px 16px rgba(0,0,0,.35);margin-bottom:20px}
.hero-sub{color:rgba(255,255,255,.88);font-size:1.15rem;line-height:1.65;max-width:600px;margin-bottom:36px}
.hero-actions{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.hero-btn{background:#fff;color:${p.a};padding:17px 44px;border-radius:12px;font-size:1.05rem;font-weight:800;border:none;cursor:pointer;box-shadow:0 8px 32px rgba(0,0,0,.25);white-space:nowrap}
.hero-note{color:rgba(255,255,255,.7);font-size:.8rem}
.trust-bar{background:${p.a};padding:14px 48px}
.trust-inner{max-width:1040px;margin:0 auto;display:flex;justify-content:center;flex-wrap:wrap}
.trust-item{color:#fff;font-size:.8rem;font-weight:700;padding:4px 24px;border-right:1px solid rgba(255,255,255,.3)}
.trust-item:last-child{border:none}
.problem{background:#0F172A;padding:88px 48px}
.problem .si{max-width:900px;margin:0 auto}
.problem .sl{color:rgba(255,255,255,.5)}
.problem h2{color:#fff;font-size:clamp(1.8rem,3.5vw,2.6rem);font-weight:800;margin-bottom:20px;letter-spacing:-.025em}
.problem p{color:rgba(255,255,255,.7);font-size:1.05rem;max-width:700px;margin-bottom:32px}
.pain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.pain-card{background:#1E293B;border:1px solid #334155;border-left:4px solid #EF4444;border-radius:12px;padding:20px;color:rgba(255,255,255,.8);font-size:.9375rem;display:flex;align-items:flex-start;gap:12px;line-height:1.5}
.px{color:#EF4444;font-size:1.1rem;flex-shrink:0}
.section{padding:88px 48px;background:#F8FAFC}
.section.alt{background:#fff}
.si{max-width:1040px;margin:0 auto}
.sl{font-size:.7rem;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:${p.a};margin-bottom:10px}
.section h2{font-size:clamp(1.7rem,3.5vw,2.5rem);font-weight:800;line-height:1.2;letter-spacing:-.025em;margin-bottom:20px;color:#0F172A}
.section p{color:#475569;font-size:1rem;line-height:1.75;margin-bottom:16px}
.split{display:flex;gap:64px;align-items:center}
.split-img{flex:1;min-width:0}
.split-img img{width:100%;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.12)}
.split-copy{flex:1;min-width:0}
.checklist{list-style:none;display:flex;flex-direction:column;gap:12px;margin-top:24px}
.checklist li{display:flex;align-items:flex-start;gap:14px;font-size:1rem;color:#334155}
.checklist li::before{content:none}
.chk{width:26px;height:26px;background:${p.a};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:.78rem;font-weight:700;margin-top:1px}
.steps-row{display:flex;align-items:flex-start;margin-top:52px}
.step-card{flex:1;text-align:center;padding:0 24px}
.step-num{width:68px;height:68px;border-radius:50%;background:linear-gradient(${p.grad});color:#fff;font-size:1.1rem;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 24px ${p.a}44}
.step-card h3{font-size:1.1rem;font-weight:700;color:#0F172A;margin-bottom:10px}
.step-card p{color:#64748B;font-size:.9375rem;line-height:1.65}
.step-arrow{display:flex;align-items:flex-start;padding-top:26px;color:${p.a};font-size:1.75rem;flex-shrink:0}
.t-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-top:40px}
.t-card{background:#fff;border:1px solid #E2E8F0;border-radius:18px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.05);position:relative}
.t-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:${p.a};border-radius:4px 0 0 4px}
.t-stars{color:#F59E0B;font-size:1rem;letter-spacing:3px;margin-bottom:14px}
.t-quote{color:#334155;font-size:.9875rem;line-height:1.7;font-style:italic;margin-bottom:22px}
.t-author{display:flex;align-items:center;gap:14px}
.t-av{width:46px;height:46px;border-radius:50%;object-fit:cover;border:2.5px solid ${p.a}44}
.t-author strong{color:#0F172A;font-size:.9375rem}
.t-role{color:#94A3B8;font-size:.8rem}
.inc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;margin-top:40px}
.inc-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:16px;padding:28px 20px;text-align:center;transition:box-shadow .2s}
.inc-card:hover{box-shadow:0 8px 32px rgba(0,0,0,.08)}
.inc-icon{font-size:2rem;margin-bottom:14px}
.inc-card h4{font-size:.9rem;font-weight:700;color:#0F172A;line-height:1.4}
.gbox{background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:2px solid #86EFAC;border-radius:24px;padding:48px;display:flex;gap:32px;align-items:center;max-width:840px;margin:0 auto}
.g-badge{font-size:4rem;flex-shrink:0}
.g-text h3{font-size:1.5rem;font-weight:800;color:#15803D;margin-bottom:12px}
.g-text p{color:#166534;font-size:1rem;line-height:1.7;opacity:.85}
.g-seal{flex-shrink:0;width:96px;height:96px;border-radius:50%;border:5px solid #16A34A;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.2}
.g-seal span{font-size:.58rem;font-weight:900;color:#15803D;letter-spacing:.5px;text-transform:uppercase}
.g-seal .gd{font-size:1.6rem;font-weight:900;color:#15803D}
.cta-band{background:linear-gradient(${p.grad});padding:100px 48px;text-align:center;position:relative;overflow:hidden}
.cta-band::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 60% -30%,rgba(255,255,255,.15),transparent 60%)}
.cta-band h2{color:#fff;font-size:clamp(2rem,4.5vw,3rem);font-weight:900;letter-spacing:-.03em;margin-bottom:16px;position:relative}
.cta-band p{color:rgba(255,255,255,.82);font-size:1.1rem;max-width:580px;margin:0 auto 36px;position:relative}
.cta-big-btn{display:inline-block;background:#fff;color:${p.a};padding:20px 56px;border-radius:14px;font-size:1.15rem;font-weight:800;border:none;cursor:pointer;box-shadow:0 10px 40px rgba(0,0,0,.25);position:relative}
.cta-secure{color:rgba(255,255,255,.6);font-size:.8rem;margin-top:16px;position:relative}
.inline-cta{text-align:center;margin:28px 0}
.ps-box{background:#FFFBEB;border-left:4px solid ${p.a};border-radius:8px;padding:20px 24px;color:#78350F;font-size:.9375rem;line-height:1.75;max-width:780px;margin:0 auto}
.vs-box{border:2px solid #E2E8F0;border-radius:20px;overflow:hidden;background:#fff;max-width:680px;margin:0 auto}
.vs-row{display:flex;justify-content:space-between;align-items:center;padding:16px 28px;border-bottom:1px solid #F1F5F9;gap:16px}
.vs-label{font-size:.95rem;color:#334155;font-weight:500;flex:1}
.vs-val{font-size:.9rem;color:#94A3B8;white-space:nowrap;text-decoration:line-through}
.vs-divider{height:3px;background:linear-gradient(${p.grad})}
.vs-total{padding:16px 28px;font-size:1rem;font-weight:700;color:#0F172A;text-align:right;background:#F8FAFC}
.vs-price{padding:24px 28px;font-size:1.4rem;font-weight:900;color:#fff;text-align:center;background:linear-gradient(${p.grad})}
.faq-list{display:flex;flex-direction:column;gap:12px;margin-top:36px;max-width:780px;margin-left:auto;margin-right:auto}
.faq-item{background:#fff;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden}
.faq-q{padding:20px 24px;font-weight:700;color:#0F172A;font-size:.9875rem;border-left:4px solid ${p.a};cursor:default}
.faq-a{padding:0 24px 20px 28px;color:#64748B;font-size:.9375rem;line-height:1.7}
.feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:36px}
.feat-card{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:22px 24px;display:flex;gap:16px;align-items:flex-start;box-shadow:0 2px 10px rgba(0,0,0,.04);transition:box-shadow .2s}
.feat-card:hover{box-shadow:0 8px 28px rgba(0,0,0,.1)}
.feat-icon{width:44px;height:44px;background:linear-gradient(${p.grad});border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;flex-shrink:0;box-shadow:0 4px 12px ${p.a}44}
.feat-body p{color:#475569;font-size:.9375rem;line-height:1.65;margin:0}
.who-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:28px;max-width:820px;margin-left:auto;margin-right:auto}
.who-item{display:flex;align-items:flex-start;gap:12px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px 18px;font-size:.9375rem;color:#334155;line-height:1.5}
.who-icon-yes{width:22px;height:22px;border-radius:50%;background:#DCFCE7;color:#15803D;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:900;flex-shrink:0;margin-top:1px}
.who-icon-no{width:22px;height:22px;border-radius:50%;background:#FEE2E2;color:#B91C1C;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:900;flex-shrink:0;margin-top:1px}
.urgency-strip{background:#FFF7ED;border:1px solid #FED7AA;border-radius:14px;padding:16px 24px;display:flex;align-items:center;gap:14px;max-width:680px;margin:0 auto 28px}
.urgency-text{font-size:.9375rem;color:#9A3412;font-weight:700}
.cta-sub-text{color:rgba(255,255,255,.58);font-size:.78rem;margin-top:12px}
.offer-badge{display:inline-block;background:linear-gradient(${p.grad});color:#fff;font-size:.7rem;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:5px 16px;border-radius:100px;margin-bottom:20px}
.t-outcome{display:inline-block;background:${p.a}18;color:${p.a};font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:100px;margin-bottom:12px}
footer{background:#0F172A;padding:40px 48px;text-align:center;color:rgba(255,255,255,.4);font-size:.875rem;line-height:2}
footer strong{color:rgba(255,255,255,.7)}
@media(max-width:900px){
  nav{padding:0 20px}
  .hero{padding:72px 20px;min-height:auto}
  .section,.problem,.cta-band{padding:64px 20px}
  .split{flex-direction:column!important;gap:36px}
  .steps-row{flex-direction:column;align-items:center}
  .step-arrow{transform:rotate(90deg)}
  .gbox{flex-direction:column;padding:32px}
  .g-seal{display:none}
}
@media(max-width:600px){
  .nav-links{display:none}
  .hero h1{font-size:2rem}
  .hero-actions{flex-direction:column;align-items:flex-start}
  .inc-grid{grid-template-columns:1fr 1fr}
  .trust-item{padding:4px 12px}
}`.trim();

  // ── Expand: prevent hero from swallowing all copy ────────────────────────
  // If section[0] has more than 2 paras, pull the excess into new content sections
  // so they render as body sections instead of being silently dropped in the hero.
  if (sections.length > 0 && sections[0].paras.length > 2) {
    const hero = sections[0];
    const heroPars = hero.paras.slice(0, 2);
    const extra = hero.paras.slice(2);
    const extraSecs = [];
    for (let i = 0; i < extra.length; i += 3) {
      extraSecs.push({ heading: null, paras: extra.slice(i, i + 3), bullets: [] });
    }
    sections.splice(0, 1, { heading: hero.heading, paras: heroPars, bullets: hero.bullets }, ...extraSecs);
  }

  // ── Pre-merge orphan total/price heading-only sections into the nearest preceding value section ──
  for (let i = sections.length - 1; i >= 1; i--) {
    const sec = sections[i];
    const headLow = (sec.heading || '').toLowerCase().trim();
    const noBody = sec.paras.length === 0 && sec.bullets.length === 0;
    if (!noBody || !sec.heading) continue;
    const isTotal = /total.*(real\s*)?value|total.*worth/i.test(headLow);
    const isPrice = /today.s price|your (price|investment)|you.*pay|just \$|^only \$/i.test(headLow) || (/\$\d/.test(headLow) && headLow.length < 60);
    if (!isTotal && !isPrice) continue;
    // Find nearest preceding section that looks like a value/features section
    for (let j = i - 1; j >= 1; j--) {
      const k = classifySec(sections[j]);
      if (k === 'pricing' || k === 'features') {
        sections[j].paras.push(sec.heading); // absorb the orphan heading as a paragraph
        sections.splice(i, 1);
        break;
      }
    }
  }

  // ── Pre-collect ALL testimonials across every proof section (cap 3 total) ──
  const allProofQuotes = [];
  for (const sec of sections) {
    if (classifySec(sec) === 'proof') {
      const qs = [...sec.paras, ...sec.bullets].filter(t => t.length > 20 && !isCTA(t));
      for (const q of qs) {
        if (allProofQuotes.length < 3) allProofQuotes.push(q);
      }
    }
  }
  let proofRendered = false; // render the merged proof block only once

  // ── Assemble: render each section from the copy ───────────────────────────
  let bodyHtml = '';

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const kind = classifySec(sec);
    altBg = !altBg;

    // ── HERO (always the first section) ─────────────────────────────────────
    if (si === 0) {
      const headline = sec.heading || sec.paras[0] || 'Your Headline Here';
      // Sub: first non-CTA paragraph (skip if heading was used as headline, take first para)
      const bodyParas = sec.heading ? sec.paras : sec.paras.slice(1);
      const sub = bodyParas.find(pp => !isCTA(pp)) || '';
      // CTA button label: prefer an explicit CTA phrase from copy, else generic
      const ctaLabel = (sec.heading ? sec.paras : sec.paras.slice(2)).find(pp => isCTA(pp));
      bodyHtml += `
<section class="hero">
  <div class="hero-ov"></div>
  <div class="hero-inner">
    <div class="eyebrow">✦ Now Available</div>
    <h1>${fmt(headline)}</h1>
    ${sub ? `<p class="hero-sub">${fmt(sub)}</p>` : ''}
    <div class="hero-actions">
      <div>
        <button class="hero-btn">${ctaLabel ? fmt(ctaLabel) : 'Get Instant Access →'}</button>
        <div style="color:rgba(255,255,255,.5);font-size:.73rem;margin-top:8px;text-align:center">🔒 Secure · No Risk · Cancel Anytime</div>
      </div>
      <div>
        <div style="color:#F59E0B;font-size:1rem;letter-spacing:2px">★★★★★</div>
        <div style="color:rgba(255,255,255,.7);font-size:.8rem;margin-top:3px">Trusted by thousands worldwide</div>
      </div>
    </div>
  </div>
</section>
<div class="trust-bar">
  <div class="trust-inner">
    <span class="trust-item">⭐ 4.9/5 Rating</span>
    <span class="trust-item">👥 10,000+ Members</span>
    <span class="trust-item">🏆 Proven Results</span>
    <span class="trust-item">✅ 30-Day Guarantee</span>
    <span class="trust-item">🔒 Secure Checkout</span>
  </div>
</div>`;
      continue;
    }

    // ── GUARANTEE ────────────────────────────────────────────────────────────
    if (kind === 'guarantee') {
      hasGuarantee = true;
      const gHead = sec.heading || '100% Money-Back Guarantee';
      const gBody = sec.paras.filter(pp => !isCTA(pp)).join(' ') || 'Try it risk-free for 30 days. Not satisfied? Full refund — no questions asked.';
      bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    <div class="sl" style="text-align:center">Our Promise</div>
    <h2 style="text-align:center;margin-bottom:36px">${fmt(gHead)}</h2>
    <div class="gbox">
      <div class="g-badge">🛡️</div>
      <div class="g-text">
        <h3>100% Money-Back Guarantee</h3>
        <p>${fmt(gBody)}</p>
      </div>
      <div class="g-seal"><span>MONEY</span><span class="gd">30</span><span>DAY</span><span>BACK</span></div>
    </div>
  </div>
</section>`;
      continue;
    }

    // ── CTA BAND ─────────────────────────────────────────────────────────────
    if (kind === 'cta') {
      hasCTA = true;
      const ctaHead = sec.heading || 'Get Started Today';
      const ctaBtn = sec.paras.find(pp => isCTA(pp)) || sec.bullets.find(b => isCTA(b)) || 'Yes! I Want Instant Access';
      const ctaSupportParas = sec.paras.filter(pp => !isCTA(pp));
      bodyHtml += `
<section class="cta-band">
  <p style="color:rgba(255,255,255,.7);font-size:.8rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;position:relative">⏰ Limited Time Offer</p>
  <h2>${fmt(ctaHead)}</h2>
  ${ctaSupportParas.map(pp => `<p>${fmt(pp)}</p>`).join('')}
  <button class="cta-big-btn">${fmt(ctaBtn)} →</button>
  <div class="cta-sub-text">🔒 256-bit SSL · 30-Day Money-Back Guarantee · Cancel Anytime</div>
</section>`;
      continue;
    }

    // ── P.S. ─────────────────────────────────────────────────────────────────
    if (kind === 'ps') continue; // Skip PS sections — not needed in mockup

    // ── FEATURES (what you get / included / benefits / bullets) ─────────────
    if (kind === 'features') {
      const FEAT_ICONS = ['🎯','⚡','🔑','💡','🚀','🛡️','📈','💎','✅','🔥','⭐','🎁','📌','🧭','🏆'];
      const bodyParas2 = sec.paras.filter(pp => !isCTA(pp));
      const ctaInSection = sec.paras.find(pp => isCTA(pp)) || sec.bullets.find(b => isCTA(b));
      const cleanBullets = sec.bullets.filter(b => !isCTA(b));
      bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    <div class="sl" style="text-align:center">WHAT YOU'LL GET</div>
    ${sec.heading ? `<h2 style="text-align:center;margin-bottom:14px">${fmt(sec.heading)}</h2>` : ''}
    ${bodyParas2.map(pp => `<p style="text-align:center;max-width:640px;margin:0 auto 12px">${fmt(pp)}</p>`).join('')}
    ${cleanBullets.length ? `<div class="feat-grid">${cleanBullets.map((b, i) => `
    <div class="feat-card">
      <div class="feat-icon">${FEAT_ICONS[i % FEAT_ICONS.length]}</div>
      <div class="feat-body"><p>${fmt(b)}</p></div>
    </div>`).join('')}</div>` : ''}
    <div style="text-align:center;margin-top:40px">
      <button class="cta-big-btn" style="font-size:1rem;padding:16px 44px">${ctaInSection ? fmt(ctaInSection) + ' →' : 'Get Instant Access →'}</button>
      <div class="cta-sub-text">🔒 30-Day Money-Back Guarantee · No Risk</div>
    </div>
  </div>
</section>`;
      continue;
    }

    // ── PROOF (testimonials/social proof) ─────────────────────────────────────
    if (kind === 'proof') {
      // Skip if already rendered — all proof quotes are merged and shown once
      if (proofRendered) { continue; }
      proofRendered = true;
      const OUTCOMES = ['Life-Changing Results', 'Exceeded Expectations', 'Worth Every Penny'];
      const tCards = allProofQuotes.map((t, ti) => {
        const { q, n, r } = parseTestimonial(t);
        return `
<div class="t-card">
  <div class="t-outcome">${OUTCOMES[ti % OUTCOMES.length]}</div>
  <div class="t-stars">★★★★★</div>
  <p class="t-quote">"${fmt(q)}"</p>
  <div class="t-author">
    <img class="t-av" src="${avImgs[avIdx++ % 3]}" alt="${esc(n)}" />
    <div><strong>${fmt(n)}</strong><br><span class="t-role">${fmt(r)}</span></div>
  </div>
</div>`;
      }).join('');
      bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    <div class="sl" style="text-align:center">REAL RESULTS</div>
    <h2 style="text-align:center;margin-bottom:8px">What Our Members Are Saying</h2>
    <p style="text-align:center;color:#64748B;max-width:560px;margin:0 auto 40px">Real stories from real people who made the leap and never looked back.</p>
    <div class="t-grid">${tCards}</div>
  </div>
</section>`;
      continue;
    }

    // ── FAQ ───────────────────────────────────────────────────────────────────
    if (kind === 'faq') {
      // Pair paragraphs as alternating Q / A; bullets treated as standalone Qs
      const faqPairs = [];
      const paras = [...sec.paras.filter(pp => !isCTA(pp))];
      while (paras.length) {
        const q = paras.shift();
        const a = paras.shift() || '';
        if (q && q.length > 5) faqPairs.push({ q, a });
      }
      for (const b of sec.bullets) faqPairs.push({ q: b, a: '' });
      bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    <div class="sl" style="text-align:center">FAQ</div>
    <h2 style="text-align:center;margin-bottom:8px">${sec.heading ? fmt(sec.heading) : 'Frequently Asked Questions'}</h2>
    <p style="text-align:center;color:#64748B;max-width:560px;margin:0 auto 40px">Everything you need to know before you decide.</p>
    <div class="faq-list">
      ${faqPairs.filter(f => f.q.length > 5).map(f => `
      <div class="faq-item">
        <div class="faq-q">${fmt(f.q)}</div>
        ${f.a ? `<div class="faq-a">${fmt(f.a)}</div>` : ''}
      </div>`).join('')}
    </div>
    <div style="text-align:center;margin-top:48px">
      <button class="cta-big-btn" style="font-size:1rem;padding:16px 44px">Yes, I'm Ready — Get Access →</button>
      <div class="cta-sub-text">🔒 30-Day Money-Back Guarantee · No Risk Whatsoever</div>
    </div>
  </div>
</section>`;
      continue;
    }

    // ── WHO THIS IS FOR ───────────────────────────────────────────────────────
    if (kind === 'who') {
      const isNotFor = /(not for|isn.t for|not a fit|who (this|it).s not|not (right|ideal)|who (should not|won.t))/i.test(sec.heading || '');
      const iconClass = isNotFor ? 'who-icon-no' : 'who-icon-yes';
      const iconChar = isNotFor ? '✗' : '✓';
      const fallbackHead = isNotFor ? 'This Is NOT For You If...' : 'This Is Perfect For You If...';
      bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    <div class="sl" style="text-align:center">${isNotFor ? 'NOT A FIT?' : 'IS THIS FOR YOU?'}</div>
    <h2 style="text-align:center;margin-bottom:16px">${sec.heading ? fmt(sec.heading) : fallbackHead}</h2>
    ${sec.paras.filter(pp => !isCTA(pp)).map(pp => `<p style="text-align:center;max-width:640px;margin:0 auto 12px">${fmt(pp)}</p>`).join('')}
    <div class="who-grid">
      ${sec.bullets.map(b => `
      <div class="who-item">
        <div class="${iconClass}">${iconChar}</div>
        <span>${fmt(b)}</span>
      </div>`).join('')}
    </div>
  </div>
</section>`;
      continue;
    }

    // ── PRICING / VALUE STACK ─────────────────────────────────────────────────
    if (kind === 'pricing') {
      const items = [];
      const totalLines = [];
      const priceLines = [];
      const nonPriceBullets = [];

      for (const b of sec.bullets) {
        const m = b.match(/\$([\d,]+)/);
        if (m) {
          const label = b
            .replace(/\s*\([^)]*\$[\d,]+[^)]*\)\s*$/i, '') // strip (Value: $297) or ($297 value)
            .replace(/\s*[-–]\s*\$[\d,]+[^.]*$/i, '')       // strip — $297...
            .trim().replace(/[-–:,]+$/, '').trim();
          items.push({ label, value: m[0] });
        } else {
          nonPriceBullets.push(b);
        }
      }
      const extraParaItems = []; // paragraphs that aren't total/price/CTA → treat as value items
      for (const pp of sec.paras) {
        if (/today.s price|your (price|investment)|you.*pay|just \$|^only \$/i.test(pp)) {
          priceLines.push(pp);
        } else if (/total.*(real\s*)?value|total.*worth/i.test(pp)) {
          totalLines.push(pp);
        } else if (isCTA(pp)) {
          // skip CTA paragraphs — no button in pricing section
        } else if (/\$\d+/.test(pp)) {
          const m = pp.match(/\$([\d,]+)/);
          const label = pp
            .replace(/\s*\([^)]*\$[\d,]+[^)]*\)\s*$/i, '') // strip trailing (Value: $297) or ($297 value)
            .replace(/\s*[-–]\s*\$[\d,]+[^.]*$/i, '')       // strip trailing — $297...
            .trim().replace(/[-–:,]+$/, '').trim();
          items.push({ label: label || pp, value: m ? m[0] : null });
        } else if (pp.length > 5) {
          extraParaItems.push(pp); // descriptive text lines — render as plain bullet
        }
      }

      // All bullets from the section as the unified display list
      const allBulletItems = [
        ...nonPriceBullets.map(b => ({ label: b, value: null })),
        ...items.filter(it => it.label),
        ...extraParaItems.map(p => ({ label: p, value: null })),
      ];

      // If no items AND no total/price lines at all, render as plain checklist
      if (allBulletItems.length === 0 && totalLines.length === 0 && priceLines.length === 0) {
        const rawBullets = sec.bullets.filter(b => !isCTA(b));
        bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    ${sec.heading ? `<h2 style="text-align:center;margin-bottom:24px">${fmt(sec.heading)}</h2>` : ''}
    ${rawBullets.length ? `<div class="vs-box"><div style="padding:20px 28px 24px"><ul style="list-style:none;display:flex;flex-direction:column;gap:2px">${rawBullets.map(b => `
      <li style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #F1F5F9">
        <span class="chk" style="flex-shrink:0;margin-top:1px">✓</span>
        <span style="font-size:.9375rem;color:#334155;line-height:1.55">${fmt(b)}</span>
      </li>`).join('')}</ul></div></div>` : ''}
  </div>
</section>`;
        continue;
      }

      // Build unified bullet rows
      const unifiedListHtml = allBulletItems.map(it => `
      <li style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid #F1F5F9">
        <span style="display:flex;align-items:flex-start;gap:12px;flex:1">
          <span class="chk" style="flex-shrink:0;margin-top:1px">✓</span>
          <span style="font-size:.9375rem;color:#334155;line-height:1.5">${fmt(it.label)}</span>
        </span>
        ${it.value ? `<span style="font-size:.875rem;color:#94A3B8;text-decoration:line-through;white-space:nowrap;flex-shrink:0;margin-top:2px;padding-left:8px">${esc(it.value)}</span>` : ''}
      </li>`).join('');

      // Normalize labels: "Total Real Value" → "Total Value", price lines → "Only $XXX"
      const normTotal = t => t.replace(/total\s+real\s+value/i, 'Total Value');
      const normPrice = t => {
        const m = t.match(/\$([\d,]+)/);
        return m ? `Only ${m[0]}` : t.replace(/^(your\s+)?(price|investment)(\s+today)?[:\s-]*/i, '').replace(/^just\s+/i, 'Only ').trim();
      };
      const totalHtml = totalLines.map(t => `<div class="vs-total" style="font-weight:800;color:#0F172A">${fmt(normTotal(t))}</div>`).join('');
      const priceHtml = priceLines.map(t => `<div class="vs-price">${fmt(normPrice(t))}</div>`).join('');

      bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    ${sec.heading ? `<h2 style="text-align:center;margin-bottom:28px">${fmt(sec.heading)}</h2>` : ''}
    <div class="urgency-strip">
      <span style="font-size:1.3rem">⏰</span>
      <span class="urgency-text">This Price Won't Last — Lock In Today Before It Increases</span>
    </div>
    <div class="vs-box">
      ${allBulletItems.length ? `<div style="padding:8px 28px 4px"><ul style="list-style:none;display:flex;flex-direction:column">${unifiedListHtml}</ul></div>` : ''}
      ${totalLines.length ? `<div class="vs-divider"></div>${totalHtml}` : ''}
      ${priceLines.length ? `<div class="vs-divider"></div>${priceHtml}` : ''}
    </div>
  </div>
</section>`;
      continue;
    }

    // ── CONTENT (default: plain paragraphs + optional bullets) ──────────────
    {
      const contentParas = sec.paras.filter(pp => !isCTA(pp));
      const ctaContent = sec.paras.find(pp => isCTA(pp)) || (sec.bullets.length ? sec.bullets.find(b => isCTA(b)) : null);
      const cleanContentBullets = sec.bullets.filter(b => !isCTA(b));
      bodyHtml += `
<section class="section ${altBg ? 'alt' : ''}">
  <div class="si">
    ${sec.heading ? `<h2>${fmt(sec.heading)}</h2>` : ''}
    ${contentParas.map(pp => `<p>${fmt(pp)}</p>`).join('')}
    ${cleanContentBullets.length ? `<ul class="checklist" style="margin-top:20px">${cleanContentBullets.map(b => `<li><span class="chk">✓</span><span>${fmt(b)}</span></li>`).join('')}</ul>` : ''}
    ${ctaContent ? `<div style="text-align:center;margin-top:24px"><button class="cta-big-btn" style="font-size:1rem;padding:14px 40px">${fmt(ctaContent)} →</button></div>` : ''}
  </div>
</section>`;
    }
  }

  // ── Fallback guarantee if copy had none ───────────────────────────────────
  if (!hasGuarantee) {
    bodyHtml += `
<section class="section alt">
  <div class="si">
    <div class="gbox">
      <div class="g-badge">🛡️</div>
      <div class="g-text">
        <h3>100% Money-Back Guarantee</h3>
        <p>Try it completely risk-free for 30 days. If you're not absolutely satisfied, we'll refund every penny — no questions asked.</p>
      </div>
      <div class="g-seal"><span>MONEY</span><span class="gd">30</span><span>DAY</span><span>BACK</span></div>
    </div>
  </div>
</section>`;
  }

  // ── Fallback CTA band if copy had none ────────────────────────────────────
  if (!hasCTA) {
    const heroSec = sections[0];
    const fbCtaH = heroSec?.heading || heroSec?.paras[0] || 'Get Started Today';
    const fbCtaP = heroSec?.heading ? (heroSec.paras[0] || '') : (heroSec?.paras[1] || 'Join thousands already getting results.');
    bodyHtml += `
<section class="cta-band">
  <p style="color:rgba(255,255,255,.7);font-size:.8rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;position:relative">⏰ Limited Time Offer</p>
  <h2>${fmt(fbCtaH)}</h2>
  ${fbCtaP ? `<p>${fmt(fbCtaP)}</p>` : ''}
  <button class="cta-big-btn">Yes! I Want Instant Access →</button>
  <div class="cta-sub-text">🔒 256-bit SSL · 30-Day Money-Back Guarantee · Cancel Anytime</div>
</section>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page Preview</title>
<style>${css}</style>
</head>
<body>

${isScript ? `<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e293b;color:#f1f5f9;font-family:system-ui,sans-serif;font-size:13px;padding:10px 20px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #f59e0b;">
  <span style="font-size:16px;">⚠️</span>
  <span><strong>Script content detected.</strong> This preview strips stage directions &amp; metadata — only the spoken copy is shown. For a full page mockup, use the <strong>AI Generated</strong> tab.</span>
</div><div style="height:44px"></div>` : ''}

<nav>
  <div class="nav-logo">✦ Brand</div>
  <div class="nav-links">
    <a class="nav-link" href="#">About</a>
    <a class="nav-link" href="#">Results</a>
    <a class="nav-link" href="#">FAQ</a>
  </div>
  <button class="nav-cta">Get Started →</button>
</nav>

${bodyHtml}

<footer>
  <strong>✦ Brand Name</strong><br>
  © ${new Date().getFullYear()} All Rights Reserved &nbsp;·&nbsp; Privacy Policy &nbsp;·&nbsp; Terms of Service
</footer>

</body>
</html>`;
}

// ── POST /copywrite/test-key ─────────────────────────────────────────────────

router.post('/test-key', async (req, res) => {
  const { provider = 'claude', apiKey, model: reqModel } = req.body;

  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) return res.status(400).json({ error: 'No API key provided' });

  const providerCfg = PROVIDER_MAP[provider];
  if (!providerCfg) return res.status(400).json({ error: 'Unknown provider' });

  const model = reqModel || providerCfg.defaultModel;

  try {
    if (providerCfg.type === 'anthropic') {
      const client = new Anthropic({ apiKey: resolvedKey });
      await client.messages.create({
        model, max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    } else if (providerCfg.type === 'openai-compat') {
      const client = new OpenAI({ apiKey: resolvedKey, baseURL: providerCfg.baseUrl });
      await client.chat.completions.create({
        model, max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    } else if (providerCfg.type === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${resolvedKey}`;
      await axios.post(url, {
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        generationConfig: { maxOutputTokens: 1 },
      });
    } else if (providerCfg.type === 'cohere') {
      await axios.post('https://api.cohere.com/v1/chat', {
        message: 'hi', model, max_tokens: 1,
      }, { headers: { Authorization: `Bearer ${resolvedKey}`, 'Content-Type': 'application/json' } });
    }

    res.json({ ok: true });
  } catch (err) {
    const status = err.response?.status || err.status;
    const msg =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message ||
      'Key rejected';
    res.status(200).json({ ok: false, status, error: msg });
  }
});

// ── GET /copywrite/brand-voice ───────────────────────────────────────────────

router.get('/brand-voice', async (req, res) => {
  const locationId = req.query.locationId;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  const [voice, feedback] = await Promise.all([
    brandVoiceStore.getVoice(locationId).catch(() => null),
    brandVoiceStore.getFeedback(locationId).catch(() => []),
  ]);
  res.json({ voice, feedback });
});

// ── DELETE /copywrite/brand-voice ────────────────────────────────────────────

router.delete('/brand-voice', async (req, res) => {
  const locationId = req.query.locationId || req.body.locationId;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  await Promise.all([
    brandVoiceStore.clearVoice(locationId).catch(() => {}),
    brandVoiceStore.clearFeedback(locationId).catch(() => {}),
  ]);
  res.json({ ok: true });
});

// ── POST /copywrite/feedback ─────────────────────────────────────────────────

router.post('/feedback', async (req, res) => {
  const { locationId, type, text, sentiment } = req.body;
  if (!locationId || !text || !sentiment) {
    return res.status(400).json({ error: 'locationId, text, sentiment required' });
  }
  await brandVoiceStore.addFeedback(locationId, { type, text, sentiment }).catch(() => {});
  res.json({ ok: true });
});

// ── POST /copywrite/analyze-voice ────────────────────────────────────────────

router.post('/analyze-voice', async (req, res) => {
  const { provider = 'claude', apiKey, model: reqModel } = req.body;
  const locationId = req.query.locationId || req.body.locationId;

  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) return res.status(400).json({ error: 'No API key configured' });

  const providerCfg = PROVIDER_MAP[provider];
  if (!providerCfg) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  const idx = await copyStore.getCopyIndex(locationId).catch(() => []);
  if (idx.length < 2) {
    return res.json({ ok: true, skipped: true, reason: 'Save at least 2 copies first' });
  }

  const sampleIds = idx.slice(0, 15).map(i => i.id);
  const copies = (await Promise.all(
    sampleIds.map(id => copyStore.getCopy(id).catch(() => null))
  )).filter(Boolean);

  const samples = copies.map(c => {
    const lastAi = [...c.messages].reverse().find(m => m.role === 'assistant');
    return lastAi ? `[${c.type}] ${lastAi.content.slice(0, 500)}` : null;
  }).filter(Boolean);

  if (samples.length < 2) {
    return res.json({ ok: true, skipped: true, reason: 'Not enough content to analyze' });
  }

  const prompt = `You are a brand voice strategist. Analyze these ${samples.length} copy samples — all written for the same brand — and produce a concise brand voice profile (200 words max). Cover: tone & personality, writing style, target audience, recurring themes or angles, and any distinctive patterns. Be specific and actionable — this profile will be injected into future AI copywriting sessions to maintain brand consistency.

${samples.join('\n\n---\n\n')}`;

  try {
    const model = reqModel || providerCfg.defaultModel;
    const profile = await callAI(providerCfg, resolvedKey, model, prompt);

    if (profile) {
      await brandVoiceStore.setVoice(locationId, {
        profile,
        sampleCount: samples.length,
        updatedAt: Date.now(),
      });
    }

    res.json({ ok: true, profile, sampleCount: samples.length });
  } catch (err) {
    console.error('[analyze-voice]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /copywrite/generate-ghl-prompt ──────────────────────────────────────

router.post('/generate-ghl-prompt', async (req, res) => {
  const { copy, provider = 'claude', apiKey, model: reqModel } = req.body;
  if (!copy) return res.status(400).json({ error: 'copy is required' });

  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) return res.status(400).json({ error: 'No API key configured' });

  const providerCfg = PROVIDER_MAP[provider];
  if (!providerCfg) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  const extractPrompt = `You are a GoHighLevel marketing expert. Analyze the sales funnel copy below and produce a ready-to-use "Ask AI" prompt for GoHighLevel.

The output prompt must be structured so a GHL user can paste it directly into the "Ask AI" field to generate follow-up marketing content (emails, SMS, social ads) that matches the funnel.

Output ONLY the formatted prompt — no explanation, no preamble, no quotes around it.

Format the output exactly like this:

You are a direct-response copywriter. Use the product brief below to write persuasive marketing content.

PRODUCT: [extract product/program name]
AUDIENCE: [extract who this is for — be specific]
CORE PROBLEM: [extract the main pain point or frustration they have]
TRANSFORMATION: [what result/outcome does the product deliver]

KEY BENEFITS:
• [benefit 1]
• [benefit 2]
• [benefit 3]
• [benefit 4]

OFFER:
Price: [extract price]
Guarantee: [extract guarantee or "30-day money-back guarantee"]
Bonus/Included: [list 2–3 key inclusions if present]

TONE: [extract tone — e.g. "direct and motivational", "warm and coaching", "authoritative and results-driven"]
CTA: [extract main call to action — e.g. "Join Now", "Get Instant Access"]

---

Write a [EMAIL / SMS / SOCIAL AD — user will fill this in] that speaks directly to {{contact.first_name}} about the problem above and presents this offer in a compelling, conversational way. Keep it concise, benefit-focused, and end with a clear call to action.

SALES FUNNEL COPY TO ANALYZE:
${copy.slice(0, 6000)}`;

  try {
    const model = reqModel || providerCfg.defaultModel;
    const prompt = await callAI(providerCfg, resolvedKey, model, extractPrompt, 1200);
    if (!prompt || prompt.length < 100) {
      return res.status(500).json({ error: 'Failed to generate prompt' });
    }
    res.json({ ok: true, prompt: prompt.trim() });
  } catch (err) {
    console.error('[generate-ghl-prompt]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /copywrite/mockup ────────────────────────────────────────────────────

router.post('/mockup', async (req, res) => {
  const { copy, type = 'sales-page', mode = 'template', provider = 'claude', apiKey, model: reqModel, seed: clientSeed } = req.body;

  if (!copy) return res.status(400).json({ error: 'copy is required' });

  if (mode === 'template') {
    return res.json({ ok: true, html: buildTemplateHTML(copy, type), mode: 'template' });
  }

  // AI mode — Claude reads the copy and designs a fully custom HTML page from scratch
  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) return res.status(400).json({ error: 'No API key configured' });

  const providerCfg = PROVIDER_MAP[provider];
  if (!providerCfg) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  // Each STYLE is a fundamentally different visual identity — not just a color swap
  const STYLES = [
    {
      name: 'Bold & Dramatic',
      palette: { bg:'#0A0A0A', accent:'#F59E0B', card:'#141414', text:'#F8FAFC', muted:'#9CA3AF', border:'#2a2a2a' },
      hero: 'linear-gradient(135deg,#1a1100 0%,#0A0A0A 60%)',
      aesthetic: 'Dark, high-contrast, aggressive. Oversized font weights (800–900), tight line-height, full-bleed dark sections. Buttons are sharp-cornered (border-radius 4px). Typography is powerful — large numbers, bold labels, minimal decoration.',
      typeTreatment: 'font-weight:900 for headings; letter-spacing:-0.02em; hero headline font-size clamp(2.5rem,6vw,5rem).',
      buttonStyle: 'background:#F59E0B; color:#000; font-weight:800; border-radius:4px; text-transform:uppercase; letter-spacing:.08em;',
    },
    {
      name: 'Clean & Editorial',
      palette: { bg:'#FAFAF9', accent:'#2563EB', card:'#fff', text:'#111827', muted:'#6B7280', border:'#E5E7EB' },
      hero: 'linear-gradient(160deg,#1E3A8A 0%,#2563EB 100%)',
      aesthetic: 'Spacious, editorial, refined. Wide padding, generous whitespace, hairline dividers. Body text at 17–18px with comfortable leading. Accent used only on key CTAs. Sections separated by generous vertical space.',
      typeTreatment: 'font-weight:300 for body, 700 for headings; line-height:1.7; hero headline font-size clamp(2rem,5vw,4rem).',
      buttonStyle: 'background:#2563EB; color:#fff; font-weight:600; border-radius:8px; padding:14px 32px;',
    },
    {
      name: 'Warm & Coaching',
      palette: { bg:'#FFFBF7', accent:'#EA580C', card:'#FFF7ED', text:'#1C1917', muted:'#78716C', border:'#FED7AA' },
      hero: 'linear-gradient(135deg,#7C2D12 0%,#C2410C 100%)',
      aesthetic: 'Warm, personal, approachable — like a trusted mentor. Rounded corners (border-radius 16–24px), warm cream backgrounds, soft orange accents. Story-driven layout. Testimonials feel like real conversations.',
      typeTreatment: 'font-weight:500–700; line-height:1.6; hero headline mixes normal and bold weight.',
      buttonStyle: 'background:#EA580C; color:#fff; font-weight:700; border-radius:50px; padding:16px 40px;',
    },
    {
      name: 'Tech & Precision',
      palette: { bg:'#F8FAFC', accent:'#0EA5E9', card:'#fff', text:'#0F172A', muted:'#64748B', border:'#CBD5E1' },
      hero: 'linear-gradient(135deg,#0C4A6E 0%,#0284C7 100%)',
      aesthetic: 'Data-driven, systematic, precise. Strict grid, monospace accents for stats, badge-style labels, structured lists. Stats in large monospace numerals. Communicates authority through structure.',
      typeTreatment: 'Monospace (Courier New) for numbers and stats; sans-serif for body; font-weight:600 for headings.',
      buttonStyle: 'background:#0EA5E9; color:#fff; font-weight:600; border-radius:6px; border:2px solid #0EA5E9;',
    },
    {
      name: 'Elegant & Premium',
      palette: { bg:'#FAF9F7', accent:'#9333EA', card:'#fff', text:'#1a1a2e', muted:'#6B7280', border:'#E9D5FF' },
      hero: 'linear-gradient(160deg,#3B0764 0%,#7E22CE 100%)',
      aesthetic: 'Sophisticated, high-end, aspirational. Generous vertical padding (80–120px per section), subtle gradients, premium feel. Thin-weight text with wide tracking on labels. Cards have no borders — only elegant shadows.',
      typeTreatment: 'font-weight:300 labels with letter-spacing:.15em uppercase; 700 for headings; hero italic or mixed weight.',
      buttonStyle: 'background:linear-gradient(135deg,#7C3AED,#9333EA); color:#fff; font-weight:600; border-radius:50px; padding:16px 48px;',
    },
    {
      name: 'Energetic & Conversion',
      palette: { bg:'#fff', accent:'#DC2626', card:'#FEF2F2', text:'#111827', muted:'#4B5563', border:'#FECACA' },
      hero: 'linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)',
      aesthetic: 'High-urgency, direct-response. Urgency bars, "spots limited" callouts, bold red CTAs. Social proof appears early and repeatedly. Dense with proof, benefits, and urgency signals. Nothing subtle.',
      typeTreatment: 'font-weight:800 for headings; urgency text in red/orange; large bold price display; checkmarks before every benefit.',
      buttonStyle: 'background:#DC2626; color:#fff; font-weight:800; border-radius:6px; font-size:1.1rem; text-transform:uppercase; letter-spacing:.05em;',
    },
  ];

  const LAYOUTS = [
    'hero → trust-bar → problem-pain → features-what-you-get → social-proof → pricing-value-stack → guarantee → faq → cta-band',
    'hero → who-this-is-for → features-what-you-get → social-proof → pricing-value-stack → guarantee → faq → cta-band',
    'hero → trust-bar → problem-pain → social-proof-early → features-what-you-get → pricing-value-stack → faq → cta-band',
    'hero → problem-pain → who-this-is-for → features-what-you-get → social-proof → pricing-value-stack → guarantee → cta-band',
    'hero → trust-bar → features-what-you-get → social-proof → who-this-is-for → pricing-value-stack → guarantee → cta-band',
    'hero → problem-pain → features-what-you-get → social-proof → guarantee → pricing-value-stack → faq → cta-band',
  ];

  const style   = STYLES[Math.floor(Math.random() * STYLES.length)];
  const layout  = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  const imgSeed = clientSeed ? String(clientSeed).slice(-6) : Math.random().toString(36).slice(2, 8);
  const genId   = clientSeed || Date.now();

  const designPrompt = `You are an elite conversion-focused web designer. Generation ID: ${genId} — each generation must produce a visually distinct page. Do NOT repeat the same layout or visual patterns from previous generations.

YOUR TASK: Read the marketing copy below, understand the product and audience, then design and build a complete high-converting sales funnel page as one self-contained HTML file that fully expresses this aesthetic identity:

━━━ AESTHETIC: ${style.name} ━━━
${style.aesthetic}

Typography: ${style.typeTreatment}
Button style: ${style.buttonStyle}

━━━ COLOR SYSTEM ━━━
Page bg: ${style.palette.bg} | Accent: ${style.palette.accent} | Card bg: ${style.palette.card}
Body text: ${style.palette.text} | Muted text: ${style.palette.muted} | Borders: ${style.palette.border}
Hero gradient: ${style.hero}

━━━ SECTION ORDER ━━━
Build in this exact sequence: ${layout}

Let the ${style.name} aesthetic define how EACH section looks — don't default to a generic design. The aesthetic should be unmistakable throughout.

━━━ SECTION REQUIREMENTS ━━━
HERO: Full-width, commanding. Eyebrow label pill, transformation headline (5–8 words), subheadline, CTA button, trust signal. Hero bg image: https://picsum.photos/seed/${imgSeed}H/1600/900 with overlay.

TRUST BAR (if in layout): 4–5 key stats/achievements in accent-color strip.

PROBLEM/PAIN (if in layout): 3–4 real audience frustrations. Make them feel seen and understood.

WHO THIS IS FOR (if in layout): Two columns — "✓ Perfect for you if…" vs "✗ Not for you if…"

FEATURES/WHAT YOU GET: Every item with emoji icon, bold title, short description. CTA button at the end.

SOCIAL PROOF: Exactly 3 testimonials. Each: outcome badge, ★★★★★, specific italic quote, avatar (picsum.photos/seed/${imgSeed}T1/80/80, T2, T3), name, role.

PRICING/VALUE STACK:
• Urgency strip at top (⏰ limited time or scarcity)
• Each deliverable: ✓ label left, <s>$XXX</s> crossed-out value right
• "Total Value: $X,XXX" summary line
• "Only $XXX" in large accent text
• NO button in this section

GUARANTEE (if in layout): Shield 🛡️, 30-day money-back promise, specific terms from the copy.

FAQ (if in layout): 4–5 real buyer objections answered. Left accent border on each card.

FINAL CTA BAND: Urgent, full-width. Strong headline, primary CTA button, guarantee reminder.

━━━ COPY RULES ━━━
• Use ONLY claims and results from the provided marketing copy
• Extract real product name, prices, features, testimonials from the copy
• If testimonials are absent, write 3 realistic ones that genuinely fit the product
• No [brackets], no placeholder text — write finished, real copy

━━━ TECHNICAL ━━━
• Single complete <!DOCTYPE html><html>…</html> document
• All CSS in one <style> tag — no external resources, no @import
• System fonts: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
• Fully mobile responsive: @media (max-width: 768px)
• Pure HTML/CSS — no JavaScript needed
• Concise code — under 420 lines total

OUTPUT: Return ONLY the HTML document. No preamble, no markdown fences.

━━━ MARKETING COPY ━━━
${copy.slice(0, 5000)}`;

  try {
    const model = reqModel || providerCfg.defaultModel;
    console.log(`[mockup] calling AI provider=${provider} model=${model} style="${style.name}" layout="${layout.slice(0,60)}"`);

    let rawHtml = await callAI(providerCfg, resolvedKey, model, designPrompt, 6500);

    console.log(`[mockup] raw response length=${rawHtml?.length ?? 0} first200="${(rawHtml || '').slice(0, 200).replace(/\n/g, '\\n')}"`);

    rawHtml = rawHtml || '';

    // Strip markdown fences (all variations)
    rawHtml = rawHtml
      .replace(/^```[\w]*\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // Extract the HTML document even if the model added preamble text
    const doctypeMatch = rawHtml.match(/<!DOCTYPE[\s\S]*/i);
    const htmlTagMatch = rawHtml.match(/<html[\s\S]*/i);
    if (doctypeMatch) rawHtml = doctypeMatch[0];
    else if (htmlTagMatch) rawHtml = htmlTagMatch[0];

    // Trim anything after </html>
    const closeMatch = rawHtml.match(/[\s\S]*<\/html>/i);
    if (closeMatch) rawHtml = closeMatch[0];

    console.log(`[mockup] extracted HTML length=${rawHtml.length} hasDoctype=${rawHtml.toLowerCase().startsWith('<!doctype')} hasHtmlTag=${rawHtml.toLowerCase().includes('<html')}`);

    if (!rawHtml || rawHtml.length < 500) {
      console.error(`[mockup] FAIL: response too short (${rawHtml.length} chars), falling back to template`);
      return res.json({ ok: true, html: buildTemplateHTML(copy, type), mode: 'template', fallback: true });
    }

    console.log(`[mockup] SUCCESS: serving AI HTML (${rawHtml.length} chars)`);
    res.json({ ok: true, html: rawHtml, mode: 'ai' });
  } catch (err) {
    console.error(`[mockup] EXCEPTION: ${err.name}: ${err.message}`);
    if (err.status) console.error(`[mockup] HTTP status: ${err.status} body: ${JSON.stringify(err.error || err.body || '')}`);
    console.error(`[mockup] stack: ${err.stack}`);
    try {
      return res.json({ ok: true, html: buildTemplateHTML(copy, type), mode: 'template', fallback: true });
    } catch {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── POST /copywrite ──────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { type, messages, provider = 'claude', apiKey, model: reqModel, locationId } = req.body;

  if (!type || !TYPES[type]) {
    return res.status(400).json({ error: 'Invalid copywriter type' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) {
    return res.status(400).json({ error: 'No API key configured. Go to Settings to connect an AI provider.' });
  }

  const providerCfg = PROVIDER_MAP[provider];
  if (!providerCfg) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  // Build system prompt — inject brand voice + feedback if available
  let system = TYPES[type].system;
  if (locationId) {
    try {
      const [voice, feedback] = await Promise.all([
        brandVoiceStore.getVoice(locationId),
        brandVoiceStore.getFeedback(locationId),
      ]);

      const additions = [];

      if (voice?.profile) {
        additions.push(`\nBRAND VOICE PROFILE (extracted from saved copies — apply this consistently to every response):\n${voice.profile}`);
      }

      // Filter feedback to this copywriter type first, fall back to all types if not enough
      const typeFb   = feedback.filter(f => f.type === type);
      const fbPool   = typeFb.length >= 2 ? typeFb : feedback;
      const liked    = fbPool.filter(f => f.sentiment === 'up').slice(0, 5);
      const disliked = fbPool.filter(f => f.sentiment === 'down').slice(0, 5);

      if (liked.length > 0) {
        additions.push(`\nWHAT THE CLIENT LOVED — write MORE like this:\n${liked.map(f => `• ${f.text}`).join('\n')}`);
      }
      if (disliked.length > 0) {
        additions.push(`\nWHAT THE CLIENT REJECTED — AVOID this style:\n${disliked.map(f => `• ${f.text}`).join('\n')}`);
      }

      if (additions.length) system = system + '\n' + additions.join('\n');
    } catch {}
  }

  const model = reqModel || providerCfg.defaultModel;

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  try {
    switch (providerCfg.type) {
      case 'anthropic':
        await streamAnthropic(resolvedKey, model, system, messages, res);
        break;
      case 'openai-compat':
        await streamOpenAICompat(resolvedKey, providerCfg.baseUrl, model, system, messages, res);
        break;
      case 'gemini':
        await streamGemini(resolvedKey, model, system, messages, res);
        break;
      case 'cohere':
        await streamCohere(resolvedKey, model, system, messages, res);
        break;
      default:
        res.write(`data: ${JSON.stringify({ error: 'Provider not supported yet.' })}\n\n`);
    }
  } catch (err) {
    console.error('[copywrite] Error:', provider, err.message);
    const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// ── GET /copywrite/session — load saved CopywritersChat conversation ──────────

router.get('/session', async (req, res) => {
  const locationId = req.query.locationId || 'default';
  const { type = 'general' } = req.query;
  try {
    const messages = await brandVoiceStore.getSession(locationId, type);
    res.json({ messages });
  } catch {
    res.json({ messages: [] });
  }
});

// ── POST /copywrite/session — save CopywritersChat conversation ───────────────

router.post('/session', async (req, res) => {
  const { locationId = 'default', type = 'general', messages = [] } = req.body;
  try {
    await brandVoiceStore.setSession(locationId, type, messages);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Save failed' });
  }
});

module.exports = router;