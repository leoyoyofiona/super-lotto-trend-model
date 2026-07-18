import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  DatabaseZap,
  FileUp,
  Flame,
  Gauge,
  Grid3X3,
  History,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Sigma,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
} from 'lucide-react'
import './App.css'
import { HistoryTable } from './components/HistoryTable'
import { MetricCard } from './components/MetricCard'
import { BallGroup } from './components/NumberBall'
import { PredictionPanel } from './components/PredictionPanel'
import { TrendCharts } from './components/TrendCharts'
import { loadDraws, parseImportedText } from './data/providers'
import { DEFAULT_LOTTERY, LOTTERIES, type LotteryConfig, type LotteryId } from './data/lotteries'
import {
  buildFeatures,
  buildNumberStats,
  formatMoney,
  percentile,
} from './model/features'
import { buildPredictionHitRows } from './model/backtest'
import { buildPredictions, type DigitPrefixMap } from './model/prediction'
import type { DataStatus, DrawRecord } from './types'

const initialStatus: DataStatus = {
  label: '加载中',
  detail: '正在尝试读取公开开奖数据',
  stale: false,
  updatedAt: '-',
}

interface VisitorStats {
  uniqueVisitors: number
  totalVisits: number
  baselineTotalVisits?: number
  baselineUniqueVisitors?: number
  currentPeriodVisits?: number
  currentPeriodUniqueVisitors?: number
  baselineStartedAt?: string
  lastVisitAt: string | null
}

const visitorIdStorageKey = 'super-lotto-anonymous-visitor-id'

