import { Download, Search } from 'lucide-react'
import type { DrawRecord, PredictionHitRecord } from '../types'
import { formatMoney } from '../model/features'
import { BallGroup } from './NumberBall'
import type { LotteryConfig } from '../data/lotteries'

interface HistoryTableProps {
  draws: DrawRecord[]
  limit: number
  hitRows: PredictionHitRecord[]
  onLimitChange: (limit: number) => void
  lottery: LotteryConfig
}

export function HistoryTable({ draws, limit, hitRows, onLimitChange, lottery }: HistoryTableProps) {
  const visible = draws.slice(0, limit)
  const hitRowsByIssue = new Map(hitRows.map((row) => [row.issue, row]))
  const visibleHitRows = visible
    .map((draw) => hitRowsByIssue.get(draw.issue))
    .filter((row): row is PredictionHitRecord => Boolean(row))
  const hitSummary = getHitSummary(visibleHitRows)

  function exportCsv() {
    const header = [
      'issue',
      'date',
      'front',
      'back',
      'recommendedFront',
      'recommendedBack',
      'frontHits',
      'backHits',
      'totalHits',
      'hitRate',
      'bestTicketTotalHits',
      'averageHitRate',
      'sales',
      'firstPrize',
      'pool',
    ]
    const rows = visible.map((draw) => {
      const hit = hitRowsByIssue.get(draw.issue)
      return [
        draw.issue,
        draw.date,
        draw.front.map((item) => formatLotteryNumber(item, lottery)).join(' '),
        draw.back.map((item) => formatLotteryNumber(item, lottery)).join(' '),
        hit?.recommended.front.map((item) => formatLotteryNumber(item, lottery)).join(' ') ?? '',
        hit?.recommended.back.map((item) => formatLotteryNumber(item, lottery)).join(' ') ?? '',
        hit?.frontHits ?? '',
        hit?.backHits ?? '',
        hit?.totalHits ?? '',
        hit?.hitRate ?? '',
        hit?.bestTicket.totalHits ?? '',
        hit?.averageHitRate ?? '',
        draw.sales ?? '',
        draw.firstPrize ?? '',
        draw.pool ?? '',
      ].join(',')
    })
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${lottery.id}-draw-history.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="history-card">
      <div className="section-toolbar">
        <div>
          <h2>开奖历史</h2>
          <span>每一期开奖号码、推荐号码命中球数、命中率和历史数据</span>
        </div>
        <div className="toolbar-actions">
          <label>
            期数
            <select value={limit} onChange={(event) => onLimitChange(Number(event.target.value))}>
              <option value={30}>近30期</option>
              <option value={50}>近50期</option>
              <option value={100}>近100期</option>
              <option value={draws.length}>全部</option>
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={exportCsv}>
            <Download size={16} />
            导出数据
          </button>
        </div>
      </div>

      <div className="hit-summary">
        <HitSummaryItem label="回测期数" value={`${visibleHitRows.length}期`} detail="样本不足的早期记录不计入" />
        <HitSummaryItem
          label="首组平均命中"
          value={`${hitSummary.averageTotalHits}球`}
          detail={`命中率 ${hitSummary.averageHitRate}%`}
        />
        <HitSummaryItem
          label="单期最高命中"
          value={`${hitSummary.maxTotalHits}球`}
          detail="按首组智能推荐统计"
        />
        <HitSummaryItem
          label="五组平均命中率"
          value={`${hitSummary.averageAllTicketHitRate}%`}
          detail="每期5组推荐的平均值"
        />
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>期号</th>
              <th>开奖日期</th>
              <th>星期</th>
              <th>中奖号码</th>
              <th>推荐号码</th>
              <th>命中球数</th>
              <th>命中率</th>
              <th>五组推荐参考</th>
              <th>一等奖奖金</th>
              <th>销售额</th>
              <th>奖池累计</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((draw) => {
              const hit = hitRowsByIssue.get(draw.issue)
              return (
                <tr key={draw.issue}>
                  <td className="issue-cell">{draw.issue}</td>
                  <td>{draw.date}</td>
                  <td>{draw.week ?? '-'}</td>
                  <td>
                    <BallGroup front={draw.front} back={draw.back} small padDigits={lottery.mode !== 'digits'} />
                  </td>
                  <td>
                    {hit ? (
                      <div className="hit-ticket-cell">
                        <span>{hit.recommended.name}</span>
                        <BallGroup front={hit.recommended.front} back={hit.recommended.back} small padDigits={lottery.mode !== 'digits'} />
                      </div>
                    ) : (
                      <span className="muted-cell">样本不足</span>
                    )}
                  </td>
                  <td>
                    {hit ? (
                      <div className="hit-breakdown">
                        <strong>{hit.totalHits}/{draw.front.length + draw.back.length}球</strong>
                        <span>{lottery.mode === 'digits' ? `命中 ${hit.frontHits}/${draw.front.length}` : `前区 ${hit.frontHits}/5 · 后区 ${hit.backHits}/2`}</span>
                      </div>
                    ) : (
                      <span className="muted-cell">-</span>
                    )}
                  </td>
                  <td>
                    {hit ? (
                      <span className={`hit-rate ${getHitRateTone(hit.hitRate)}`}>{hit.hitRate}%</span>
                    ) : (
                      <span className="muted-cell">-</span>
                    )}
                  </td>
                  <td>
                    {hit ? (
                      <div className="hit-breakdown">
                        <strong>最佳 {hit.bestTicket.totalHits}/{draw.front.length + draw.back.length}球</strong>
                        <span>
                          {hit.bestTicket.name} · 平均 {hit.averageTotalHits.toFixed(1)}/{draw.front.length + draw.back.length}球 · {hit.averageHitRate}%
                        </span>
                      </div>
                    ) : (
                      <span className="muted-cell">至少10期历史后计算</span>
                    )}
                  </td>
                  <td>{formatMoney(draw.firstPrize)}元</td>
                  <td>{formatMoney(draw.sales)}元</td>
                  <td>{formatMoney(draw.pool)}元</td>
                  <td>
                    <button className="table-icon" type="button" aria-label={`${draw.issue}期详情`}>
                      <Search size={17} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function HitSummaryItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="hit-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </div>
  )
}

function getHitSummary(rows: PredictionHitRecord[]) {
  if (!rows.length) {
    return {
      averageTotalHits: '0.0',
      averageHitRate: '0.0',
      maxTotalHits: 0,
      averageAllTicketHitRate: '0.0',
    }
  }

  const averageTotalHits = rows.reduce((acc, row) => acc + row.totalHits, 0) / rows.length
  const averageHitRate = rows.reduce((acc, row) => acc + row.hitRate, 0) / rows.length
  const averageAllTicketHitRate = rows.reduce((acc, row) => acc + row.averageHitRate, 0) / rows.length

  return {
    averageTotalHits: averageTotalHits.toFixed(1),
    averageHitRate: averageHitRate.toFixed(1),
    maxTotalHits: Math.max(...rows.map((row) => row.totalHits)),
    averageAllTicketHitRate: averageAllTicketHitRate.toFixed(1),
  }
}

function getHitRateTone(hitRate: number) {
  if (hitRate >= 42.9) return 'hit-rate--high'
  if (hitRate >= 28.6) return 'hit-rate--medium'
  return 'hit-rate--low'
}

function formatLotteryNumber(value: number, lottery: LotteryConfig) {
  return lottery.mode === 'digits' ? String(value) : String(value).padStart(2, '0')
}
