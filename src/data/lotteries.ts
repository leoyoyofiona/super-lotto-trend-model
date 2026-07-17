export type LotteryId = 'dlt' | 'pl3' | 'pl5' | 'qxc'

export interface LotteryConfig {
  id: LotteryId
  name: string
  subtitle: string
  apiType: string
  count: number
  max: number
  mode: 'lotto' | 'digits'
}

export const LOTTERIES: LotteryConfig[] = [
  {
    id: 'dlt',
    name: '超级大乐透',
    subtitle: '前区35选5 + 后区12选2，多变量特征工程与可视化复盘',
    apiType: 'dlt',
    count: 5,
    max: 35,
    mode: 'lotto',
  },
  {
    id: 'pl3',
    name: '排列3',
    subtitle: '3位数字位置走势、和值、跨度、组六/组三/豹子结构分析',
    apiType: 'pl3',
    count: 3,
    max: 9,
    mode: 'digits',
  },
  {
    id: 'pl5',
    name: '排列5',
    subtitle: '5位数字位置走势、和值、跨度、重复与定位冷热分析',
    apiType: 'pl5',
    count: 5,
    max: 9,
    mode: 'digits',
  },
  {
    id: 'qxc',
    name: '7星彩',
    subtitle: '7位数字位置走势、和值、跨度、重复与定位冷热分析',
    apiType: 'qxc',
    count: 7,
    max: 9,
    mode: 'digits',
  },
]

export const DEFAULT_LOTTERY = LOTTERIES[0]
