import type { DrawFeatures, DrawRecord, ModelResult, NumberStat, PredictionTicket } from '../types'
import { getAcValue, percentile, sum } from './features'
import type { LotteryConfig } from '../data/lotteries'

const STRATEGIES = [
  { name: '智能推荐', hot: 0.46, omission: 0.34, momentum: 0.2, coldBias: 0.06 },
  { name: '热号优先', hot: 0.62, omission: 0.22, momentum: 0.16, coldBias: -0.04 },
  { name: '冷号修复', hot: 0.32, omission: 0.52, momentum: 0.16, coldBias: 0.22 },
  { name: '均衡结构', hot: 0.4, omission: 0.38, momentum: 0.22, coldBias: 0.02 },
  { name: '跨度约束', hot: 0.42, omission: 0.36, momentum: 0.22, coldBias: 0.08 },
]

export function buildPredictions(
  draws: DrawRecord[],
  features: DrawFeatures[],
  frontStats: NumberStat[],
  backStats: NumberStat[],
  seed: number,
  config?: LotteryConfig,
): ModelResult {
  if (config?.mode === 'digits') return buildDigitPredictions(draws, frontStats, seed, config)
  const frontSums = features.map((feature) => feature.frontSum)
  const lowSum = percentile(frontSums, 0.18) || 70
  const highSum = percentile(frontSums, 0.82) || 145
  const spans = features.map((feature) => feature.frontSpan)
  const lowSpan = percentile(spans, 0.12) || 12
  const highSpan = percentile(spans, 0.88) || 32
  const latest = draws[0]

  const tickets = STRATEGIES.map((strategy, index) => {
    const random = mulberry32(seed + index * 1009)
    const front = pickNumbers(frontStats, 5, strategy, random, latest?.front ?? [], {
      minSum: lowSum,
      maxSum: highSum,
      minSpan: lowSpan,
      maxSpan: highSpan,
      max: 35,
      area: 'front',
    })
    const back = pickNumbers(backStats, 2, strategy, random, latest?.back ?? [], {
      minSum: 3,
      maxSum: 21,
      minSpan: 1,
      maxSpan: 11,
      max: 12,
      area: 'back',
    })

    return createTicket(index + 1, strategy.name, front, back, frontStats, backStats, features)
  })

  const avgConfidence =
    tickets.reduce((acc, item) => acc + item.confidence, 0) / Math.max(1, tickets.length)

  return {
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    seed,
    confidence: Number(avgConfidence.toFixed(1)),
    riskLabel: avgConfidence >= 68 ? '中等偏上' : avgConfidence >= 58 ? '中等' : '偏高',
    tickets,
    notes: [
      '模型使用频次、遗漏、和值、跨度、AC值、分区、奇偶、大小、邻号和重号等统计特征加权。',
      '彩票开奖具有强随机性，任何模型都不能保证命中；本结果只适合做号码筛选和复盘参考。',
    ],
  }
}

