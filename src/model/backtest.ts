import type { DrawRecord, PredictionHitRecord, PredictionTicket } from '../types'
import { buildFeatures, buildNumberStats } from './features'
import { buildPredictions } from './prediction'

const MIN_HISTORY_DRAWS = 10
const TOTAL_BALLS = 7

export function buildPredictionHitRows(
  draws: DrawRecord[],
  visibleLimit: number,
  baseSeed: number,
): PredictionHitRecord[] {
  const visibleDraws = draws.slice(0, visibleLimit)

  return visibleDraws.flatMap((draw, index) => {
    const priorDraws = draws.slice(index + 1)
    if (priorDraws.length < MIN_HISTORY_DRAWS) return []

    const features = buildFeatures(priorDraws)
    const frontStats = buildNumberStats(priorDraws, 'front')
    const backStats = buildNumberStats(priorDraws, 'back')
    const model = buildPredictions(
      priorDraws,
      features,
      frontStats,
      backStats,
      getBacktestSeed(baseSeed, draw.issue, index),
    )

    const ticketHits = model.tickets.map((ticket) => compareTicket(ticket, draw))
    const primary = ticketHits[0]
    const best = [...ticketHits].sort((a, b) => b.totalHits - a.totalHits || b.backHits - a.backHits)[0]
    const averageTotalHits =
      ticketHits.reduce((acc, item) => acc + item.totalHits, 0) / Math.max(1, ticketHits.length)

    return [{
      issue: draw.issue,
      recommended: primary.ticket,
      frontHits: primary.frontHits,
      backHits: primary.backHits,
      totalHits: primary.totalHits,
      hitRate: primary.hitRate,
      bestTicket: {
        name: best.ticket.name,
        frontHits: best.frontHits,
        backHits: best.backHits,
        totalHits: best.totalHits,
        hitRate: best.hitRate,
      },
      averageTotalHits: Number(averageTotalHits.toFixed(2)),
      averageHitRate: Number(((averageTotalHits / TOTAL_BALLS) * 100).toFixed(1)),
      evaluatedTicketCount: ticketHits.length,
    }]
  })
}

function compareTicket(ticket: PredictionTicket, draw: DrawRecord) {
  const frontHits = countHits(ticket.front, draw.front)
  const backHits = countHits(ticket.back, draw.back)
  const totalHits = frontHits + backHits

  return {
    ticket,
    frontHits,
    backHits,
    totalHits,
    hitRate: Number(((totalHits / TOTAL_BALLS) * 100).toFixed(1)),
  }
}

function countHits(predicted: number[], actual: number[]) {
  const actualSet = new Set(actual)
  return predicted.filter((number) => actualSet.has(number)).length
}

function getBacktestSeed(baseSeed: number, issue: string, index: number) {
  const issueSeed = Number(issue.replace(/\D/g, '')) || 0
  return baseSeed + issueSeed + index * 100003
}
