const express      = require('express');
const router       = express.Router();
const axios        = require('axios');
const crypto       = require('crypto');
const Anthropic    = require('@anthropic-ai/sdk');
const OpenAI       = require('openai');
const ghlAuth      = require('../lib/location-access');
const keyStore     = require('../lib/key-store');
const draftStore   = require('../lib/workflow-draft-store');
const { PROVIDERS } = require('../lib/ai-providers');

const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));

const BACKEND     = 'https://backend.leadconnectorhq.com';
const GHL_API     = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

function sessionHeaders(token) {
  return {
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/json',
    channel:        'APP',
    source:         'WEB_USER',
  };
}

// ── Workflow payload builder ───────────────────────────────────────────────────

function stepName(step) {
  if (step.name) return step.name;
  switch (step.type) {
    case 'wait':              return `Wait ${step.value || 1} ${step.unit || 'hours'}`;
    case 'sms':               return 'Send SMS';
    case 'email':             return 'Send Email';
    case 'task-notification': return 'Create Task';
    default:                  return step.type;
  }
}

function buildStep(step, { id, next, parentKey, order }) {
  const base = { id, name: stepName(step), next, parentKey, order };
  switch (step.type) {
    case 'wait': {
      const isTime = step.waitType !== 'condition';
      return {
        ...base,
        type: 'wait',
        attributes: {
          cat:              isTime ? 'action' : '',
          type:             isTime ? 'time' : 'condition',
          isHybridAction:   true,
          hybridActionType: 'wait',
          convertToMultipath: false,
          name:             base.name,
          transitions:      [],
          ...(isTime ? {
            startAfter: {
              type:      step.unit || 'hours',
              when:      'after',
              value:     Number(step.value) || 1,
              action_in: 0,
            },
          } : {
            condition: { operator: 'and', name: base.name, segments: [] },
          }),
        },
      };
    }
    case 'sms':
      return { ...base, type: 'sms', attributes: { body: step.body || '' } };
    case 'email':
      return {
        ...base,
        type: 'email',
        attributes: { subject: step.subject || '', html: step.body || '' },
      };
    case 'task-notification':
      return {
        ...base,
        type: 'task-notification',
        workflowsActionType: 'INTERNAL',
        attributes: {
          title:      step.title      || '',
          body:       step.body       || '',
          assignedTo: step.assignedTo || 'assigned user',
          dueDate:    String(step.dueDate || '1'),
        },
      };
    default:
      return { ...base, type: step.type, attributes: step.attributes || {} };
  }
}

function buildTrigger({ trigger, workflowId, locationId, companyId }) {
  return {
    status:          'draft',
    workflowId,
    conditions:      trigger.conditions || [],
    type:            trigger.type       || 'opportunity_status_changed',
    masterType:      'highlevel',
    name:            trigger.name       || 'Workflow Trigger',
    actions:         [{ workflow_id: workflowId, type: 'add_to_workflow' }],
    active:          true,
    triggersChanged: true,
    location_id:     locationId,
    company_id:      companyId || '',
    company_age:     0,
  };
}

function buildWorkflowPayload({ name, workflowId, locationId, companyId, trigger, steps }) {
  const ids      = steps.map(() => crypto.randomUUID());
  const templates = steps.map((step, i) =>
    buildStep(step, {
      id:        ids[i],
      next:      i < steps.length - 1 ? ids[i + 1] : null,
      parentKey: i > 0 ? ids[i - 1] : null,
      order:     i,
    })
  );

  const triggerPayload = buildTrigger({ trigger, workflowId, locationId, companyId });

  const workflowPayload = {
    _id:                     workflowId,
    locationId,
    companyId:               companyId || '',
    companyAge:              0,
    name,
    status:                  'draft',
    version:                 2,
    dataVersion:             7,
    allowMultiple:           false,
    removeContactFromLastStep: true,
    stopOnResponse:          false,
    autoMarkAsRead:          false,
    type:                    'workflow',
    parentId:                null,
    deleted:                 false,
    allowMultipleOpportunity: false,
    timezone:                'account',
    creationSource:          'workflow_ai',
    triggersChanged:         true,
    modifiedSteps:           [],
    deletedSteps:            [],
    createdSteps:            ids,
    scheduledPauseDates:     [],
    senderAddress:           {},
    workflowData:            { templates },
    newTriggers:             [triggerPayload],
    isAutoSave:              true,
    autoSaveSession: {
      workflowId,
      id:         crypto.randomUUID(),
      userId:     '',
      version:    1,
      inProgress: true,
    },
  };

  return { workflowPayload, triggerPayload };
}

// ── AI summarize ─────────────────────────────────────────────────────────────

