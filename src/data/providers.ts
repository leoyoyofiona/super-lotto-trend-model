import type { DataStatus, DrawRecord } from '../types'
import { demoDraws } from './demoData'
import { normalizeNumbers, parseMoney } from '../model/features'

const FJTC_SOURCES = ['/fjtc-lottery/lottery', 'https://www.fjtc.com.cn/data_api/lottery']
const STATIC_SOURCES = ['/zhcw-chart/kj_dlt.json', 'https://www.zhcw.com/chartstatic/json/kj_dlt.json']

export async function loadDraws(): Promise<{ draws: DrawRecord[]; status: DataStatus }> {
  const errors: string[] = []
  let staleBackup: { draws: DrawRecord[]; status: DataStatus } | null = null

  for (const source of FJTC_SOURCES) {
    try {
      const params = new URLSearchParams({
        type: 'dlt',
        page: '1',
        limit: '100',
        so_start: '0',
        so_end: '0',
        gameNo: '85',
        provinceId: '0',
        pageSize: '100',
        isVerify: '1',
        termLimits: '0',
        t: String(Date.now()),
      })
      const response = await fetch(`${source}?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`${source} ${response.status}`)
      const payload = await response.json()
      const draws = parseFjtcLive(payload)
      if (draws.length >= 10) {
        const stale = isStale(draws[0]?.date, 7)
        return {
          draws,
          status: buildStatus(
            source.startsWith('/fjtc') ? '福建体彩网实时开奖接口' : '福建体彩网实时开奖接口（直连）',
            draws,
            stale,
          ),
        }
      }
      throw new Error('福建体彩网接口无有效大乐透数据')
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '福建体彩网实时接口失败')
    }
  }

  for (const source of STATIC_SOURCES) {
    try {
      const response = await fetch(`${source}?t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`${source} ${response.status}`)
      const payload = await response.json()
      const draws = parseZhcwStatic(payload)
      if (draws.length >= 10) {
        const stale = isStale(draws[0]?.date)
        const backup = {
          draws,
          status: buildStatus(source.includes('zhcw') ? '中彩网静态开奖缓存（备用）' : '本地代理数据源（备用）', draws, stale),
        }
        if (!stale) return backup
        staleBackup = backup
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '静态数据失败')
    }
  }

  try {
    const jsonpDraws = await fetchZhcwJsonp()
    if (jsonpDraws.length >= 10) {
      const stale = isStale(jsonpDraws[0]?.date, 7)
      return {
        draws: jsonpDraws,
        status: buildStatus('中彩网 JSONP 接口', jsonpDraws, stale),
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'JSONP接口失败')
  }

  if (staleBackup) {
    return {
      draws: staleBackup.draws,
      status: {
        ...staleBackup.status,
        stale: true,
        detail: `${staleBackup.status.detail}。实时接口暂不可用，这是过期备用数据，请勿作为最新开奖使用。`,
      },
    }
  }

  return {
    draws: demoDraws,
    status: {
      label: '内置演示数据',
      detail: `公开数据源暂不可用：${errors.slice(0, 2).join('；') || '网络失败'}。当前用于演示模型和图表，请导入最新数据后再投注参考。`,
      stale: true,
      updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    },
  }
}

export function parseImportedText(raw: string): DrawRecord[] {
  const text = raw.trim()
  if (!text) return []

  if (text.startsWith('{') || text.startsWith('[')) {
    const payload = JSON.parse(text)
    const maybeFjtc = parseFjtcLive(payload)
    if (maybeFjtc.length) return maybeFjtc
    const maybeZhcw = parseZhcwStatic(payload)
    if (maybeZhcw.length) return maybeZhcw
    const rows = Array.isArray(payload) ? payload : payload.draws
    if (Array.isArray(rows)) return rows.map(normalizeRecord).filter(Boolean) as DrawRecord[]
  }

  return parseCsv(text)
}

function parseCsv(text: string): DrawRecord[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(',').map((item) => item.trim().toLowerCase())
  const rows = lines.slice(1)

  return rows
    .map((line) => {
      const values = splitCsvLine(line)
      const get = (...keys: string[]) => {
        const index = headers.findIndex((header) => keys.includes(header))
        return index >= 0 ? values[index] : ''
      }
      return normalizeRecord({
        issue: get('issue', '期号', 'qh'),
        date: get('date', '开奖日期', 'kjsj'),
        front: get('front', '前区', 'kjjgqq'),
        back: get('back', '后区', 'kjjghq'),
        sales: get('sales', '销售额', 'qgxsje'),
        firstPrize: get('firstprize', '一等奖奖金', 'j1j'),
        pool: get('pool', '奖池', 'jcje'),
      })
    })
    .filter(Boolean) as DrawRecord[]
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

function normalizeRecord(record: Record<string, unknown>): DrawRecord | null {
  const issue = String(record.issue ?? record.qh ?? '').trim()
  const date = normalizeDate(record.date ?? record.kjsj ?? record.openTime)
  const front = normalizeNumbers(record.front ?? record.kjjgqq ?? record.frontWinningNum, 5, 35)
  const back = normalizeNumbers(record.back ?? record.kjjghq ?? record.backWinningNum, 2, 12)

  if (!issue || !date || front.length !== 5 || back.length !== 2) return null

  return {
    issue,
    date,
    week: getWeek(date),
    front,
    back,
    sales: parseMoney(record.sales ?? record.qgxsje ?? record.saleMoney),
    firstPrize: parseMoney(record.firstPrize ?? record.j1j),
    firstPrizeCount: parseMoney(record.firstPrizeCount ?? record.j1z),
    pool: parseMoney(record.pool ?? record.jcje ?? record.prizePoolMoney),
    source: String(record.source ?? '导入数据'),
  }
}

function parseFjtcLive(payload: unknown): DrawRecord[] {
  const rows =
    typeof payload === 'object' && payload && 'data' in payload
      ? (payload as { data?: unknown[] }).data
      : []
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const item = row as Record<string, unknown>
      const allNumbers = normalizeNumbers(item.lotteryDrawResult, 7, 35)
      const rawNumbers =
        typeof item.lotteryDrawResult === 'string'
          ? item.lotteryDrawResult
              .split(/\s+/)
              .map((value) => Number(value))
              .filter((value) => Number.isInteger(value))
          : allNumbers
      const front = rawNumbers.slice(0, 5).sort((a, b) => a - b)
      const back = rawNumbers.slice(5, 7).sort((a, b) => a - b)
      const firstPrize = Array.isArray(item.prizeLevelList)
        ? (item.prizeLevelList as Array<Record<string, unknown>>).find(
            (level) => level.prizeLevel === '一等奖' && String(level.awardType ?? '0') === '0',
          )
        : undefined

      return normalizeRecord({
        issue: item.lotteryDrawNum,
        date: item.lotteryDrawTime,
        front,
        back,
        sales: item.totalSaleAmount,
        firstPrize: firstPrize?.stakeAmount,
        firstPrizeCount: firstPrize?.stakeCount,
        pool: item.poolBalanceAfterdraw ?? item.poolBalance,
        source: '福建体彩网实时开奖接口',
      })
    })
    .filter((item): item is DrawRecord => Boolean(item))
    .sort(compareIssueDesc)
}

