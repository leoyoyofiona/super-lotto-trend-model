import type { BallArea, DrawFeatures, DrawRecord, NumberStat } from '../types'

const FRONT_MAX = 35
const BACK_MAX = 12
const PRIME_SET = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31])

export function padBall(value: number) {
  return String(value).padStart(2, '0')
}

export function formatMoney(value: number | null | undefined, compact = false) {
  if (value == null || Number.isNaN(value)) return '-'
  if (compact && Math.abs(value) >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`
  }
  if (compact && Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  return new Intl.NumberFormat('zh-CN').format(Math.round(value))
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const normalized = value.replace(/[,\s元]/g, '')
  if (!normalized || normalized === '-' || normalized === '--') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeNumbers(input: unknown, expected: number, max: number) {
  if (Array.isArray(input)) {
    return input
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= max)
      .slice(0, expected)
      .sort((a, b) => a - b)
  }

  if (typeof input === 'string') {
    return input
      .split(/[,\s+|/]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= max)
      .slice(0, expected)
      .sort((a, b) => a - b)
  }

  return []
}

export function getAcValue(numbers: number[]) {
  const diffs = new Set<number>()
  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      diffs.add(Math.abs(numbers[j] - numbers[i]))
    }
  }
  return Math.max(0, diffs.size - (numbers.length - 1))
}

function countConsecutivePairs(numbers: number[]) {
  return numbers.reduce((count, item, index) => {
    if (index === 0) return count
    return item - numbers[index - 1] === 1 ? count + 1 : count
  }, 0)
}

function countSameTailGroups(numbers: number[]) {
  const tails = new Map<number, number>()
  numbers.forEach((number) => tails.set(number % 10, (tails.get(number % 10) ?? 0) + 1))
  return Array.from(tails.values()).filter((count) => count >= 2).length
}

function zoneCount(number: number) {
  if (number <= 12) return 1
  if (number <= 24) return 2
  return 3
}

function routeCounts(numbers: number[]) {
  return numbers.reduce(
    (acc, number) => {
      acc[number % 3] += 1
      return acc
    },
    [0, 0, 0],
  )
}

function getRelations(current: number[], previous?: number[]) {
  if (!previous) return { repeatCount: 0, neighborCount: 0 }
  const prevSet = new Set(previous)
  const neighborSet = new Set(previous.flatMap((item) => [item - 1, item + 1]))
  return {
    repeatCount: current.filter((item) => prevSet.has(item)).length,
    neighborCount: current.filter((item) => neighborSet.has(item) && !prevSet.has(item)).length,
  }
}

export function buildFeatures(draws: DrawRecord[]): DrawFeatures[] {
  const chronological = [...draws].reverse()
  const featureByIssue = new Map<string, DrawFeatures>()

  chronological.forEach((draw, index) => {
    const previous = chronological[index - 1]
    const [route0, route1, route2] = routeCounts(draw.front)
    const relations = getRelations(draw.front, previous?.front)
    const zones = draw.front.reduce(
      (acc, number) => {
        acc[zoneCount(number) - 1] += 1
        return acc
      },
      [0, 0, 0],
    )

    featureByIssue.set(draw.issue, {
      issue: draw.issue,
      date: draw.date,
      frontSum: sum(draw.front),
      backSum: sum(draw.back),
      frontSpan: Math.max(...draw.front) - Math.min(...draw.front),
      backSpan: range(draw.back),
      frontAc: getAcValue(draw.front),
      backAc: getAcValue(draw.back),
      frontOdd: draw.front.filter((number) => number % 2 === 1).length,
      frontEven: draw.front.filter((number) => number % 2 === 0).length,
      backOdd: draw.back.filter((number) => number % 2 === 1).length,
      backEven: draw.back.filter((number) => number % 2 === 0).length,
      frontBig: draw.front.filter((number) => number >= 18).length,
      frontSmall: draw.front.filter((number) => number <= 17).length,
      backBig: draw.back.filter((number) => number >= 7).length,
      backSmall: draw.back.filter((number) => number <= 6).length,
      frontPrime: draw.front.filter((number) => PRIME_SET.has(number)).length,
      frontComposite: draw.front.filter((number) => !PRIME_SET.has(number)).length,
      frontRoute0: route0,
      frontRoute1: route1,
      frontRoute2: route2,
      zone1: zones[0],
      zone2: zones[1],
      zone3: zones[2],
      consecutivePairs: countConsecutivePairs(draw.front),
      repeatCount: relations.repeatCount,
      neighborCount: relations.neighborCount,
      sameTailGroups: countSameTailGroups(draw.front),
    })
  })

  return draws.map((draw) => featureByIssue.get(draw.issue)).filter(Boolean) as DrawFeatures[]
}

export function buildNumberStats(draws: DrawRecord[], area: BallArea, maxOverride?: number, startOverride = 1): NumberStat[] {
  const max = maxOverride ?? (area === 'front' ? FRONT_MAX : BACK_MAX)
  const picksPerDraw = maxOverride ? (draws[0]?.front.length ?? 1) : area === 'front' ? 5 : 2
  const source = draws.map((draw) => (area === 'front' ? draw.front : draw.back))
  const chronological = [...source].reverse()

  return Array.from({ length: max - startOverride + 1 }, (_, index) => {
    const number = index + startOverride
    const hits = chronological.map((numbers) => numbers.includes(number))
    const total = hits.filter(Boolean).length
    const currentOmission = getCurrentOmission(hits)
    const omissionRuns = getOmissionRuns(hits)
    const maxOmission = Math.max(0, ...omissionRuns)
    const theoreticalAverage = Math.max(1, Math.round(max / picksPerDraw) - 1)
    const averageOmission =
      omissionRuns.length > 0
        ? omissionRuns.reduce((acc, item) => acc + item, 0) / omissionRuns.length
        : theoreticalAverage

    const recent10 = countRecent(source, number, 10)
    const recent30 = countRecent(source, number, 30)
    const recent100 = countRecent(source, number, 100)
    const heatScore = recent30 / Math.max(1, Math.min(30, draws.length))
    const omissionScore = Math.min(1.8, currentOmission / Math.max(1, averageOmission))

    return {
      area,
      number,
      recent10,
      recent30,
      recent100,
      total,
      currentOmission,
      maxOmission,
      averageOmission,
      heatScore,
      omissionScore,
      label: heatScore >= picksPerDraw / max * 1.35 ? '热' : omissionScore >= 1.45 ? '冷' : '温',
    }
  })
}

export function buildTrendRows(draws: DrawRecord[], features: DrawFeatures[]) {
  const ascendingFeatures = [...features].reverse()
  return ascendingFeatures.map((feature, index) => {
    const slice = ascendingFeatures.slice(Math.max(0, index - 9), index + 1)
    const movingSum = average(slice.map((item) => item.frontSum))
    const movingSpan = average(slice.map((item) => item.frontSpan))
    return {
      issue: feature.issue,
      date: feature.date.slice(5),
      frontSum: feature.frontSum,
      movingSum: Number(movingSum.toFixed(1)),
      frontSpan: feature.frontSpan,
      movingSpan: Number(movingSpan.toFixed(1)),
      oddEven: `${feature.frontOdd}:${feature.frontEven}`,
      oddCount: feature.frontOdd,
      ac: feature.frontAc,
      consecutivePairs: feature.consecutivePairs,
      pool: draws.find((draw) => draw.issue === feature.issue)?.pool ?? 0,
    }
  })
}

export function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * percentileValue)))
  return sorted[index]
}

export function sum(numbers: number[]) {
  return numbers.reduce((acc, number) => acc + number, 0)
}

function range(numbers: number[]) {
  if (!numbers.length) return 0
  return Math.max(...numbers) - Math.min(...numbers)
}

export function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

function countRecent(source: number[][], number: number, windowSize: number) {
  return source.slice(0, windowSize).filter((numbers) => numbers.includes(number)).length
}

function getCurrentOmission(hits: boolean[]) {
  let count = 0
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    if (hits[i]) break
    count += 1
  }
  return count
}

function getOmissionRuns(hits: boolean[]) {
  const runs: number[] = []
  let current = 0
  hits.forEach((hit) => {
    if (hit) {
      runs.push(current)
      current = 0
    } else {
      current += 1
    }
  })
  runs.push(current)
  return runs
}