async function callAI({ provider = 'claude', apiKey, model, system, userPrompt }) {
  const cfg = PROVIDER_MAP[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);

  const resolvedKey = apiKey || (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : null);
  if (!resolvedKey) throw new Error('No API key. Configure one in Settings.');

  const resolvedModel = model || cfg.defaultModel;

  if (cfg.type === 'anthropic') {
    const client = new Anthropic({ apiKey: resolvedKey });
    const msg = await client.messages.create({
      model: resolvedModel,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return msg.content[0].text;
  }

  if (cfg.type === 'openai-compat') {
    const client = new OpenAI({ apiKey: resolvedKey, baseURL: cfg.baseUrl });
    const resp = await client.chat.completions.create({
      model: resolvedModel,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
      max_tokens: 1024,
    });
    return resp.choices[0].message.content;
  }

  // Gemini fallback via HTTP
  if (cfg.type === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${resolvedKey}`;
    const { data } = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: { maxOutputTokens: 1024 },
    });
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error(`Provider type ${cfg.type} not supported for summarization`);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/workflows/session/status
// Authentication is now automatic: if the agency has installed the app, the
// server can mint a location token for this sub-account — no manual token
// pasting / bookmarklet. "connected" simply reflects whether that succeeds.
router.get('/session/status', async (req, res) => {
  const token = await ghlAuth.getLocationToken(req.locationId).catch(() => null);
  res.json({ connected: !!token });
});

// POST /api/workflows/analyze-copy — extract campaign brief from full copy conversation
router.post('/analyze-copy', async (req, res) => {
  const { messages, title, provider, apiKey, model } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const conversation = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Copywriter AI'}: ${m.content}`)
    .join('\n\n');

  const system = `You are a marketing strategist. Given a copywriting conversation, extract the campaign elements and write a clear, actionable brief in 3-5 sentences.

Cover:
- Who is the target audience and their main pain point
- What is the product, service, or offer
- The primary goal (lead gen, sale, booking, etc.) and main CTA
- The tone and angle being used

This brief will drive an AI-generated email/SMS drip sequence. Be specific — generic briefs produce generic copy.
Return ONLY the brief text. No labels, no JSON, no markdown.`;

  const userPrompt = `Copywriting conversation${title ? ` — "${title}"` : ''}:\n\n${conversation.slice(0, 12000)}\n\nWrite the campaign brief.`;

  try {
    const brief = await callAI({ provider, apiKey, model, system, userPrompt });
    res.json({ brief: brief.trim() });
  } catch (e) {
    console.error('[analyze-copy] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/generate-sequence — AI-generate all email/SMS steps
router.post('/generate-sequence', async (req, res) => {
  const { brief, emailCount = 2, smsCount = 1, provider, apiKey, model } = req.body;
  if (!brief) return res.status(400).json({ error: 'brief required' });

  const eCount = Math.max(0, Math.min(10, Number(emailCount)));
  const sCount = Math.max(0, Math.min(10, Number(smsCount)));
  if (eCount + sCount === 0) return res.status(400).json({ error: 'At least one email or SMS required' });

  const system = `You are an elite email marketing strategist who writes story-driven drip sequences that feel personal, not promotional.

Your sequences follow proven email marketing psychology and the art of storytelling:

STORY ARC (adapt the number of chapters to the email count):
- First email: Pattern interrupt — open with a relatable problem, bold observation, or unexpected insight. Introduce the brand/offer naturally. Zero hard sell. Make them feel seen.
- Middle emails: Build the story chapter by chapter — share a transformation, a client's journey, a behind-the-scenes truth, or a "what most people get wrong" revelation. Each email should feel like the next chapter and deepen desire.
- Second-to-last email: Raise the stakes — share social proof, scarcity, or a turning point that makes inaction feel costly.
- Last email: The natural close — the CTA feels like the logical, low-friction next step, not a pitch.

WRITING PRINCIPLES:
- Write like a real person texting a friend who needs help — warm, direct, no corporate tone
- Subject lines: hyper-specific, curiosity-driven, avoid spam triggers. Never generic ("Check this out", "Important update", "Don't miss this")
- First sentence must hook immediately — a question, a micro-story, or a bold claim
- Short paragraphs: 1–3 sentences max, mobile-scannable
- Exactly ONE clear CTA per email — specific action, low friction ("Book your free call", "Reply YES", "Read the story")
- SMS: sounds like a friend's text, never a blast. 1–2 sentences + {{cta_link}}
- Use {{contact.first_name}} naturally where it fits; don't force it
- Every email must feel complete AND leave them wanting the next one

WAIT INTERVALS — read the brief and choose pacing that fits:
- Urgency / event-based → hours to 1 day
- Lead nurture / relationship → 2–3 days
- High-ticket / trust-building → 4–7 days
- Re-engagement / win-back → 1–2 weeks
Vary intervals across the sequence to mirror a natural conversation cadence — not robotic equal spacing.

Return ONLY a valid JSON array. No markdown fences, no explanation, no extra keys.

Step shapes:
{ "type": "email", "name": "descriptive label", "subject": "...", "body": "..." }
{ "type": "sms",   "name": "descriptive label", "body": "..." }
{ "type": "wait",  "name": "", "value": <number>, "unit": "<minutes|hours|days|weeks>" }`;

  const userPrompt = `Campaign brief:\n${brief}\n\nGenerate exactly ${eCount} email(s) and ${sCount} SMS message(s).\nApply storytelling email marketing — each email is a chapter. Let the brief drive the pacing and wait intervals naturally. Interleave SMS between emails where it fits the flow. Put a Wait step between every message.`;

  try {
    const raw = await callAI({ provider, apiKey, model, system, userPrompt });
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI did not return a valid step array');
    const steps = JSON.parse(match[0]);
    if (!Array.isArray(steps)) throw new Error('Invalid step format from AI');
    res.json({ steps });
  } catch (e) {
    console.error('[generate-sequence] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workflows — list from GHL
router.get('/', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  const token = await ghlAuth.getLocationToken(locationId);
  if (!token) return res.status(401).json({ error: 'no_session' });

  try {
    const { data } = await axios.get(`${BACKEND}/workflow/${locationId}`, {
      headers: sessionHeaders(token),
      timeout: 12000,
    });
    const list = Array.isArray(data)
      ? data
      : data.workflows || data.data || data.items || [];
    res.json(list);
  } catch (err) {
    console.error('[workflows] list error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error:    err.response?.data?.message || err.message,
      raw:      err.response?.data,
    });
  }
});

// POST /api/workflows — create (or update) in GHL
router.post('/', async (req, res) => {
  const { locationId, name, trigger, steps = [], workflowId: existingId } = req.body;
  if (!locationId || !name) return res.status(400).json({ error: 'locationId and name required' });

  const auth      = await ghlAuth.getLocationAuth(locationId);
  const token     = auth?.token;
  const companyId = auth?.companyId || '';
  if (!token) return res.status(401).json({ error: 'no_session' });

  const workflowId = existingId || crypto.randomUUID();
  const { workflowPayload, triggerPayload } = buildWorkflowPayload({
    name, workflowId, locationId, companyId, trigger: trigger || {}, steps,
  });

  try {
    // 1. Create trigger
    const trigRes = await axios.post(
      `${BACKEND}/workflow/${locationId}/trigger`,
      triggerPayload,
      { headers: sessionHeaders(token), timeout: 12000 }
    );

    // 2. Auto-save full workflow
    const wfRes = await axios.put(
      `${BACKEND}/workflow/${locationId}/${workflowId}/auto-save`,
      workflowPayload,
      { headers: sessionHeaders(token), timeout: 12000 }
    );

    res.json({ ok: true, workflowId, workflow: wfRes.data, trigger: trigRes.data });
  } catch (err) {
    console.error('[workflows] create error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const msg    = err.response?.data?.message || err.message;
    if (status === 401) {
      return res.status(401).json({ error: 'ghl_unauthorized', detail: msg });
    }
    res.status(status).json({ error: msg, raw: err.response?.data });
  }
});

// ── Draft history routes ──────────────────────────────────────────────────────

// GET /api/workflows/drafts
router.get('/drafts', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try { res.json(await draftStore.getDrafts(locationId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflows/drafts — save generated sequence to history
router.post('/drafts', async (req, res) => {
  const { locationId, name, brief, steps, emailCount, smsCount } = req.body;
  if (!locationId || !name || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'locationId, name, steps required' });
  }
  try { res.json(await draftStore.saveDraft(locationId, { name, brief, steps, emailCount, smsCount })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflows/drafts/:id
router.get('/drafts/:id', async (req, res) => {
  try {
    const d = await draftStore.getDraft(req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    if (req.locationId && d.locationId !== req.locationId) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/workflows/drafts/:id — update name/brief/steps or mark published
router.put('/drafts/:id', async (req, res) => {
  const { locationId, ...updates } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    const d = await draftStore.updateDraft(req.params.id, locationId, updates);
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/workflows/drafts/:id
router.delete('/drafts/:id', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    const ok = await draftStore.deleteDraft(req.params.id, locationId);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/workflows/:id
router.delete('/:id', async (req, res) => {
  const { locationId } = req.query;
  const { id }         = req.params;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  const token = await ghlAuth.getLocationToken(locationId);
  if (!token) return res.status(401).json({ error: 'no_session' });

  try {
    await axios.delete(`${BACKEND}/workflow/${locationId}/${id}`, {
      headers: sessionHeaders(token),
      timeout: 10000,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message,
    });
  }
});

module.exports = router;
