export type BallArea = 'front' | 'back'

export interface DrawRecord {
  issue: string
  date: string
  week?: string
  front: number[]
  back: number[]
  sales: number | null
  firstPrize: number | null
  firstPrizeCount?: number | null
  pool: number | null
  source?: string
}

export interface DrawFeatures {
  issue: string
  date: string
  frontSum: number
  backSum: number
  frontSpan: number
  backSpan: number
  frontAc: number
  backAc: number
  frontOdd: number
  frontEven: number
  backOdd: number
  backEven: number
  frontBig: number
  frontSmall: number
  backBig: number
  backSmall: number
  frontPrime: number
  frontComposite: number
  frontRoute0: number
  frontRoute1: number
  frontRoute2: number
  zone1: number
  zone2: number
  zone3: number
  consecutivePairs: number
  repeatCount: number
  neighborCount: number
  sameTailGroups: number
}

export interface NumberStat {
  area: BallArea
  number: number
  recent10: number
  recent30: number
  recent100: number
  total: number
  currentOmission: number
  maxOmission: number
  averageOmission: number
  heatScore: number
  omissionScore: number
  label: '热' | '温' | '冷'
}

export interface PredictionTicket {
  id: number
  name: string
  front: number[]
  back: number[]
  score: number
  confidence: number
  rationale: string[]
  featureSummary: {
    oddEven: string
    bigSmall: string
    frontSum: number
    frontSpan: number
    zones: string
    ac: number
  }
}

export interface PredictionHitRecord {
  issue: string
  recommended: PredictionTicket
  frontHits: number
  backHits: number
  totalHits: number
  hitRate: number
  bestTicket: {
    name: string
    frontHits: number
    backHits: number
    totalHits: number
    hitRate: number
  }
  averageTotalHits: number
  averageHitRate: number
  evaluatedTicketCount: number
}

export interface ModelResult {
  generatedAt: string
  seed: number
  confidence: number
  riskLabel: string
  tickets: PredictionTicket[]
  notes: string[]
}

export interface DataStatus {
  label: string
  detail: string
  stale: boolean
  updatedAt: string
}

export interface AnalysisBundle {
  draws: DrawRecord[]
  features: DrawFeatures[]
  frontStats: NumberStat[]
  backStats: NumberStat[]
  model: ModelResult
  status: DataStatus
}