function parseZhcwStatic(payload: unknown): DrawRecord[] {
  const rows =
    typeof payload === 'object' && payload && 'zjxq' in payload
      ? (payload as { zjxq?: unknown[] }).zjxq
      : []
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const item = row as Record<string, unknown>
      const awards = Array.isArray(item.zjqkjd) ? (item.zjqkjd as Array<Record<string, unknown>>) : []
      const firstAward = awards[0]?.jbtz as Record<string, unknown> | undefined
      return normalizeRecord({
        issue: item.qh,
        date: item.kjsj,
        front: item.kjjgqq,
        back: item.kjjghq,
        sales: item.qgxsje,
        firstPrize: firstAward?.dzjj,
        firstPrizeCount: firstAward?.zjzs,
        pool: item.jcje,
      })
    })
    .filter((item): item is DrawRecord => Boolean(item))
    .sort(compareIssueDesc) as DrawRecord[]
}

function parseZhcwJsonpPayload(payload: unknown): DrawRecord[] {
  const rows =
    typeof payload === 'object' && payload && 'data' in payload
      ? (payload as { data?: unknown[] }).data
      : []
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const item = row as Record<string, unknown>
      const winnerDetails = Array.isArray(item.winnerDetails)
        ? (item.winnerDetails as Array<Record<string, unknown>>)
        : []
      const first = winnerDetails[0]?.baseBetWinner as Record<string, unknown> | undefined
      return normalizeRecord({
        issue: item.issue,
        date: item.openTime,
        front: item.frontWinningNum,
        back: item.backWinningNum,
        sales: item.saleMoney,
        firstPrize: first?.awardMoney,
        firstPrizeCount: first?.awardNum,
        pool: item.prizePoolMoney,
      })
    })
    .filter((item): item is DrawRecord => Boolean(item))
    .sort(compareIssueDesc) as DrawRecord[]
}

function fetchZhcwJsonp(): Promise<DrawRecord[]> {
  return new Promise((resolve, reject) => {
    const callback = `__dlt_jsonp_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    const params = new URLSearchParams({
      transactionType: '10001001',
      lotteryId: '281',
      issueCount: '100',
      startIssue: '',
      endIssue: '',
      startDate: '',
      endDate: '',
      type: '0',
      pageNum: '1',
      pageSize: '100',
      tt: String(Math.random()),
      callback,
    })
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('JSONP接口超时'))
    }, 8000)

    function cleanup() {
      window.clearTimeout(timeout)
      script.remove()
      delete (window as unknown as Record<string, unknown>)[callback]
    }

    ;(window as unknown as Record<string, unknown>)[callback] = (payload: unknown) => {
      cleanup()
      resolve(parseZhcwJsonpPayload(payload))
    }

    script.onerror = () => {
      cleanup()
      reject(new Error('JSONP脚本加载失败'))
    }
    script.src = `https://jc.zhcw.com/port/client_json.php?${params.toString()}`
    document.head.appendChild(script)
  })
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const match = trimmed.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!match) return trimmed
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function compareIssueDesc(a: DrawRecord, b: DrawRecord) {
  return Number(b.issue) - Number(a.issue)
}

function getWeek(date: string) {
  return ['日', '一', '二', '三', '四', '五', '六'][new Date(`${date}T00:00:00`).getDay()]
}

function buildStatus(label: string, draws: DrawRecord[], stale: boolean): DataStatus {
  return {
    label,
    detail: `${draws.length}期，最新期号 ${draws[0]?.issue ?? '-'}，开奖日期 ${draws[0]?.date ?? '-'}`,
    stale,
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  }
}

function isStale(date?: string, maxAgeDays = 45) {
  if (!date) return true
  const diff = Date.now() - new Date(`${date}T00:00:00`).getTime()
  return diff > 1000 * 60 * 60 * 24 * maxAgeDays
}
