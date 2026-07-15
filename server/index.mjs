import { createReadStream, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = resolve(rootDir, 'dist')
const port = Number(process.env.PORT || 3000)
const lotteryApiBase = 'https://www.fjtc.com.cn/data_api/lottery'
const visitCounterFile = resolve(process.env.VISIT_COUNTER_FILE || join(rootDir, '.data', 'visit-counter.json'))
const visitDatabaseUrl = process.env.VISIT_DATABASE_URL || process.env.DATABASE_URL || ''
const visitBaseline = {
  totalVisits: normalizeCount(process.env.VISIT_BASELINE_TOTAL),
  uniqueVisitors: normalizeCount(process.env.VISIT_BASELINE_UNIQUE),
  startedAt: process.env.VISIT_BASELINE_STARTED_AT || '2026-06-28T10:11:49Z',
}
const { Pool } = pg
let visitPool = null
let visitSchemaReady = null
let visitState = null
let visitUpdateQueue = Promise.resolve()
let visitWriteQueue = Promise.resolve()

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

    if (requestUrl.pathname === '/healthz') {
      sendText(res, 200, 'ok')
      return
    }

    if (requestUrl.pathname.startsWith('/fjtc-lottery/')) {
      await proxyLotteryRequest(requestUrl, res)
      return
    }

    if (requestUrl.pathname === '/api/visits') {
      await handleVisitRequest(req, res)
      return
    }

    await serveStatic(requestUrl.pathname, res)
  } catch (error) {
    console.error(error)
    sendJson(res, 500, { code: 500, message: 'Internal server error' })
  }
})

server.listen(port, () => {
  console.log(`Super Lotto app listening on ${port}`)
})

async function proxyLotteryRequest(requestUrl, res) {
  const target = new URL(lotteryApiBase)
  target.search = requestUrl.search

  const response = await fetch(target, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      referer: 'https://www.fjtc.com.cn/node_309522.htm?gameType=dlt',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    },
  })

  const body = await response.text()
  res.writeHead(response.status, {
    'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  })
  res.end(body)
}

async function handleVisitRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
    })
    res.end()
    return
  }

  if (req.method === 'GET') {
    sendJson(res, 200, await loadVisitState(), { 'cache-control': 'no-store' })
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { code: 405, message: 'Method not allowed' })
    return
  }

  const payload = await readJsonBody(req)
  const visitorId = normalizeVisitorId(payload?.visitorId)
  const state = await recordVisit(visitorId)
  sendJson(res, 200, state, { 'cache-control': 'no-store' })
}

async function serveStatic(pathname, res) {
  const normalizedPath = decodeURIComponent(pathname).replace(/^\/+/, '')
  const requestedPath = normalizedPath ? resolve(distDir, normalizedPath) : join(distDir, 'index.html')
  const filePath = requestedPath.startsWith(distDir) ? requestedPath : join(distDir, 'index.html')

  if (existsSync(filePath) && (await stat(filePath)).isFile()) {
    streamFile(filePath, res)
    return
  }

  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    sendText(res, 404, 'Build output not found. Run npm run build first.')
    return
  }
  const html = await readFile(indexPath)
  res.writeHead(200, { 'content-type': mimeTypes['.html'], 'cache-control': 'no-cache' })
  res.end(html)
}

