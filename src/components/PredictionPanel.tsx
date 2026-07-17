import { CircleHelp, Info, SlidersHorizontal, Star } from 'lucide-react'
import type { ModelResult, PredictionTicket } from '../types'
import { BallGroup } from './NumberBall'
import type { LotteryConfig } from '../data/lotteries'

interface PredictionPanelProps {
  model: ModelResult
  onRecalculate: () => void
  lottery: LotteryConfig
}

export function PredictionPanel({ model, onRecalculate, lottery }: PredictionPanelProps) {
  return (
    <aside className="prediction-panel">
      <div className="panel-title">
        <div>
          <h2>预测号码</h2>
          <span>模型生成于 {model.generatedAt}</span>
        </div>
        <button className="icon-button" type="button" aria-label="模型说明">
          <CircleHelp size={18} />
        </button>
      </div>

      <div className="confidence-box">
        <Info size={20} />
        <div>
          <strong>模型置信度 {model.confidence}%</strong>
          <span>风险等级：{model.riskLabel}。结果只代表统计筛选，不保证中奖。</span>
        </div>
      </div>

      <div className="ticket-list">
        {model.tickets.map((ticket) => (
          <PredictionTicketCard key={ticket.id} ticket={ticket} padDigits={lottery.mode !== 'digits'} />
        ))}
      </div>

      <button className="recalculate-secondary" type="button" onClick={onRecalculate}>
        <SlidersHorizontal size={18} />
        重新计算模型
      </button>

      <div className="model-notes">
        {model.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </aside>
  )
}

function PredictionTicketCard({ ticket, padDigits }: { ticket: PredictionTicket; padDigits: boolean }) {
  return (
    <article className="ticket-card">
      <div className="ticket-index">{ticket.id}</div>
      <div className="ticket-main">
        <div className="ticket-topline">
          <strong>{ticket.name}</strong>
          <span>置信 {ticket.confidence}%</span>
        </div>
        <BallGroup front={ticket.front} back={ticket.back} small padDigits={padDigits} />
        <div className="ticket-meta">
          <span>和值 {ticket.featureSummary.frontSum}</span>
          <span>跨度 {ticket.featureSummary.frontSpan}</span>
          <span>奇偶 {ticket.featureSummary.oddEven}</span>
          <span>分区 {ticket.featureSummary.zones}</span>
        </div>
        <div className="stars" aria-label={`推荐指数${Math.round(ticket.confidence / 15)}星`}>
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              size={14}
              fill={index < Math.round(ticket.confidence / 15) ? '#f59e0b' : 'transparent'}
              color="#f59e0b"
            />
          ))}
        </div>
      </div>
    </article>
  )
}
