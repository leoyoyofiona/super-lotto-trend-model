import { createReadStream, existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = resolve(rootDir, 'dist')
const port = Number(process.env.PORT || 3000)
const lotteryApiBase = 'https://www.fjtc.com.cn/data_api/lottery'

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(text)
}
