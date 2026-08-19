const express  = require('express');
const axios    = require('axios');
const router   = express.Router();
const aiConfig = require('../lib/ai-config-store');

const CU = 'https://api.clickup.com/api/v2';

async function getKey(locationId) {
  const cfg = await aiConfig.get(locationId).catch(() => null);
  return cfg?.clickupApiKey || null;
}

function headers(key) {
  return { Authorization: key, 'Content-Type': 'application/json' };
}

function cuErr(e) {
  const msg = e.response?.data?.err || e.response?.data?.error || e.message;
  return { error: msg, status: e.response?.status || 500 };
}

// GET /api/clickup/workspaces
router.get('/workspaces', async (req, res) => {
  const { locationId } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  try {
    const r = await axios.get(`${CU}/team`, { headers: headers(key) });
    res.json(r.data.teams || []);
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// GET /api/clickup/spaces/:teamId
router.get('/spaces/:teamId', async (req, res) => {
  const { locationId } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  try {
    const r = await axios.get(`${CU}/team/${req.params.teamId}/space?archived=false`, { headers: headers(key) });
    res.json(r.data.spaces || []);
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// GET /api/clickup/space/:spaceId/content — folders + folderless lists
router.get('/space/:spaceId/content', async (req, res) => {
  const { locationId } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  try {
    const [fR, lR] = await Promise.all([
      axios.get(`${CU}/space/${req.params.spaceId}/folder?archived=false`, { headers: headers(key) }),
      axios.get(`${CU}/space/${req.params.spaceId}/list?archived=false`,   { headers: headers(key) }),
    ]);
    res.json({ folders: fR.data.folders || [], lists: lR.data.lists || [] });
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// GET /api/clickup/folder/:folderId/lists
router.get('/folder/:folderId/lists', async (req, res) => {
  const { locationId } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  try {
    const r = await axios.get(`${CU}/folder/${req.params.folderId}/list?archived=false`, { headers: headers(key) });
    res.json(r.data.lists || []);
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// GET /api/clickup/list/:listId/tasks
router.get('/list/:listId/tasks', async (req, res) => {
  const { locationId } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  try {
    const listId = req.params.listId;
    const hdrs   = headers(key);

    const fetchPage = (url, params) =>
      axios.get(url, { headers: hdrs, params }).then(r => r.data.tasks).catch(() => null);

    // include_timl=true fetches tasks whose home list is elsewhere but are linked here
    const fetchUrl = `${CU}/list/${listId}/task`;
    let baseParams = null;
    for (const p of [
      { include_timl: true, include_closed: true, subtasks: true },
      { include_timl: true, include_closed: true },
      { include_timl: true, subtasks: true },
      { include_timl: true },
      { include_closed: true, subtasks: true },
      { include_closed: true },
      {},
    ]) {
      const batch = await fetchPage(fetchUrl, { ...p, page: 0 });
      if (Array.isArray(batch) && batch.length > 0) { baseParams = p; break; }
    }

    if (!baseParams) {
      return res.status(502).json({ error: 'ClickUp returned no tasks for this list.' });
    }

    // Paginate — ClickUp returns ≤100 per page
    const firstPage = await fetchPage(fetchUrl, { ...baseParams, page: 0 });
    let all  = [...(firstPage || [])];
    let page = 1;
    while (all.length === page * 100 && page < 20) {
      const batch = await fetchPage(fetchUrl, { ...baseParams, page });
      if (!batch || batch.length === 0) break;
      all = all.concat(batch);
      page++;
    }

    // Sort: parent tasks first, their subtasks directly after
    const byId    = Object.fromEntries(all.map(t => [t.id, t]));
    const parents = all.filter(t => !t.parent);
    const orphans = all.filter(t => t.parent && !byId[t.parent]);
    const ordered = [];
    for (const p of parents) {
      ordered.push(p);
      ordered.push(...all.filter(t => t.parent === p.id));
    }
    ordered.push(...orphans);
    res.json(ordered);
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// GET /api/clickup/task/:taskId — resolve a task by ID (for linking)
router.get('/task/:taskId', async (req, res) => {
  const { locationId } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  try {
    const r = await axios.get(`${CU}/task/${req.params.taskId}`, { headers: headers(key) });
    const t = r.data;
    res.json({ id: t.id, name: t.name, status: t.status?.status, url: t.url });
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// POST /api/clickup/task/:taskId/comment
router.post('/task/:taskId/comment', async (req, res) => {
  const { locationId } = req.query;
  const { comment_text } = req.body;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  try {
    const r = await axios.post(
      `${CU}/task/${req.params.taskId}/comment`,
      { comment_text, notify_all: false },
      { headers: headers(key) }
    );
    res.json(r.data);
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// GET /api/clickup/search?teamId=&q=
router.get('/search', async (req, res) => {
  const { locationId, teamId, q } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  if (!teamId) return res.status(400).json({ error: 'teamId required' });
  if (!q || !q.trim()) return res.json([]);
  try {
    const r = await axios.get(`${CU}/team/${teamId}/task`, {
      headers: headers(key),
      params: { query: q.trim(), include_closed: 'true', subtasks: 'true' },
    });
    res.json(r.data.tasks || []);
  } catch (e) {
    const { error, status } = cuErr(e);
    res.status(status).json({ error });
  }
});

// GET /api/clickup/debug/list/:listId — deep inspection
router.get('/debug/list/:listId', async (req, res) => {
  const { locationId } = req.query;
  const key = await getKey(locationId);
  if (!key) return res.status(401).json({ error: 'No ClickUp API key saved' });
  const listId = req.params.listId;
  const hdrs   = headers(key);
  const out    = { listId };

  // 1. List metadata
  try {
    const r = await axios.get(`${CU}/list/${listId}`, { headers: hdrs });
    out.listMeta = {
      id: r.data.id, name: r.data.name,
      task_count: r.data.task_count,
      permission_level: r.data.permission_level,
      folder: r.data.folder?.name,
      space: r.data.space?.name,
    };
  } catch (e) {
    out.listMetaError = e.response?.data?.err || e.message;
  }

  // 2. Task fetch — all param combos including include_timl
  const combos = [
    { include_timl: true, include_closed: true, subtasks: true },
    { include_timl: true, include_closed: true },
    { include_timl: true },
    { include_closed: true, subtasks: true },
    { include_closed: true },
    {},
  ];
  out.taskAttempts = [];
  for (const params of combos) {
    try {
      const r = await axios.get(`${CU}/list/${listId}/task`, { headers: hdrs, params });
      const tasks = r.data.tasks;
      out.taskAttempts.push({
        params, status: r.status,
        taskCount: Array.isArray(tasks) ? tasks.length : null,
        sample: tasks?.slice(0, 2).map(t => ({ id: t.id, name: t.name, parent: t.parent || null })),
      });
    } catch (e) {
      out.taskAttempts.push({ params, error: e.response?.data?.err || e.response?.data?.error || e.message });
    }
  }

  // 3. Can we read ANY tasks from this workspace at all?
  try {
    const teamR = await axios.get(`${CU}/team`, { headers: hdrs });
    const teams = teamR.data.teams || [];
    if (teams.length > 0) {
      out.teamId = teams[0].id;

      // 3a. No filter — just get whatever tasks this key can see
      const rawR = await axios.get(`${CU}/team/${out.teamId}/task`, { headers: hdrs, params: { page: 0 } });
      const rawTasks = rawR.data.tasks || [];
      out.unfiltered = {
        taskCount: rawTasks.length,
        sample: rawTasks.slice(0, 3).map(t => ({ id: t.id, name: t.name, list: t.list?.id })),
      };

      // 3b. Try list_ids[] filter with different array serializations
      const qs = (obj) => Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      const urlVariants = [
        `${CU}/team/${out.teamId}/task?list_ids[]=${listId}&include_closed=true&page=0`,
        `${CU}/team/${out.teamId}/task?list_ids=${listId}&include_closed=true&page=0`,
        `${CU}/team/${out.teamId}/task?list_ids[0]=${listId}&include_closed=true&page=0`,
      ];
      out.listFilterVariants = [];
      for (const url of urlVariants) {
        try {
          const r = await axios.get(url, { headers: hdrs });
          const tasks = r.data.tasks || [];
          out.listFilterVariants.push({ url: url.split('?')[1], taskCount: tasks.length,
            sample: tasks.slice(0, 2).map(t => ({ id: t.id, name: t.name })) });
          if (tasks.length > 0) break;
        } catch (e) {
          out.listFilterVariants.push({ url: url.split('?')[1], error: e.response?.data?.err || e.message });
        }
      }

      // 3c. Full raw payload if any variant worked
      const working = out.listFilterVariants.find(v => v.taskCount > 0);
      if (working) {
        const url = `${CU}/team/${out.teamId}/task?${working.url}`;
        const r = await axios.get(url, { headers: hdrs });
        const tasks = r.data.tasks || [];
        out.firstTaskRaw = tasks[0];
        out.allFields = [...new Set(tasks.slice(0, 5).flatMap(t => Object.keys(t)))];
      }
    }
  } catch (e) { out.teamTaskError = e.message; }

  res.json(out);
});

module.exports = router;
