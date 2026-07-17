import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DrawFeatures, NumberStat } from '../types'
import { buildTrendRows, formatMoney } from '../model/features'
import type { DrawRecord } from '../types'

interface TrendChartsProps {
  draws: DrawRecord[]
  features: DrawFeatures[]
  frontStats: NumberStat[]
  backStats: NumberStat[]
  windowSize: number
  numberLabel?: string
  padDigits?: boolean
}

export function TrendCharts({ draws, features, frontStats, backStats, windowSize, numberLabel = '前区号码', padDigits = true }: TrendChartsProps) {
  const trendRows = buildTrendRows(draws, features).slice(-windowSize)
  const hotRows = frontStats
    .map((stat) => ({
      number: padDigits ? String(stat.number).padStart(2, '0') : String(stat.number),
      recent30: stat.recent30,
      omission: stat.currentOmission,
      label: stat.label,
    }))
    .sort((a, b) => b.recent30 - a.recent30 || b.omission - a.omission)
    .slice(0, 14)
  return (
    <section className="chart-zone" aria-label="中奖号码走势分析可视化图">
      <div className="chart-card chart-card--wide">
        <ChartHeader title="和值与奖池走势" caption={`近${windowSize}期前区和值、10期均线和奖池累计`} />
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={trendRows} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis dataKey="issue" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={48} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={50} />
            <Tooltip
              formatter={(value, name) =>
                name === '奖池' ? [`${formatMoney(Number(value), true)}元`, name] : [value, name]
              }
            />
            <Area
              yAxisId="right"
              dataKey="pool"
              name="奖池"
              fill="#dbeafe"
              stroke="#93c5fd"
              fillOpacity={0.8}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="frontSum"
              name="和值"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="movingSum"
              name="10期均线"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <ChartHeader title="跨度 / AC复杂度" caption="观察空间离散度和随机复杂度" />
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={trendRows} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis dataKey="issue" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            <Bar dataKey="ac" name="AC值" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="frontSpan" name="跨度" stroke="#1457c8" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <ChartHeader title="奇偶与连号走势" caption="基础形态与结构关系" />
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={trendRows} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis dataKey="issue" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            <Area type="stepAfter" dataKey="oddCount" name="奇数个数" stroke="#dc2626" fill="#fee2e2" />
            <Area
              type="stepAfter"
              dataKey="consecutivePairs"
              name="连号对数"
              stroke="#0f766e"
              fill="#ccfbf1"
              fillOpacity={0.65}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card chart-card--wide">
        <ChartHeader title={`${numberLabel}冷热遗漏`} caption="近30期频次与当前遗漏并排比较" />
        <ResponsiveContainer width="100%" height={252}>
          <BarChart data={hotRows} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis dataKey="number" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            <Bar dataKey="recent30" name="近30期频次" radius={[5, 5, 0, 0]}>
              {hotRows.map((row) => (
                <Cell key={row.number} fill={row.label === '热' ? '#dc2626' : row.label === '冷' ? '#2563eb' : '#94a3b8'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="omission" name="当前遗漏" stroke="#111827" strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <NumberHeatmap stats={frontStats} title={`${numberLabel}热力图`} columns={numberLabel === '定位数字' ? 5 : 7} padDigits={padDigits} />
      {backStats.length > 0 && <NumberHeatmap stats={backStats} title="后区号码热力图" columns={6} compact />}
    </section>
  )
}

function ChartHeader({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="chart-header">
      <h3>{title}</h3>
      <span>{caption}</span>
    </div>
  )
}

function NumberHeatmap({
  stats,
  title,
  columns,
  compact = false,
  padDigits = true,
}: {
  stats: NumberStat[]
  title: string
  columns: number
  compact?: boolean
  padDigits?: boolean
}) {
  const maxFreq = Math.max(1, ...stats.map((stat) => stat.recent30))

  return (
    <div className="chart-card">
      <ChartHeader title={title} caption="颜色越深表示近30期越热，角标为遗漏" />
      <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {stats.map((stat) => {
          const intensity = stat.recent30 / maxFreq
          return (
            <div
              key={stat.number}
              className="heat-cell"
              style={{
                background: `rgba(220, 38, 38, ${0.08 + intensity * 0.78})`,
                color: intensity > 0.45 ? '#fff' : '#111827',
              }}
              title={`号码${stat.number} 近30期${stat.recent30}次 当前遗漏${stat.currentOmission}期`}
            >
              <strong>{padDigits ? String(stat.number).padStart(2, '0') : String(stat.number)}</strong>
              <span>{compact ? stat.recent30 : `漏${stat.currentOmission}`}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
