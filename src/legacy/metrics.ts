import { RoundNPov } from 'lheadsup'
import { ehs } from './cards'

type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'total'
type RoundResult = 'fwin' | 'floss' | 'swin' | 'sloss' | 'phase' | 'total'
type HandStrength = 'low' | 'med' | 'high' | 'total'
type Action = 'fold' | 'check' | 'call' | 'raiseMin' | 'raiseHalf' | 'raiseFull' | 'reraise' | 'allin' | 'total'

const hand_strengths: HandStrength[] = ['low', 'med', 'high']

const a_left = <A>(a: A, b: A) => a
const a_sum = (a: number, b: number) => a + b

function get_action(round: RoundNPov): Action | undefined {

  let { small_blind } = round
  let big_blind = small_blind * 2

  let pot = round.total_pot
  let half_pot = pot / 2

  let { bet } = round.stacks[0]
  if (bet) {
    if (bet.desc === 'fold') {
      return 'fold'
    }
    if (bet.desc === 'check') {
      return 'check'
    }
    if (bet.desc === 'call') {
      return 'call'
    }
    if (bet.desc === 'raise') {
      let raise = bet.raise ?? 0

      if (round.stacks[0].stack === 0) {
        return 'allin'
      }
      
      if (round.stacks[1].bet?.desc === 'raise') {
        return 'reraise'
      }

      if (raise <= big_blind) {
        return 'raiseMin'
      }
      if (raise <= half_pot) {
        return 'raiseHalf'
      }

      if (raise <= pot) {
        return 'raiseFull'
      }
    }
  }
}

function get_hs(round: RoundNPov) {
  let hand = round.stacks[0].hand!
  let board = round.middle

  return ehs(hand, board)
}

function get_stack(round: RoundNPov) {
  return round.stacks[0].stack
}

function get_pot(round: RoundNPov) {
  return round.total_pot
}

function get_round_result(round: RoundNPov): RoundResult | undefined {
  let { shares } = round
  if (shares) {
    let { win, back, swin } = shares[0]

    if (win) {
      if (win[0] === 1) {
        return 'fwin'
      } else {
        return 'floss'
      }
    }
    if (swin) {
      if (swin[0] === 1) {
        return 'swin'
      } else {
        return 'sloss'
      }
    }

  }
}

function get_street(round: RoundNPov): Street {
  if (!!round.river) {
    return 'river'
  }
  if (!!round.turn) {
    return 'turn'
  }
  if (!!round.flop) {
    return 'flop'
  }
  return 'preflop'
}

function get_from_round_history<A>(filter: (round: RoundNPov) => A | undefined, reduce: (a: A, b: A) => A = a_left): (a: RoundNPov[]) => [A, RoundNPov[]][] {
  return (round_history: RoundNPov[]) => {
    let res: [A, RoundNPov[]][] = []

    round_history.forEach(round => {
      let a = filter(round)
      if (a === undefined) {
        return
      }
      let bucket = res.find(_ => _[0] === a)?.[1]
      if (!bucket) {
        res.push([a, [round]])
      } else {
        bucket.push(round)
      }
    })
    return res
  }
}

const b_per_streets = get_from_round_history<Street>(get_street)
const b_per_round_results = get_from_round_history<RoundResult>(get_round_result)
const b_pots = get_from_round_history<number>(get_pot, a_sum)
const b_stacks = get_from_round_history<number>(get_stack, a_sum)
const b_hs = get_from_round_history<number>(get_hs)
const b_per_actions = get_from_round_history<Action>(get_action)


function max(a: number[]) {
  return Math.max(...a)
}

function min(a: number[]) {
  return Math.min(...a)
}

function sum(a: number[]) {
  return a.reduce((a, b) => a + b, 0)
}

function avg(a: number[]) {
  return sum(a) / a.length
}

function mix_normal<A>(a: number, b: A[]) {
  return b[Math.floor(a * b.length - 0.001)]
}

export class Metric {

  static gets = (
    tournament_no: number,
    match_no: number,
    round_history: RoundNPov[]) => {
      return b_per_streets(round_history)
      .flatMap(([street, round_history]) => b_per_round_results(round_history)
               .flatMap(([round_result, round_history]) => {
                 let pots = b_pots(round_history).map(_ => _[0])
                 let pot = avg(pots)

                 let stacks = b_stacks(round_history).map(_ => _[0])
                 let stack = avg(stacks)

                 let hs = b_hs(round_history.slice(0, 1))[0][0]
                 let hand_strength = mix_normal(hs, hand_strengths)

                 return b_per_actions(round_history)
                 .map(([action, round_history]) => {
                   return new Metric(
                     tournament_no,
                     match_no,
                     street,
                     round_result,
                     pot,
                     stack,
                     hand_strength,
                     action)
                 })
               })
              )
    }



  constructor(
    readonly tournament_no: number,
    readonly match_no: number,
    readonly street: Street,
    readonly round_result: RoundResult,
    readonly pot: number,
    readonly stack: number,
    readonly hand_strength: HandStrength,
    readonly action: Action) {}
}