function buildDigitPredictions(draws: DrawRecord[], stats: NumberStat[], seed: number, config: LotteryConfig): ModelResult {
  const tickets = STRATEGIES.map((strategy, index) => {
    const random = mulberry32(seed + index * 1009)
    const scored = stats.map((stat) => ({ stat, score: stat.heatScore * strategy.hot + Math.min(1.7, stat.omissionScore) * strategy.omission + random() * 0.08 }))
    const digits = config.id === 'pl5'
      ? Array.from({ length: config.count }, (_, position) => selectPositionDigit(draws, position, strategy, seed + index * 1009 + position * 131))
      : Array.from({ length: config.count }, () => selectWeightedDigit(scored, random))
    const sumValue = sum(digits)
    const span = Math.max(...digits) - Math.min(...digits)
    const repeated = digits.length - new Set(digits).size
    const score = scored.filter((item) => digits.includes(item.stat.number)).reduce((acc, item) => acc + item.score, 0) / Math.max(1, digits.length)
    const confidence = Number(clamp(48 + score * 18 + (repeated > 0 ? 3 : 0), 42, 76).toFixed(1))
    return { id: index + 1, name: strategy.name, front: digits, back: [], score: Number(score.toFixed(2)), confidence, rationale: [`和值${sumValue}`, `跨度${span}`, `重复数字${repeated}位`], featureSummary: { oddEven: `${digits.filter((digit) => digit % 2).length}:${digits.filter((digit) => digit % 2 === 0).length}`, bigSmall: '-', frontSum: sumValue, frontSpan: span, zones: '-', ac: getAcValue(digits) } }
  })
  const confidence = tickets.reduce((acc, item) => acc + item.confidence, 0) / tickets.length
  return { generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }), seed, confidence: Number(confidence.toFixed(1)), riskLabel: confidence >= 68 ? '中等偏上' : confidence >= 58 ? '中等' : '偏高', tickets, notes: [config.id === 'pl5' ? '排列5前3位与排列3共享定位逻辑，后2位独立分析生成。' : '模型使用定位频次、遗漏、和值、跨度、重复和奇偶等特征加权。', '数字型彩票具有强随机性，结果只适合统计分析和复盘。'] }
}

function selectWeightedDigit(scored: Array<{ stat: NumberStat; score: number }>, random: () => number) {
  const total = scored.reduce((acc, item) => acc + Math.max(0.02, item.score), 0)
  let cursor = random() * total
  for (const item of scored) {
    cursor -= Math.max(0.02, item.score)
    if (cursor <= 0) return item.stat.number
  }
  return scored[0]?.stat.number ?? 0
}

function selectPositionDigit(draws: DrawRecord[], position: number, strategy: Strategy, seed: number) {
  const random = mulberry32(seed)
  const values = draws.map((draw) => draw.front[position]).filter((value) => Number.isInteger(value) && value >= 0 && value <= 9)
  const recent = values.slice(0, 30)
  const scored = Array.from({ length: 10 }, (_, digit) => {
    const recentCount = recent.filter((value) => value === digit).length
    let omission = values.findIndex((value) => value === digit)
    if (omission < 0) omission = values.length
    const score = (recentCount / Math.max(1, recent.length)) * strategy.hot + (1 + omission) * strategy.omission / Math.max(10, values.length) + random() * 0.08
    return { stat: { number: digit } as NumberStat, score }
  })
  return selectWeightedDigit(scored, random)
}

interface PickConstraints {
  minSum: number
  maxSum: number
  minSpan: number
  maxSpan: number
  max: number
  area: 'front' | 'back'
}

interface Strategy {
  name: string
  hot: number
  omission: number
  momentum: number
  coldBias: number
}

