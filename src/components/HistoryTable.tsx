import { Download, Search } from 'lucide-react'
import type { DrawRecord } from '../types'
import { formatMoney } from '../model/features'
import { BallGroup } from './NumberBall'

interface HistoryTableProps {
  draws: DrawRecord[]
  limit: number
  onLimitChange: (limit: number) => void
}

export function HistoryTable({ draws, limit, onLimitChange }: HistoryTableProps) {
  const visible = draws.slice(0, limit)

  function exportCsv() {
    const header = ['issue', 'date', 'front', 'back', 'sales', 'firstPrize', 'pool']
    const rows = draws.map((draw) =>
      [
        draw.issue,
        draw.date,
        draw.front.map((item) => String(item).padStart(2, '0')).join(' '),
        draw.back.map((item) => String(item).padStart(2, '0')).join(' '),
        draw.sales ?? '',
        draw.firstPrize ?? '',
        draw.pool ?? '',
      ].join(','),
    )
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dlt-draw-history.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="history-card">
      <div className="section-toolbar">
        <div>
          <h2>开奖历史</h2>
          <span>每一期中奖号码、一等奖奖金、销售额和奖池累计金额</span>
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

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>期号</th>
              <th>开奖日期</th>
              <th>星期</th>
              <th>中奖号码</th>
              <th>一等奖奖金</th>
              <th>销售额</th>
              <th>奖池累计</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((draw) => (
              <tr key={draw.issue}>
                <td className="issue-cell">{draw.issue}</td>
                <td>{draw.date}</td>
                <td>{draw.week ?? '-'}</td>
                <td>
                  <BallGroup front={draw.front} back={draw.back} small />
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