function App() {
  const [draws, setDraws] = useState<DrawRecord[]>([])
  const [lotteryId, setLotteryId] = useState<LotteryId>(DEFAULT_LOTTERY.id)
  const [status, setStatus] = useState<DataStatus>(initialStatus)
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalcSeed, setRecalcSeed] = useState(20260627)
  const [sharedDigitPrefixes, setSharedDigitPrefixes] = useState<DigitPrefixMap>({})
  const [chartWindow, setChartWindow] = useState(50)
  const [tableLimit, setTableLimit] = useState(30)
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const refreshRequestRef = useRef(0)
  const lottery = LOTTERIES.find((item) => item.id === lotteryId) ?? DEFAULT_LOTTERY

  useEffect(() => {
    void refreshData(lottery)
  }, [lotteryId, lottery])

  useEffect(() => {
    void registerVisit()
  }, [])

  async function refreshData(config = lottery) {
    const requestId = ++refreshRequestRef.current
    setLoading(true)
    setNotice('')
    const result = await loadDraws(config)
    if (requestId !== refreshRequestRef.current) return
    const cleanedDraws = result.draws.map((draw) => sanitizeDrawForLottery(draw, config))
    setDraws(cleanedDraws)
    setStatus(result.status)
    setTableLimit(Math.min(30, cleanedDraws.length))
    setLoading(false)
  }

  async function importFile(file: File) {
    const raw = await file.text()
    const imported = parseImportedText(raw, lottery)
    if (!imported.length) {
      setNotice('导入失败：没有识别到有效期号、前区和后区号码。')
      return
    }
    const sorted = imported.sort((a, b) => Number(b.issue) - Number(a.issue))
    setDraws(sorted)
    setStatus({
      label: '用户导入数据',
      detail: `${sorted.length}期，最新期号 ${sorted[0].issue}，开奖日期 ${sorted[0].date}`,
      stale: false,
      updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    })
    setTableLimit(Math.min(30, sorted.length))
    setNotice('导入完成，模型和所有走势图已按新数据重新计算。')
  }

  async function registerVisit() {
    try {
      const visitorId = getOrCreateVisitorId()
      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      })
      if (!response.ok) throw new Error('visit counter failed')
      const payload = (await response.json()) as VisitorStats
      setVisitorStats(payload)
    } catch {
      setVisitorStats(null)
    }
  }

  const features = useMemo(() => buildFeatures(draws), [draws])
  const frontStats = useMemo(() => buildNumberStats(draws, 'front', lottery.max, lottery.mode === 'digits' ? 0 : 1), [draws, lottery])
  const backStats = useMemo(() => lottery.mode === 'lotto' ? buildNumberStats(draws, 'back') : [], [draws, lottery])
  const model = useMemo(
    () => buildPredictions(draws, features, frontStats, backStats, recalcSeed, lottery, sharedDigitPrefixes),
    [draws, features, frontStats, backStats, recalcSeed, lottery, sharedDigitPrefixes],
  )
  useEffect(() => {
    if (lottery.id !== 'pl3' && lottery.id !== 'pl5') return
    setSharedDigitPrefixes((previous) => {
      let changed = false
      const next = { ...previous }
      model.tickets.forEach((ticket) => {
        const prefix = ticket.front.slice(0, 3)
        const oldPrefix = next[ticket.name]
        if (prefix.length === 3 && (!oldPrefix || oldPrefix.join(',') !== prefix.join(','))) {
          next[ticket.name] = prefix
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [lottery.id, model])
  const hitRows = useMemo(
    () => buildPredictionHitRows(draws, tableLimit, recalcSeed, lottery),
    [draws, tableLimit, recalcSeed, lottery],
  )
  const latest = draws[0]
  const latestFeature = features[0]
  const hotFront = [...frontStats].sort((a, b) => b.recent30 - a.recent30).slice(0, 5)
  const coldFront = [...frontStats].sort((a, b) => b.currentOmission - a.currentOmission).slice(0, 5)
  const sumBand = {
    low: percentile(features.map((feature) => feature.frontSum), 0.18),
    high: percentile(features.map((feature) => feature.frontSum), 0.82),
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="主导航">
        <div className="brand-mark">
          <span className="leo-logo" aria-label="LEO logo">LEO</span>
            <strong>LEO 体彩分析</strong>
        </div>
        <nav>
          <a href="#disclaimer">
            <ShieldCheck size={20} />
            免责声明
          </a>
          <a href="#dashboard" className="active">
            <BarChart3 size={20} />
            仪表盘
          </a>
          <a href="#history">
            <History size={20} />
            开奖历史
          </a>
          <a href="#trend">
            <Sigma size={20} />
            走势分析
          </a>
          <a href="#prediction">
            <Sparkles size={20} />
            预测号码
          </a>
          <a href="#omission">
            <Flame size={20} />
            冷热遗漏
          </a>
          <a href="#structure">
            <Grid3X3 size={20} />
            结构特征
          </a>
          <a href="#donate">
            <QrCode size={20} />
            打赏支持
          </a>
        </nav>
        <div className="rail-foot">
          <ShieldCheck size={18} />
          <span>仅统计分析</span>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="title-lockup">
            <span className="leo-logo leo-logo--topbar" aria-label="LEO logo">LEO</span>
            <div className="title-copy">
              <h1>LEO-超级大乐透+排列3+排列5+7星彩</h1>
              <p>当前分析：{lottery.name} · {lottery.subtitle}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="visitor-chip" title="匿名来访统计">
              <Users size={18} />
              <div>
                <strong>来访 {formatCount(visitorStats?.uniqueVisitors)}</strong>
                <span>累计访问 {formatCount(visitorStats?.totalVisits)} 次</span>
              </div>
            </div>
            <div className="data-chip" data-stale={status.stale}>
              <DatabaseZap size={17} />
              <span>{status.label}</span>
            </div>
            <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()}>
              <FileUp size={17} />
              导入数据
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,text/csv,application/json"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) void importFile(file)
                event.currentTarget.value = ''
              }}
            />
            <div className="lottery-switcher" role="group" aria-label="选择彩种">
              {LOTTERIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`lottery-switcher__button${item.id === lotteryId ? ' is-active' : ''}`}
                  aria-pressed={item.id === lotteryId}
                  onClick={() => setLotteryId(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <button type="button" className="ghost-button" onClick={() => void refreshData()} disabled={loading}>
              <RefreshCcw size={17} className={loading ? 'spin' : undefined} />
              刷新开奖
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setRecalcSeed((value) => value + 7919)}
              disabled={!draws.length}
            >
              <RefreshCcw size={18} />
              重新计算模型
            </button>
          </div>
        </header>

        <section className="legal-disclaimer" id="disclaimer" role="note" aria-label="法律免责声明">
          <div className="legal-disclaimer__badge">
            <ShieldCheck size={22} />
            <span>法律免责声明</span>
          </div>
          <p>
            <strong>仅供爱好者进行预测分析和统计分析。</strong>
            <span>不作为博彩投注的参考依据。</span>
            <span>彩票开奖具有随机性。</span>
            <span>本程序不承诺或暗示任何中奖概率提升。</span>
            <span>请理性看待分析结果。</span>
          </p>
        </section>

        <section className="status-strip" id="dashboard">
          <div className="status-copy">
            <strong>{status.detail}</strong>
            <span>更新时间：{status.updatedAt}</span>
            {notice && <em>{notice}</em>}
          </div>
          <div className="window-control">
            <span>走势图周期</span>
            <select value={chartWindow} onChange={(event) => setChartWindow(Number(event.target.value))}>
              <option value={30}>近30期</option>
              <option value={50}>近50期</option>
              <option value={100}>近100期</option>
            </select>
          </div>
        </section>

        {latest && latestFeature ? (
          <>
            <section className="latest-card">
              <div className="latest-block">
                <span>最新开奖</span>
                <strong>{latest.issue}期</strong>
                <p>{latest.date}（周{latest.week ?? '-'}）</p>
              </div>
              <BallGroup front={latest.front} back={latest.back} padDigits={lottery.mode !== 'digits'} />
              <div className="latest-block">
                <span>下期参考</span>
                <strong>和值 {sumBand.low}-{sumBand.high}</strong>
                <p>按历史18%-82%分位圈定</p>
              </div>
              <div className="latest-feature-grid">
                <FeaturePill label="奇偶比" value={`${latestFeature.frontOdd}:${latestFeature.frontEven}`} />
                <FeaturePill label={lottery.mode === 'digits' ? '重复位' : '大小比'} value={lottery.mode === 'digits' ? String(latest.front.length - new Set(latest.front).size) : `${latestFeature.frontSmall}:${latestFeature.frontBig}`} />
                <FeaturePill label="012路" value={`${latestFeature.frontRoute0}:${latestFeature.frontRoute1}:${latestFeature.frontRoute2}`} />
                <FeaturePill label="AC值" value={String(latestFeature.frontAc)} />
              </div>
            </section>

            <section className="metrics-grid">
              <MetricCard
                icon={WalletCards}
                label="奖池累计"
                value={`${formatMoney(latest.pool, true)}元`}
                detail={lottery.mode === 'digits' ? '当前彩种暂无奖池字段' : '最新一期公布金额'}
                tone="red"
              />
              <MetricCard
                icon={Trophy}
                label="一等奖奖金"
                value={`${formatMoney(latest.firstPrize, true)}元`}
                detail={lottery.mode === 'digits' ? '当前彩种暂无奖金字段' : '基本投注单注奖金'}
                tone="amber"
              />
              <MetricCard
                icon={CalendarDays}
                label="历史期数"
                value={`${draws.length}期`}
                detail={`当前表格保留${tableLimit}期`}
                tone="blue"
              />
              <MetricCard
                icon={Users}
                label="来访人数"
                value={`${formatCount(visitorStats?.uniqueVisitors)}人`}
                detail={getVisitorStatsDetail(visitorStats)}
                tone="slate"
              />
              <MetricCard
                icon={Gauge}
                label="模型置信度"
                value={`${model.confidence}%`}
                detail={`风险等级 ${model.riskLabel}`}
                tone="green"
              />
            </section>

            <div className="content-grid">
              <div className="analysis-column">
                <section className="feature-board" id="structure">
                  <div className="section-toolbar">
                    <div>
                      <h2>结构特征</h2>
                      <span>基础分布、动态跨度、关联关系和冷热遗漏的当前读数</span>
                    </div>
                  </div>
                  <div className="feature-grid">
                    <FeatureCard title="基础分布" items={[
                      ['质合比', `${latestFeature.frontPrime}:${latestFeature.frontComposite}`],
                      ['大小比', `${latestFeature.frontSmall}:${latestFeature.frontBig}`],
                      ['奇偶比', `${latestFeature.frontOdd}:${latestFeature.frontEven}`],
                      ['012路比', `${latestFeature.frontRoute0}:${latestFeature.frontRoute1}:${latestFeature.frontRoute2}`],
                    ]} />
                    <FeatureCard title="动态跨度" items={[
                      ['前区和值', String(latestFeature.frontSum)],
                      ['后区和值', String(latestFeature.backSum)],
                      ['前区跨度', String(latestFeature.frontSpan)],
                      ['前区AC值', String(latestFeature.frontAc)],
                    ]} />
                    <FeatureCard title="结构关系" items={[
                      ['三区比', `${latestFeature.zone1}:${latestFeature.zone2}:${latestFeature.zone3}`],
                      ['连号对', String(latestFeature.consecutivePairs)],
                      ['重号', String(latestFeature.repeatCount)],
                      ['斜连邻号', String(latestFeature.neighborCount)],
                    ]} />
                    <FeatureCard title="冷热遗漏" items={[
                      ['热码', hotFront.map((item) => formatLotteryNumber(item.number, lottery.mode !== 'digits')).join(' ')],
                      ['冷码', coldFront.map((item) => formatLotteryNumber(item.number, lottery.mode !== 'digits')).join(' ')],
                      ['最高遗漏', `${Math.max(...frontStats.map((item) => item.currentOmission))}期`],
                      ['和值主区间', `${sumBand.low}-${sumBand.high}`],
                    ]} />
                  </div>
                </section>

                <section id="trend">
                  <div className="section-toolbar">
                    <div>
                      <h2>中奖号码走势分析可视化图</h2>
                      <span>和值、跨度、AC、奇偶、连号、冷热和遗漏的图形化分析</span>
                    </div>
                  </div>
                  <TrendCharts
                    draws={draws}
                    features={features}
                    frontStats={frontStats}
                    backStats={backStats}
                    windowSize={chartWindow}
                    numberLabel={lottery.mode === 'digits' ? '定位数字' : '前区号码'}
                    padDigits={lottery.mode !== 'digits'}
                  />
                </section>

                <div id="history">
                  <HistoryTable
                    draws={draws}
                    limit={tableLimit}
                    hitRows={hitRows}
                    onLimitChange={setTableLimit}
                    lottery={lottery}
                  />
                </div>
              </div>

            <div id="prediction">
              <PredictionPanel lottery={lottery} model={model} onRecalculate={() => setRecalcSeed((value) => value + 7919)} />
            </div>
            </div>

            <DonationSection />
          </>
        ) : (
          <section className="empty-state">
            <RefreshCcw size={24} className="spin" />
            <strong>正在加载开奖数据</strong>
          </section>
        )}
      </main>
    </div>
  )
}

function sanitizeDrawForLottery(draw: DrawRecord, config: LotteryConfig): DrawRecord {
  if (config.id === 'qxc') return { ...draw, front: draw.front.slice(-7), back: [] }
  if (config.id === 'pl3') return { ...draw, front: draw.front.slice(0, 3), back: [] }
  if (config.id === 'pl5') return { ...draw, front: draw.front.slice(0, 5), back: [] }
  return draw
}

function formatLotteryNumber(value: number, padDigits: boolean) {
  return padDigits ? String(value).padStart(2, '0') : String(value)
}

function getOrCreateVisitorId() {
  const existing = window.localStorage.getItem(visitorIdStorageKey)
  if (existing) return existing

  const generated =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `visitor:${Date.now()}:${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(visitorIdStorageKey, generated)
  return generated
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('zh-CN').format(value)
}

function getVisitorStatsDetail(stats: VisitorStats | null) {
  if (!stats) return '正在读取访问统计'
  if ((stats.baselineTotalVisits ?? 0) > 0 || (stats.baselineUniqueVisitors ?? 0) > 0) {
    return `含历史基准，累计访问 ${formatCount(stats.totalVisits)} 次`
  }
  return `累计访问 ${formatCount(stats.totalVisits)} 次`
}

function DonationSection() {
  return (
    <section className="donation-panel" id="donate">
      <div className="section-toolbar">
        <div>
          <h2>打赏支持</h2>
          <span>如果这个大乐透走势分析工具对你有帮助，可以扫码支持后续维护</span>
        </div>
      </div>
      <div className="donation-grid">
        <DonationCard title="支付宝" src="/donate/alipay-qr.jpg" tone="alipay" />
        <DonationCard title="微信" src="/donate/wechat-qr.jpg" tone="wechat" />
      </div>
    </section>
  )
}

function DonationCard({ title, src, tone }: { title: string; src: string; tone: 'alipay' | 'wechat' }) {
  return (
    <article className={`donation-card donation-card--${tone}`}>
      <div className="donation-card__topline">
        <QrCode size={19} />
        <strong>{title}</strong>
      </div>
      <img src={src} alt={`${title}打赏二维码`} />
      <span>扫码打赏</span>
    </article>
  )
}

function FeaturePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="feature-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FeatureCard({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <article className="feature-card">
      <h3>{title}</h3>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default App