function pickNumbers(
  stats: NumberStat[],
  count: number,
  strategy: Strategy,
  random: () => number,
  previous: number[],
  constraints: PickConstraints,
) {
  const previousSet = new Set(previous)
  const scored = stats
    .map((stat) => ({
      ...stat,
      score:
        stat.heatScore * strategy.hot +
        Math.min(1.7, stat.omissionScore) * strategy.omission +
        ((stat.recent10 + 1) / (stat.recent30 + 2)) * strategy.momentum +
        (stat.label === '冷' ? strategy.coldBias : 0) +
        (previousSet.has(stat.number) ? 0.06 : 0) +
        random() * 0.08,
    }))
    .sort((a, b) => b.score - a.score)

  let best = scored.slice(0, count).map((item) => item.number)
  let bestScore = -Infinity

  for (let attempt = 0; attempt < 280; attempt += 1) {
    const poolSize = Math.min(scored.length, count + 9 + Math.floor(attempt / 35))
    const candidate = weightedSample(scored.slice(0, poolSize), count, random).sort((a, b) => a - b)
    const structural = structuralScore(candidate, constraints)
    const statScore = candidate.reduce(
      (acc, number) => acc + (scored.find((item) => item.number === number)?.score ?? 0),
      0,
    )
    const score = statScore + structural
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best.sort((a, b) => a - b)
}

function weightedSample(
  scored: Array<NumberStat & { score: number }>,
  count: number,
  random: () => number,
) {
  const picked = new Set<number>()
  while (picked.size < count && picked.size < scored.length) {
    const total = scored.reduce(
      (acc, item) => acc + (picked.has(item.number) ? 0 : Math.max(0.02, item.score)),
      0,
    )
    let cursor = random() * total
    for (const item of scored) {
      if (picked.has(item.number)) continue
      cursor -= Math.max(0.02, item.score)
      if (cursor <= 0) {
        picked.add(item.number)
        break
      }
    }
  }
  return [...picked]
}

function structuralScore(numbers: number[], constraints: PickConstraints) {
  const valueSum = sum(numbers)
  const span = Math.max(...numbers) - Math.min(...numbers)
  const odd = numbers.filter((number) => number % 2 === 1).length
  const big = numbers.filter((number) =>
    constraints.area === 'front' ? number >= 18 : number >= 7,
  ).length

  let score = 0
  if (valueSum >= constraints.minSum && valueSum <= constraints.maxSum) score += 0.35
  if (span >= constraints.minSpan && span <= constraints.maxSpan) score += 0.28
  if (constraints.area === 'front' && (odd === 2 || odd === 3)) score += 0.16
  if (constraints.area === 'front' && big >= 1 && big <= 4) score += 0.12
  if (constraints.area === 'front') {
    const zones = [0, 0, 0]
    numbers.forEach((number) => {
      if (number <= 12) zones[0] += 1
      else if (number <= 24) zones[1] += 1
      else zones[2] += 1
    })
    if (zones.every((item) => item > 0)) score += 0.12
    if (getAcValue(numbers) >= 4) score += 0.08
  }
  return score
}

function createTicket(
  id: number,
  name: string,
  front: number[],
  back: number[],
  frontStats: NumberStat[],
  backStats: NumberStat[],
  features: DrawFeatures[],
): PredictionTicket {
  const frontScore = averageStatScore(front, frontStats)
  const backScore = averageStatScore(back, backStats)
  const odd = front.filter((number) => number % 2 === 1).length
  const big = front.filter((number) => number >= 18).length
  const zones = [
    front.filter((number) => number <= 12).length,
    front.filter((number) => number >= 13 && number <= 24).length,
    front.filter((number) => number >= 25).length,
  ]
  const frontSum = sum(front)
  const span = Math.max(...front) - Math.min(...front)
  const historicalSums = features.map((feature) => feature.frontSum)
  const inSumBand =
    frontSum >= (percentile(historicalSums, 0.18) || 70) &&
    frontSum <= (percentile(historicalSums, 0.82) || 145)

  const confidence = clamp(
    48 + frontScore * 15 + backScore * 12 + (inSumBand ? 7 : 0) + (zones.every(Boolean) ? 4 : 0),
    42,
    76,
  )

  return {
    id,
    name,
    front,
    back,
    score: Number((frontScore + backScore).toFixed(2)),
    confidence: Number(confidence.toFixed(1)),
    rationale: [
      `和值${frontSum}${inSumBand ? '落在历史主区间' : '偏离主区间'}`,
      `奇偶${odd}:${5 - odd}，大小${big}:${5 - big}`,
      `分区${zones.join(':')}，AC值${getAcValue(front)}`,
    ],
    featureSummary: {
      oddEven: `${odd}:${5 - odd}`,
      bigSmall: `${5 - big}:${big}`,
      frontSum,
      frontSpan: span,
      zones: zones.join(':'),
      ac: getAcValue(front),
    },
  }
}

function averageStatScore(numbers: number[], stats: NumberStat[]) {
  const scores = numbers.map((number) => {
    const stat = stats.find((item) => item.number === number)
    if (!stat) return 0
    return stat.heatScore * 0.6 + Math.min(1.6, stat.omissionScore) * 0.4
  })
  return scores.reduce((acc, item) => acc + item, 0) / Math.max(1, scores.length)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
