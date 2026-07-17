import clsx from 'clsx'
import { padBall } from '../model/features'

interface NumberBallProps {
  value: number
  tone?: 'front' | 'back' | 'neutral'
  small?: boolean
  padDigits?: boolean
}

export function NumberBall({ value, tone = 'front', small = false, padDigits = true }: NumberBallProps) {
  return (
    <span className={clsx('number-ball', `number-ball--${tone}`, small && 'number-ball--small')}>
      {padDigits ? padBall(value) : String(value)}
    </span>
  )
}

export function BallGroup({ front, back, small = false, padDigits = true }: { front: number[]; back: number[]; small?: boolean; padDigits?: boolean }) {
  return (
    <div className="ball-group">
      {front.map((number, index) => (
        <NumberBall key={`f-${index}-${number}`} value={number} tone="front" small={small} padDigits={padDigits} />
      ))}
      {back.length > 0 && <span className="ball-divider" />}
      {back.map((number, index) => (
        <NumberBall key={`b-${number}-${index}`} value={number} tone="back" small={small} padDigits={padDigits} />
      ))}
    </div>
  )
}