function streamFile(filePath, res) {
  const extension = extname(filePath).toLowerCase()
  res.writeHead(200, {
    'content-type': mimeTypes[extension] ?? 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(res)
}

async function loadVisitState() {
  if (visitDatabaseUrl) {
    try {
      return toPublicVisitState(await loadDatabaseVisitState())
    } catch (error) {
      console.error('Database visit counter unavailable, falling back to file storage.', error)
    }
  }

  return toPublicVisitState(await loadFileVisitState())
}

async function loadFileVisitState() {
  if (visitState) return visitState

  try {
    const raw = await readFile(visitCounterFile, 'utf8')
    const parsed = JSON.parse(raw)
    visitState = {
      totalVisits: normalizeCount(parsed.totalVisits),
      visitors: new Set(Array.isArray(parsed.visitors) ? parsed.visitors.filter((item) => typeof item === 'string') : []),
      lastVisitAt: typeof parsed.lastVisitAt === 'string' ? parsed.lastVisitAt : null,
    }
  } catch {
    visitState = {
      totalVisits: 0,
      visitors: new Set(),
      lastVisitAt: null,
    }
  }

  return visitState
}

async function saveVisitState(state) {
  const payload = {
    totalVisits: state.totalVisits,
    uniqueVisitors: state.visitors.size,
    visitors: [...state.visitors],
    lastVisitAt: state.lastVisitAt,
  }

  visitWriteQueue = visitWriteQueue.then(async () => {
    await mkdir(dirname(visitCounterFile), { recursive: true })
    await writeFile(visitCounterFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  })

  await visitWriteQueue
}

function recordVisit(visitorId) {
  const operation = visitUpdateQueue.then(async () => {
    if (visitDatabaseUrl) {
      try {
        return toPublicVisitState(await recordDatabaseVisit(visitorId))
      } catch (error) {
        console.error('Database visit counter unavailable, falling back to file storage.', error)
      }
    }

    const state = await loadFileVisitState()

    state.totalVisits += 1
    state.lastVisitAt = new Date().toISOString()

    if (visitorId) {
      const visitorHash = hashVisitorId(visitorId)
      if (!state.visitors.has(visitorHash)) state.visitors.add(visitorHash)
    }

    await saveVisitState(state)
    return toPublicVisitState(state)
  })

  visitUpdateQueue = operation.catch(() => {})
  return operation
}

function toPublicVisitState(state) {
  const uniqueVisitors =
    typeof state.uniqueVisitors === 'number' ? state.uniqueVisitors : state.visitors?.size ?? 0

  return {
    totalVisits: visitBaseline.totalVisits + state.totalVisits,
    uniqueVisitors: visitBaseline.uniqueVisitors + uniqueVisitors,
    currentPeriodVisits: state.totalVisits,
    currentPeriodUniqueVisitors: uniqueVisitors,
    baselineTotalVisits: visitBaseline.totalVisits,
    baselineUniqueVisitors: visitBaseline.uniqueVisitors,
    baselineStartedAt: visitBaseline.startedAt,
    lastVisitAt: state.lastVisitAt,
  }
}

async function loadDatabaseVisitState() {
  await ensureVisitSchema()
  const client = await getVisitPool().connect()

  try {
    const [counterResult, visitorsResult] = await Promise.all([
      client.query("select total_visits, last_visit_at from visit_counter where key = 'global'"),
      client.query('select count(*)::int as unique_visitors from visit_visitors'),
    ])
    const counter = counterResult.rows[0]

    return {
      totalVisits: normalizeCount(counter?.total_visits),
      uniqueVisitors: normalizeCount(visitorsResult.rows[0]?.unique_visitors),
      lastVisitAt: counter?.last_visit_at ? new Date(counter.last_visit_at).toISOString() : null,
    }
  } finally {
    client.release()
  }
}

async function recordDatabaseVisit(visitorId) {
  await ensureVisitSchema()
  const client = await getVisitPool().connect()

  try {
    await client.query('begin')

    if (visitorId) {
      await client.query(
        'insert into visit_visitors (visitor_hash, first_seen_at) values ($1, now()) on conflict (visitor_hash) do nothing',
        [hashVisitorId(visitorId)],
      )
    }

    const counterResult = await client.query(`
      insert into visit_counter (key, total_visits, last_visit_at)
      values ('global', 1, now())
      on conflict (key)
      do update set
        total_visits = visit_counter.total_visits + 1,
        last_visit_at = excluded.last_visit_at
      returning total_visits, last_visit_at
    `)
    const visitorsResult = await client.query('select count(*)::int as unique_visitors from visit_visitors')
    await client.query('commit')

    const counter = counterResult.rows[0]
    return {
      totalVisits: normalizeCount(counter?.total_visits),
      uniqueVisitors: normalizeCount(visitorsResult.rows[0]?.unique_visitors),
      lastVisitAt: counter?.last_visit_at ? new Date(counter.last_visit_at).toISOString() : null,
    }
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function ensureVisitSchema() {
  if (visitSchemaReady) return visitSchemaReady

  visitSchemaReady = (async () => {
    await getVisitPool().query(`
      create table if not exists visit_counter (
        key text primary key,
        total_visits integer not null default 0,
        last_visit_at timestamptz
      );

      create table if not exists visit_visitors (
        visitor_hash text primary key,
        first_seen_at timestamptz not null default now()
      );
    `)
  })()

  return visitSchemaReady
}

function getVisitPool() {
  if (!visitPool) {
    visitPool = new Pool({
      connectionString: visitDatabaseUrl,
      max: 4,
      ssl: shouldUsePostgresSsl(visitDatabaseUrl) ? { rejectUnauthorized: false } : undefined,
    })
  }

  return visitPool
}

function shouldUsePostgresSsl(connectionString) {
  try {
    const host = new URL(connectionString).hostname
    return host !== 'localhost' && host !== '127.0.0.1'
  } catch {
    return true
  }
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 4096) {
        rejectBody(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!body.trim()) {
        resolveBody({})
        return
      }

      try {
        resolveBody(JSON.parse(body))
      } catch {
        resolveBody({})
      }
    })
    req.on('error', rejectBody)
  })
}

function normalizeVisitorId(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!/^[a-zA-Z0-9:_-]{12,160}$/.test(normalized)) return null
  return normalized
}

function hashVisitorId(visitorId) {
  return createHash('sha256').update(visitorId).digest('hex')
}

function normalizeCount(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders })
  res.end(JSON.stringify(payload))
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(text)
}
