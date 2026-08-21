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
    brandVoiceStore.getVoice(locationId, req.userId).catch(() => null),
    brandVoiceStore.getFeedback(locationId, req.userId).catch(() => []),
  ]);
  res.json({ voice, feedback });
});

// ── DELETE /copywrite/brand-voice ────────────────────────────────────────────

router.delete('/brand-voice', async (req, res) => {
  const locationId = req.query.locationId || req.body.locationId;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  await Promise.all([
    brandVoiceStore.clearVoice(locationId, req.userId).catch(() => {}),
    brandVoiceStore.clearFeedback(locationId, req.userId).catch(() => {}),
  ]);
  res.json({ ok: true });
});

// ── POST /copywrite/feedback ─────────────────────────────────────────────────

router.post('/feedback', async (req, res) => {
  const { locationId, type, text, sentiment } = req.body;
  if (!locationId || !text || !sentiment) {
    return res.status(400).json({ error: 'locationId, text, sentiment required' });
  }
  await brandVoiceStore.addFeedback(locationId, req.userId, { type, text, sentiment }).catch(() => {});
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

  // Per-user brand voice: train only on this user's own, non-archived copies.
  const idx = (await copyStore.getCopyIndex(locationId).catch(() => []))
    .filter(c => !c.ownerUserId || c.ownerUserId === req.userId)
    .filter(c => (c.status || 'in-progress') !== 'archived');
  if (idx.length < 2) {
    return res.json({ ok: true, skipped: true, reason: 'Save at least 2 copies first' });
  }

  // Staleness guard — the profile is derived from saved copies, so it only needs
  // re-analysis when a copy was added or edited. This lets the client call
  // analyze-voice on every new conversation for free when nothing has changed.
  const latestCopyAt = idx[0]?.updatedAt || idx[0]?.createdAt || 0;
  const force = req.body.force === true || req.query.force === 'true';
  const existing = await brandVoiceStore.getVoice(locationId, req.userId).catch(() => null);
  if (!force && existing?.profile && existing.analyzedCount === idx.length && existing.latestCopyAt === latestCopyAt) {
    return res.json({ ok: true, fresh: true, profile: existing.profile, sampleCount: existing.sampleCount });
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
      await brandVoiceStore.setVoice(locationId, req.userId, {
        profile,
        sampleCount:   samples.length,
        analyzedCount: idx.length,   // staleness key — # of saved copies at analysis
        latestCopyAt,                // staleness key — newest copy's timestamp
        updatedAt:     Date.now(),
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
  const { copy, html, provider = 'claude', apiKey, model: reqModel } = req.body;
  if (!copy && !html) return res.status(400).json({ error: 'copy or html is required' });

  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) return res.status(400).json({ error: 'No API key configured' });

  const providerCfg = PROVIDER_MAP[provider];
  if (!providerCfg) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  // If HTML is provided, analyze the actual rendered design instead of just the raw copy
  if (html) {
    const htmlPrompt = `You are an expert web designer and funnel strategist. Analyze the HTML sales funnel page below and produce a complete, ready-to-use AI builder prompt that can recreate this EXACT design in any AI website builder (Framer AI, Durable, Wix AI, Webflow AI, etc.).

Extract everything from the HTML: the exact color palette, typography style, section structure, component patterns, and all copy. The output prompt must be detailed enough that another AI can reproduce the same design from scratch.

Output ONLY the prompt — no explanation, no preamble.

Structure the output exactly like this:

Build a complete sales funnel page that exactly matches the following design specification.

━━━ DESIGN IDENTITY ━━━
Visual Style: [identify the aesthetic — e.g. "Bold & Dramatic dark theme", "Clean editorial light", "Warm coaching style", "Tech precision data-driven", "Elegant premium", "High-urgency conversion-focused"]
Color Palette:
  • Page background: [extract exact hex from HTML/CSS]
  • Accent / CTA color: [extract exact hex]
  • Card/section background: [extract exact hex]
  • Body text color: [extract exact hex]
  • Muted text color: [extract exact hex]
  • Border color: [extract exact hex]
  • Hero gradient: [extract the gradient CSS value]
Typography:
  • Heading weight: [extract font-weight from headings]
  • Body text size: [extract font-size]
  • Button style: [describe border-radius, padding, text-transform, letter-spacing]
  • Special type treatments: [e.g. monospace numbers, tracked uppercase labels, italic accents]

━━━ PAGE SECTIONS (build in this exact order) ━━━
[For each section found in the HTML, describe:]

SECTION N — [SECTION NAME]
Layout pattern: [describe the exact layout — e.g. "split left/right", "centered full-width", "2-column grid", "stacked rows"]
Visual components: [describe each element — e.g. "large number badge left, text right", "circular avatar above headline", "chat-bubble cards with rotation"]
Background: [describe the section background]
Content:
[Extract the ACTUAL copy text from the HTML for this section — headlines, body text, feature names, testimonial quotes, prices, etc.]

[Repeat for every section in the page]

━━━ COMPONENT SPECIFICATIONS ━━━
Buttons: [exact style from CSS — color, border-radius, padding, font-weight, text-transform]
Cards: [border-radius, shadow, border style]
Section dividers: [flat cuts / angled / curved SVG waves / hairlines]
Mobile: Fully responsive — stack all columns on mobile at 768px breakpoint

━━━ EXACT COPY TO USE ━━━
[List all the actual text content extracted from the HTML: product name, tagline, all headlines, all body text, all feature names, all testimonials with names, pricing details, guarantee text, FAQ questions and answers, CTA button text]

━━━ TECHNICAL REQUIREMENTS ━━━
- No navigation menu (distraction-free funnel)
- All CTAs link to the pricing section
- Mobile responsive
- Fast loading

CRITICAL: Your output must be a COMPLETE, self-contained prompt that ends properly. Do NOT cut off mid-sentence. After the last section, always end with this exact closing line:
"Build this page now as a single complete HTML file with all CSS included."

HTML FUNNEL PAGE TO ANALYZE:
${html.replace(/<style[\s\S]*?<\/style>/gi, '<style>[CSS OMITTED FOR BREVITY]</style>').slice(0, 24000)}`;

    try {
      const model = reqModel || providerCfg.defaultModel;
      const prompt = await callAI(providerCfg, resolvedKey, model, htmlPrompt, 5000);
      if (!prompt || prompt.length < 100) return res.status(500).json({ error: 'Failed to generate prompt' });
      return res.json({ ok: true, prompt: prompt.trim() });
    } catch (err) {
      console.error('[generate-ghl-prompt/html]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  const extractPrompt = `You are an expert funnel strategist. Analyze the sales funnel copy below and produce a complete, ready-to-use AI builder prompt that can be pasted into ANY AI website or funnel builder (Framer AI, Durable, Wix AI, Webflow AI, etc.) to recreate this exact funnel from scratch.

The output must be a self-contained blueprint — section by section — with the actual copy, structure, and design direction so the AI builder knows exactly what to build.

Output ONLY the prompt — no explanation, no preamble, no quotes around it.

Structure the output exactly like this:

Build a complete high-converting sales funnel page for the following product. Use the exact copy, sections, and structure described below.

━━━ PRODUCT OVERVIEW ━━━
Product Name: [extract exact product/program name]
Tagline: [extract or derive a 1-line tagline]
Target Audience: [extract who this is for — be specific about demographics, situation, pain]
Core Transformation: [what result does the customer get? Before → After]
Tone & Voice: [extract tone — e.g. "bold and direct", "warm and coaching", "authoritative"]

━━━ OFFER DETAILS ━━━
Price: [extract price]
Guarantee: [extract guarantee terms, or use "30-day money-back guarantee, no questions asked"]
What's Included: [list every item/module/bonus from the copy with its value if mentioned]

━━━ PAGE SECTIONS (build in this order) ━━━

SECTION 1 — HERO
Headline: [extract the main headline]
Subheadline: [extract the subheadline or core promise]
CTA Button Text: [extract CTA]
Trust Line Below Button: [e.g. "🔒 Secure checkout · 30-day guarantee"]
Background: Full-width image with dark overlay, large bold headline centered or left-aligned

SECTION 2 — PROBLEM / PAIN POINTS
Intro: [extract or derive an empathetic opening line]
Pain Points (list each as a card with an ✗ icon):
• [pain point 1 from copy]
• [pain point 2 from copy]
• [pain point 3 from copy]
Closing Line: [empathetic bridge line]

SECTION 3 — FEATURES / WHAT YOU GET
Section Heading: [extract heading like "Here's Everything You Get"]
Features (each with an emoji icon, bold title, and 1-sentence description):
• [feature 1]
• [feature 2]
• [feature 3]
[list all features from the copy]
End with a CTA button

SECTION 4 — SOCIAL PROOF
Section Heading: [e.g. "Real Results From Real People"]
Testimonial 1: "[quote]" — [Name, Role/Location] | Result badge: [outcome]
Testimonial 2: "[quote]" — [Name, Role/Location] | Result badge: [outcome]
Testimonial 3: "[quote]" — [Name, Role/Location] | Result badge: [outcome]
[extract from copy; if absent, note that realistic ones matching the product should be written]

SECTION 5 — VALUE STACK / PRICING
Section Heading: [extract or use "Your Investment Today"]
Urgency Note: [extract scarcity/urgency line, e.g. "Doors close Friday"]
Value Items (each line: item name on left, crossed-out dollar value on right):
• [item] — $[value]
[list all items with values]
Total Value: $[sum]
Price: Only $[price]
No button in this section

SECTION 6 — GUARANTEE
Heading: [extract or use "You're Protected by Our 30-Day Guarantee"]
Body: [extract guarantee terms]
Visual: Shield icon, green-tinted box

SECTION 7 — FAQ
[extract 4–5 real objections from the copy or derive from audience pain points]
Q: [question]
A: [answer]

SECTION 8 — FINAL CTA
Headline: [urgent closing headline]
CTA Button: [CTA text]
Guarantee reminder line below button

━━━ DESIGN DIRECTION ━━━
Style: Modern, conversion-focused sales page
Layout: Full-width sections, alternating light and dark backgrounds
Typography: Bold headlines (700–900 weight), comfortable body text
Buttons: Large, high-contrast, rounded
Mobile: Fully responsive — stack all columns on mobile
Images: Use lifestyle/product images relevant to [product category]

━━━ TECHNICAL NOTES ━━━
- No navigation menu or footer links (distraction-free funnel)
- Sticky header optional with CTA button
- All CTAs scroll to or link to the pricing section
- Page must load fast — optimize images

SALES FUNNEL COPY TO ANALYZE:
${copy.slice(0, 6000)}`;

  try {
    const model = reqModel || providerCfg.defaultModel;
    const prompt = await callAI(providerCfg, resolvedKey, model, extractPrompt, 2000);
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
  const { copy, type = 'sales-page', mode = 'template', copyLength = 'long', provider = 'claude', apiKey, model: reqModel, seed: clientSeed } = req.body;

  if (!copy) return res.status(400).json({ error: 'copy is required' });

  if (mode === 'template') {
    return res.json({ ok: true, html: buildTemplateHTML(copy, type), mode: 'template' });
  }

  // AI mode — streams SSE so Vercel 120s timeout never fires
  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) return res.status(400).json({ error: 'No API key configured' });

  const providerCfg = PROVIDER_MAP[provider];
  if (!providerCfg) return res.status(400).json({ error: `Unknown provider: ${provider}` });

  // Each STYLE is a completely different visual identity AND structural pattern
  const STYLES = [
    {
      name: 'Bold & Dramatic',
      palette: { bg:'#0A0A0A', accent:'#F59E0B', card:'#141414', text:'#F8FAFC', muted:'#9CA3AF', border:'#2a2a2a' },
      hero: 'linear-gradient(135deg,#1a1100 0%,#0A0A0A 60%)',
      aesthetic: 'Dark, high-contrast, aggressive. Oversized font weights (800–900), tight line-height, full-bleed dark sections throughout. Minimal decoration — let the type and contrast do the work.',
      typeTreatment: 'font-weight:900 for headings; letter-spacing:-0.03em; hero headline font-size clamp(3rem,7vw,5.5rem); all-caps labels.',
      buttonStyle: 'background:#F59E0B; color:#000; font-weight:800; border-radius:4px; text-transform:uppercase; letter-spacing:.1em; padding:18px 40px;',
      structure: {
        hero: 'SPLIT LAYOUT: left half is bold oversized headline + subheadline + CTA stacked vertically; right half is the hero image (picsum.photos) filling the half. Dark overlay on image side. Section height 100vh.',
        features: 'NUMBERED LIST: large amber number (01, 02, 03…) on the left in huge font, feature title + description on the right. Full-width rows, dark card background, top border in accent color.',
        proof: 'STACKED FULL-WIDTH CARDS: each testimonial is a self-contained dark card (full width). Inside each card: large opening quote mark (accent color, top-left), then italic quote text below it (1.2rem, full width), then a bottom row with avatar circle + name + company all grouped on the left, and an outcome badge on the right. Everything inside one card — no split columns, no content outside the card.',
        pricing: 'DARK CARD: single centered dark (#141414) card with amber accent borders. Items listed with ✓ checkmark left, crossed-out value right. Bold "Total Value" and "Only $XXX" lines in amber.',
        dividers: 'No decorative dividers — sections are separated by stark background color changes (dark/darker/darkest). Sharp edges, no curves.',
      },
    },
    {
      name: 'Clean & Editorial',
      palette: { bg:'#FAFAF9', accent:'#2563EB', card:'#fff', text:'#111827', muted:'#6B7280', border:'#E5E7EB' },
      hero: 'linear-gradient(160deg,#1E3A8A 0%,#2563EB 100%)',
      aesthetic: 'Spacious, editorial, magazine-quality. Maximum whitespace, thin hairline rules, type as the design. Everything breathes. The accent color appears sparingly — only on CTAs and key labels.',
      typeTreatment: 'font-weight:300 for body text; 700–800 for headings; line-height:1.75; hero headline font-size clamp(2.5rem,5vw,4.5rem); wide letter-spacing on eyebrow labels.',
      buttonStyle: 'background:#2563EB; color:#fff; font-weight:600; border-radius:3px; padding:14px 36px; letter-spacing:.02em;',
      structure: {
        hero: 'TEXT-ONLY CENTERED: no background image. Large centered headline with a thin underline accent under a key word. Subheadline in light weight below. CTA button + small social proof counter below. Generous top/bottom padding (120px). Hero bg is solid navy gradient.',
        features: '2-COLUMN CARD GRID: clean white cards with only a top accent-color border (3px), no other decoration. Feature title bold, description in muted text. Even grid spacing. Subtle box-shadow on hover state (use CSS :hover).',
        proof: 'EDITORIAL QUOTE STYLE: large oversized quotation mark (5rem, accent color) above each testimonial. Quote in italics, wide line-height. Name and role in small caps below a hairline rule. 3 cards in a row.',
        pricing: 'MINIMAL CENTERED: white background, max-width 560px centered. Simple list items with a left accent-color dot. Clean typography hierarchy. "Total Value" and "Only $XXX" in large type with a thin rule above each.',
        dividers: 'Thin 1px hairline rules between sections. Generous vertical padding (80–100px). No colored section backgrounds except the hero.',
      },
    },
    {
      name: 'Warm & Coaching',
      palette: { bg:'#FFFBF7', accent:'#EA580C', card:'#FFF7ED', text:'#1C1917', muted:'#78716C', border:'#FED7AA' },
      hero: 'linear-gradient(135deg,#7C2D12 0%,#C2410C 100%)',
      aesthetic: 'Warm, human, personal — like a trusted friend who happens to be an expert. Everything is rounded, soft, and approachable. Story-driven narrative flow.',
      typeTreatment: 'font-weight:600–700; line-height:1.65; hero headline in two lines with a warm friendly tone; body text at 17px.',
      buttonStyle: 'background:#EA580C; color:#fff; font-weight:700; border-radius:50px; padding:16px 44px; box-shadow:0 4px 20px rgba(234,88,12,.35);',
      structure: {
        hero: 'CENTERED WITH AVATAR: centered layout. Above the headline, show a circular avatar image (picsum.photos/seed/SEED/80/80) with a warm "Hi, I\'m [name]" greeting in small text. Then the big headline. Subheadline. CTA pill button. Background is warm gradient with a subtle pattern overlay.',
        features: 'ICON CARDS WITH WARM BACKGROUND: 2-column grid of rounded cards (border-radius:20px) on cream (#FFF7ED) background. Each card has a large emoji in a warm orange rounded square, bold title, short description. Cards have a warm shadow.',
        proof: 'CONVERSATION CARDS: testimonials styled like chat bubbles (border-radius:20px, tail on bottom-left). Avatar in a circle, name + star rating above the bubble. 3 cards stacked with slight rotation (-1deg, 0deg, 1deg) for a handcrafted feel.',
        pricing: 'WARM FEATURE BOX: cream background box with orange top border and a warm shadow. Items have ✓ checkmarks in orange. A dashed orange divider above the total. Price in large warm text.',
        dividers: 'Curved SVG wave dividers between major sections (use inline SVG path). Sections alternate between warm white and cream.',
      },
    },
    {
      name: 'Tech & Precision',
      palette: { bg:'#F8FAFC', accent:'#0EA5E9', card:'#fff', text:'#0F172A', muted:'#64748B', border:'#CBD5E1' },
      hero: 'linear-gradient(135deg,#0C4A6E 0%,#0284C7 100%)',
      aesthetic: 'Data-driven, systematic, credibility-first. The design communicates expertise through structure, not decoration. Monospace numbers, data badges, precise alignment.',
      typeTreatment: 'Monospace font (Courier New, monospace) for ALL numbers, stats, and prices; system sans-serif for body; font-weight:600–700 for headings.',
      buttonStyle: 'background:#0EA5E9; color:#fff; font-weight:600; border-radius:6px; border:2px solid #0EA5E9; padding:14px 32px; letter-spacing:.01em;',
      structure: {
        hero: 'LEFT-SPLIT WITH METRICS: left side has the headline + CTA; right side shows a "results dashboard" — 3–4 metric tiles (big monospace numbers: "2,400+ members", "94% success rate") in a grid. Background: dark navy left half bleeding into white right half.',
        features: 'STRUCTURED ROWS: each feature is a full-width horizontal row with a left number badge (monospace, accent color), feature name in bold, description in muted text, and a status badge ("Included ✓") on the far right. Separated by 1px borders.',
        proof: 'STAT + QUOTE HYBRID: each testimonial card shows a large metric at the top (e.g. "↑ 340% ROI") in monospace accent color, then the quote, then name + role. Cards have a left accent-color border (4px).',
        pricing: 'TABLE LAYOUT: items in a structured table-like list with columns: Item | Description | Value. Headers in muted small caps. Total row highlighted in light blue. Price in large monospace text.',
        dividers: 'Clean section breaks with a subtle blue-tinted background (#F0F9FF) for alternating sections. No curves — geometric and precise.',
      },
    },
    {
      name: 'Elegant & Premium',
      palette: { bg:'#FAF9F7', accent:'#9333EA', card:'#fff', text:'#1a1a2e', muted:'#6B7280', border:'#E9D5FF' },
      hero: 'linear-gradient(160deg,#3B0764 0%,#7E22CE 100%)',
      aesthetic: 'Sophisticated, aspirational, high-ticket. Every element whispers "quality." Generous space, muted palette with controlled purple accents, premium typography.',
      typeTreatment: 'Uppercase tracked labels (letter-spacing:.2em, font-size:.75rem) for section eyebrows; 300-weight body; 700-weight headings; hero headline with an italic word for personality.',
      buttonStyle: 'background:linear-gradient(135deg,#7C3AED,#9333EA); color:#fff; font-weight:500; border-radius:60px; padding:18px 52px; letter-spacing:.04em;',
      structure: {
        hero: 'MINIMAL LUXURY: full viewport height. Centered text on the gradient. Eyebrow label in small tracked uppercase. Main headline in 3–4 lines, one word italicized. Subheadline in light weight below. Ghost-style outlined CTA button (white border, transparent bg) + solid CTA side by side.',
        features: 'ALTERNATING ROWS: each feature alternates left-right — odd features have image/icon left + text right; even features have text left + icon right. Large section numbers in faint purple behind each. Generous padding between rows.',
        proof: 'LARGE FEATURE QUOTE: the first testimonial takes the full width — huge quote, prominent. Below it, two smaller testimonials side by side. All have subtle purple left-border accents.',
        pricing: 'GRADIENT CARD: single elegant card with a purple gradient border (CSS gradient border trick). Items in a refined list with em-dash separators. "Total Value" and "Only $XXX" in large elegant typography.',
        dividers: 'Gentle gradient fades between sections. Sections use very subtle purple-tinted backgrounds (#FAF5FF) alternating with pure white. No hard lines.',
      },
    },
    {
      name: 'Energetic & Conversion',
      palette: { bg:'#fff', accent:'#DC2626', card:'#FEF2F2', text:'#111827', muted:'#4B5563', border:'#FECACA' },
      hero: 'linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)',
      aesthetic: 'Maximum urgency, zero subtlety. This page is built to convert. Red everywhere it matters, social proof early and often, urgency signals constant.',
      typeTreatment: 'font-weight:800–900 for headings; urgency text in red; large bold price; all benefits have checkmarks; every section has a sub-CTA.',
      buttonStyle: 'background:#DC2626; color:#fff; font-weight:900; border-radius:8px; font-size:1.15rem; text-transform:uppercase; letter-spacing:.06em; padding:18px 44px; box-shadow:0 4px 24px rgba(220,38,38,.4);',
      structure: {
        hero: 'URGENCY HERO: red countdown-style banner at the very top ("⚠️ Offer closes in 24 hours"). Then full-width hero with centered bold headline. Below headline, 3 quick benefit bullets (✓ ✓ ✓). Then a large CTA button. Then a row of trust badges (Secure · Guaranteed · Instant Access).',
        features: 'CHECKLIST with INLINE CTAs: simple full-width checklist rows (✓ icon, benefit text). After every 3rd feature, insert a small "Get Access Now →" link in accent color to maintain conversion pressure.',
        proof: 'PROOF-HEAVY GRID: 3 testimonial cards with a prominent outcome badge at the top of each card (e.g. "Lost 40 lbs in 90 days" in red). Star rating, quote, name. Below the 3 cards, add a social proof bar: "Join 2,400+ people already inside".',
        pricing: 'URGENCY PRICING: red urgency strip at top ("🔥 Founding Member Pricing — Ends Soon"). Items with ✓ and crossed-out values. After the list, a bold "YOU SAVE $X" callout in red. Then the price. Then the CTA button directly below (unlike other styles — this style puts the button here for conversion).',
        dividers: 'Red accent divider lines (2px, full-width) between sections. Some sections have a light red-tinted background (#FEF2F2). Occasional urgency strips between sections.',
      },
    },
  ];

  const LAYOUTS = [
    'hero → trust-bar → problem-pain → features-what-you-get → social-proof → pricing-value-stack → guarantee → faq → scarcity → cta-band',
    'hero → who-this-is-for → features-what-you-get → social-proof → pricing-value-stack → guarantee → faq → scarcity → cta-band',
    'hero → trust-bar → problem-pain → social-proof-early → features-what-you-get → pricing-value-stack → faq → scarcity → cta-band',
    'hero → problem-pain → who-this-is-for → features-what-you-get → social-proof → pricing-value-stack → guarantee → scarcity → cta-band',
    'hero → trust-bar → features-what-you-get → social-proof → who-this-is-for → pricing-value-stack → guarantee → scarcity → cta-band',
    'hero → problem-pain → features-what-you-get → social-proof → guarantee → pricing-value-stack → faq → scarcity → cta-band',
  ];

  const style   = STYLES[Math.floor(Math.random() * STYLES.length)];
  const layout  = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  const imgSeed = clientSeed ? String(clientSeed).slice(-6) : Math.random().toString(36).slice(2, 8);
  const genId   = clientSeed || Date.now();

  const designPrompt = `You are an elite conversion-focused web designer. Generation ID: ${genId} — produce a completely unique page.

YOUR TASK: Read the marketing copy below and build a COMPLETE, fully-rendered HTML sales funnel page. Every section in the layout must be present and fully written — do NOT truncate or stop early.

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

━━━ STRUCTURAL PATTERNS (build each section EXACTLY as described) ━━━

HERO — ${style.structure.hero}

FEATURES/WHAT YOU GET — ${style.structure.features}

SOCIAL PROOF — ${style.structure.proof}

PRICING/VALUE STACK — ${style.structure.pricing}
Standard content: urgency strip at top, each item with crossed-out value, "Total Value: $X,XXX", "Only $XXX" in large text.

SECTION TRANSITIONS — ${style.structure.dividers}

TRUST BAR (if in layout): 4–5 key stats in an accent-color strip.
PROBLEM/PAIN (if in layout): 3–4 audience frustrations as cards.
WHO THIS IS FOR (if in layout): two-column qualifier — "For you if…" vs "Not for you if…"
GUARANTEE (if in layout): shield icon, 30-day promise, green-tinted box.
FAQ (if in layout): objections with real answers.
SCARCITY: Bold urgency section before final CTA — contrasting background, large bold text, specific availability claim. CSS only, no JS.
FINAL CTA BAND: urgent full-width section, strong headline, primary CTA button, guarantee note.
FOOTER: Do NOT generate a footer — it is automatically appended by the server. End with </body></html> immediately after the cta-band.

━━━ COPY DEPTH: ${copyLength === 'short' ? 'SHORT-FORM (same structure as long — just concise text)' : 'LONG-FORM (rich & detailed)'} ━━━
${copyLength === 'short' ? `Build the SAME sections in the SAME order as the SECTION ORDER above — do NOT drop or skip any section. Keep the full page structure (hero, features, social proof, and every other section in the layout: trust bar, problem/pain, who-this-is-for, pricing/value stack, guarantee, FAQ, scarcity, final CTA). The ONLY difference from a long page is the amount of text per section — keep every section tight, punchy, and scannable:
• Hero: 6–10 word headline + ONE short subheadline (≤15 words) + 1 CTA button
• Features: same count as the layout calls for, each = bold 2–4 word name + ONE short sentence (no multi-sentence descriptions)
• Social proof: 2–3 testimonials, ONE short sentence each + name/role
• Problem/pain, who-this-is-for, guarantee, FAQ, pricing, scarcity (whichever are in the layout): KEEP the section, but 1–2 lines only — a short headline plus a sentence or two, never paragraphs
• Final CTA band: 1 bold headline + 1 button + 1 trust line
Same visual structure and section count as a long page — just far less copy in each. Aim for ~150–220 lines of HTML.` : `Write thorough, persuasive, detailed copy throughout:
• Hero: compelling multi-line headline + rich subheadline up to 30 words
• Features: 5–7 items · each has a bold name + 2–3 sentence description
• Social proof: 3 testimonials · each quote 3–5 sentences with specific results
• FAQ: 5 questions · detailed 3–4 sentence answers addressing real objections
• Guarantee: full paragraph explaining the promise and process
• Scarcity: compelling 3–5 line urgency section with specific scarcity reason
• Problem/pain: vivid, empathetic descriptions that agitate the pain
Aim for 450–600 lines total — a fully fleshed-out, high-converting page.`}

━━━ COPY RULES ━━━
• Use ONLY content from the provided marketing copy — extract real product name, prices, features, testimonials
• If testimonials are absent, write 3 realistic ones that fit the product
• No [brackets], no placeholders — finished copy only
• Image seed for picsum.photos: ${imgSeed} (use ${imgSeed}H for hero, ${imgSeed}T1/${imgSeed}T2/${imgSeed}T3 for avatars)

━━━ TECHNICAL ━━━
• Single complete <!DOCTYPE html><html>…</html> document
• All CSS in one <style> tag — no external resources
• System fonts: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
• Fully mobile responsive: @media (max-width: 768px)
• Pure HTML/CSS — no JavaScript
• CTA buttons: NEVER full-width. Always display:inline-block with auto width, text-align:center on parent. Max-width 360px.
• Features section: list ALL features first, then ONE CTA button at the very bottom — never mid-list.
• Testimonials: quote text AND author name/role/avatar inside the SAME card — never split.

OUTPUT: Return ONLY the HTML document. No preamble, no markdown fences. Start with <!DOCTYPE html>.

━━━ MARKETING COPY ━━━
${copy.slice(0, 6000)}`;

  // Switch to SSE streaming so the Vercel 120s timeout never fires —
  // the connection stays alive the entire generation
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  function processAndSend(rawHtml) {
    rawHtml = (rawHtml || '')
      .replace(/^```[\w]*\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    const doctypeMatch = rawHtml.match(/<!DOCTYPE[\s\S]*/i);
    const htmlTagMatch = rawHtml.match(/<html[\s\S]*/i);
    if (doctypeMatch) rawHtml = doctypeMatch[0];
    else if (htmlTagMatch) rawHtml = htmlTagMatch[0];

    const closeMatch = rawHtml.match(/[\s\S]*<\/html>/i);
    if (closeMatch) rawHtml = closeMatch[0];

    if (!rawHtml || rawHtml.length < 500) {
      console.warn(`[mockup] response too short (${rawHtml.length} chars), falling back to template`);
      sendEvent({ done: true, html: buildTemplateHTML(copy, type), mode: 'template', fallback: true });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const accent = style.palette.accent || '#3B82F6';
    const footerHtml = `
<style>html,body{overflow:auto!important;height:auto!important;min-height:unset!important;}</style>
<footer style="background:#0F172A;padding:48px 24px;text-align:center;border-top:3px solid ${accent};margin-top:0;">
  <div style="max-width:900px;margin:0 auto;">
    <div style="font-size:1.1rem;font-weight:800;color:#F1F5F9;margin-bottom:6px;letter-spacing:-.01em;">© ${new Date().getFullYear()} · All Rights Reserved</div>
    <div style="font-size:.85rem;color:#64748B;margin-top:12px;">
      <a href="#" style="color:#94A3B8;text-decoration:none;margin:0 14px;">Privacy Policy</a>·
      <a href="#" style="color:#94A3B8;text-decoration:none;margin:0 14px;">Terms of Service</a>·
      <a href="#" style="color:#94A3B8;text-decoration:none;margin:0 14px;">Disclaimer</a>
    </div>
    <div style="font-size:.75rem;color:#334155;margin-top:16px;">Results may vary. This page is for informational purposes only.</div>
  </div>
</footer>`;

    rawHtml = rawHtml.replace(/<footer[\s\S]*?<\/footer>/gi, '');

    if (/<\/body>/i.test(rawHtml)) {
      rawHtml = rawHtml.replace(/<\/body>/i, footerHtml + '\n</body>');
    } else if (/<\/html>/i.test(rawHtml)) {
      rawHtml = rawHtml.replace(/<\/html>/i, footerHtml + '\n</body>\n</html>');
    } else {
      const lastSection = rawHtml.lastIndexOf('</section>');
      if (lastSection !== -1) {
        rawHtml = rawHtml.slice(0, lastSection + '</section>'.length) + '\n' + footerHtml + '\n</body>\n</html>';
      } else {
        rawHtml += footerHtml + '\n</body>\n</html>';
      }
    }

    console.log(`[mockup] SUCCESS: ${rawHtml.length} chars`);
    sendEvent({ done: true, html: rawHtml, mode: 'ai' });
    res.write('data: [DONE]\n\n');
    res.end();
  }

  try {
    const model = reqModel || providerCfg.defaultModel;
    console.log(`[mockup] streaming AI provider=${provider} model=${model} style="${style.name}" layout="${layout.slice(0,60)}"`);

    let rawHtml = '';

    const maxTok = copyLength === 'short' ? 6500 : 10000;

    if (providerCfg.type === 'anthropic') {
      const client = new Anthropic({ apiKey: resolvedKey });
      const stream = client.messages.stream({
        model, max_tokens: maxTok,
        messages: [{ role: 'user', content: designPrompt }],
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          rawHtml += event.delta.text;
          sendEvent({ chunk: event.delta.text });
        }
      }
    } else if (providerCfg.type === 'openai-compat') {
      const client = new OpenAI({ apiKey: resolvedKey, baseURL: providerCfg.baseUrl });
      const stream = await client.chat.completions.create({
        model, max_tokens: maxTok,
        messages: [{ role: 'user', content: designPrompt }],
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) { rawHtml += text; sendEvent({ chunk: text }); }
      }
    } else {
      // Gemini / Cohere: heartbeat keeps SSE alive while callAI does the work
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 5000);
      try { rawHtml = await callAI(providerCfg, resolvedKey, model, designPrompt, 8000); }
      finally { clearInterval(heartbeat); }
    }

    processAndSend(rawHtml);
  } catch (err) {
    console.error(`[mockup] EXCEPTION: ${err.name}: ${err.message}`);
    try {
      sendEvent({ done: true, html: buildTemplateHTML(copy, type), mode: 'template', fallback: true });
      res.write('data: [DONE]\n\n');
    } catch {}
    res.end();
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
        brandVoiceStore.getVoice(locationId, req.userId),
        brandVoiceStore.getFeedback(locationId, req.userId),
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
    const messages = await brandVoiceStore.getSession(locationId, req.userId, type);
    res.json({ messages });
  } catch {
    res.json({ messages: [] });
  }
});

// ── POST /copywrite/session — save CopywritersChat conversation ───────────────

router.post('/session', async (req, res) => {
  const { locationId = 'default', type = 'general', messages = [] } = req.body;
  try {
    await brandVoiceStore.setSession(locationId, req.userId, type, messages);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Save failed' });
  }
});

module.exports = router;