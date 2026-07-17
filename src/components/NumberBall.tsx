import clsx from 'clsx'
import { padBall } from '../model/features'

interface NumberBallProps {
  value: number
  tone?: 'front' | 'back' | 'neutral'
  small?: boolean
}

export function NumberBall({ value, tone = 'front', small = false }: NumberBallProps) {
  return (
    <span className={clsx('number-ball', `number-ball--${tone}`, small && 'number-ball--small')}>
      {padBall(value)}
    </span>
  )
}

export function BallGroup({ front, back, small = false }: { front: number[]; back: number[]; small?: boolean }) {
  return (
    <div className="ball-group">
      {front.map((number) => (
        <NumberBall key={`f-${number}`} value={number} tone="front" small={small} />
      ))}
      {back.length > 0 && <span className="ball-divider" />}
      {back.map((number, index) => (
        <NumberBall key={`b-${number}-${index}`} value={number} tone="back" small={small} />
      ))}
    </div>
  )
}
