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
  WalletCards,
} from 'lucide-react'
import './App.css'
import { HistoryTable } from './components/HistoryTable'
import { MetricCard } from './components/MetricCard'
import { BallGroup } from './components/NumberBall'
import { PredictionPanel } from './components/PredictionPanel'
import { TrendCharts } from './components/TrendCharts'
import { loadDraws, parseImportedText } from './data/providers'
import {
  buildFeatures,
  buildNumberStats,
  formatMoney,
  padBall,
  percentile,
} from './model/features'
import { buildPredictions } from './model/prediction'
import type { DataStatus, DrawRecord } from './types'

const initialStatus: DataStatus = {
  label: '加载中',
  detail: '正在尝试读取公开开奖数据',
  stale: false,
  updatedAt: '-',
}

function App() {
  const [draws, setDraws] = useState<DrawRecord[]>([])
  const [status, setStatus] = useState<DataStatus>(initialStatus)
  const [loading, setLoading] = useState(true)
  const [recalcSeed, setRecalcSeed] = useState(20260627)
  const [chartWindow, setChartWindow] = useState(50)
  const [tableLimit, setTableLimit] = useState(30)
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    refreshData()
  }, [])

  async function refreshData() {
    setLoading(true)
    setNotice('')
    const result = await loadDraws()
    setDraws(result.draws)
    setStatus(result.status)
    setTableLimit(Math.min(30, result.draws.length))
    setLoading(false)
  }

  async function importFile(file: File) {
    const raw = await file.text()
    const imported = parseImportedText(raw)
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

  const features = useMemo(() => buildFeatures(draws), [draws])
  const frontStats = useMemo(() => buildNumberStats(draws, 'front'), [draws])
  const backStats = useMemo(() => buildNumberStats(draws, 'back'), [draws])
  const model = useMemo(
    () => buildPredictions(draws, features, frontStats, backStats, recalcSeed),
    [draws, features, frontStats, backStats, recalcSeed],
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
          <strong>超级大乐透</strong>
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
              <h1>超级大乐透走势预测</h1>
              <p>前区35选5 + 后区12选2，多变量特征工程与可视化复盘</p>
            </div>
          </div>
          <div className="topbar-actions">
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
            <button type="button" className="ghost-button" onClick={refreshData} disabled={loading}>
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
              <BallGroup front={latest.front} back={latest.back} />
              <div className="latest-block">
                <span>下期参考</span>
                <strong>和值 {sumBand.low}-{sumBand.high}</strong>
                <p>按历史18%-82%分位圈定</p>
              </div>
              <div className="latest-feature-grid">
                <FeaturePill label="奇偶比" value={`${latestFeature.frontOdd}:${latestFeature.frontEven}`} />
                <FeaturePill label="大小比" value={`${latestFeature.frontSmall}:${latestFeature.frontBig}`} />
                <FeaturePill label="012路" value={`${latestFeature.frontRoute0}:${latestFeature.frontRoute1}:${latestFeature.frontRoute2}`} />
                <FeaturePill label="AC值" value={String(latestFeature.frontAc)} />
              </div>
            </section>

            <section className="metrics-grid">
              <MetricCard
                icon={WalletCards}
                label="奖池累计"
                value={`${formatMoney(latest.pool, true)}元`}
                detail="最新一期公布金额"
                tone="red"
              />
              <MetricCard
                icon={Trophy}
                label="一等奖奖金"
                value={`${formatMoney(latest.firstPrize, true)}元`}
                detail="基本投注单注奖金"
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
                      ['热码', hotFront.map((item) => padBall(item.number)).join(' ')],
                      ['冷码', coldFront.map((item) => padBall(item.number)).join(' ')],
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
                  />
                </section>

                <div id="history">
                  <HistoryTable draws={draws} limit={tableLimit} onLimitChange={setTableLimit} />
                </div>
              </div>

            <div id="prediction">
              <PredictionPanel model={model} onRecalculate={() => setRecalcSeed((value) => value + 7919)} />
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
