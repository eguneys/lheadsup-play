import { RoundNPov } from 'phevaluatorjs25'
import { ehs_async_batched } from './ehs'

type AllRange = 1
type EmptyRange = 0
type RawRange = [number, number]
type UnionRange = RawRange[]

type Range = AllRange | EmptyRange | RawRange | UnionRange

const phases = ['deal', 'preflop', 'flop', 'turn', 'river']
const hand_strengths = ['low', 'med', 'high', 'nuts']
const action_buckets = ['fold', 'check', 'call', 'raiseMin', 'raiseMed', 'allin']
const game_results = ['fwin', 'floss', 'swin', 'sloss']

function get_phase(n: RoundNPov) {
  if (!!n.river) {
    return 'river'
  }
  if (!!n.turn) {
    return 'turn'
  }
  if (!!n.flop) {
    return 'flop'
  }
  if (!!n.stacks[0].hand) {
    return 'preflop'
  }
  return 'deal'
}

const dummy_hand = ['Ah', 'Ah']
async function get_hs_batched(n: RoundNPov[]) {
  let dummies: number[] = []
  let res: (number | undefined)[] = await ehs_async_batched(n.map((n, i) => {
    let hand = n.stacks[0].hand
    let board = n.middle
    if (hand && board) {
      return [hand, board]
    } else {
      dummies.push(i)
      return [dummy_hand, []]
    }
  }))
  dummies.forEach(i => res[i] = undefined)
  return res.map(i => i && mix_range(i, hand_strengths))
}

function mix_range<A>(n: number, a: A[]) {
  return a[Math.floor(n * a.length - 0.001)]
}

function get_action_bucket(n: RoundNPov) {
  let bet = n.stacks[0].bet
  if (bet) {
    if (bet.desc === 'raise') {
      return 'raiseMin'
    }
    return bet.desc
  }
}

function get_game_result(n: RoundNPov) {
  let { shares } = n
  if (shares) {
    for (let i = 0; i < shares.length; i++) {
      let { win, back, swin } = shares[i]

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
}

export class RangeStats {

  constructor(readonly data: RoundNPov[]) {}

  ranges: Map<string, Range> = new Map()

  add_ranges_consecutive(key: string, filter: (_: RoundNPov) => boolean) {
    this.ranges.set(key, find_ranges_consecutive(this.data, filter))
  }

  add_union_ranges(key: string, ranges: string[]) {
    this.ranges.set(key, union_ranges(ranges.map(_ => this.ranges.get(_) ?? 0)))
  }

  add_intersect_ranges(key: string, ranges: string[]) {
    this.ranges.set(key, intersect_ranges(ranges.map(_ => this.ranges.get(_)?? 0)))
  }


  async fill_async() {

    const fill_array = (phases: string[], get_phase: (_: RoundNPov) => any) => {
      phases.forEach(phase =>
                     this.add_ranges_consecutive(`${phase}`, _ =>
                                                 get_phase(_) === phase))
    }

    const copy_range_for_first = (key: string, skey: string, filter: (_: RoundNPov) => boolean) => {
      let ranges = this.ranges.get(key) as UnionRange
      let res = ranges.filter(range => filter(this.data[range[0]]))
      this.ranges.set(skey, res)
    }

    const copy_range_hs_to_street = async () => {
      let phase_range = phases.flatMap(phase => 
                     (this.ranges.get(phase) as UnionRange)
                     .map(range => [phase, range] as [string, RawRange]))

      let phase_hs = await get_hs_batched(phase_range.map(p_r => this.data[p_r[1][0]]))

      phase_hs.forEach((hs, i) => {
        let range = phase_range[i][1]
        if (hs) {
          let bucket = this.ranges.get(hs) as UnionRange | undefined
          if (!bucket) {
            bucket = []
            this.ranges.set(hs, bucket)
          }
          bucket.push(range)

        }
      })

    }

    fill_array(phases, get_phase)
    fill_array(action_buckets, get_action_bucket)
    fill_array(game_results, get_game_result)

    await copy_range_hs_to_street()

    this.add_uk(game_results.join('+'), 'ends')
    this.add_uk(`fwin+floss`, 'f')
    this.add_uk(`swin+sloss`, 's')
  }

  add_uk(key: string, alt_key?: string) {
    let cs = key.split('_')
    cs.forEach(c => {
      if (!this.ranges.has(c)) {
        let us = c.split('+')
        this.add_union_ranges(c, us)
      }
    })
    this.add_intersect_ranges(key, key.split('_'))
    if (alt_key) {
      this.ranges.set(alt_key, this.ranges.get(key)!)
    }
  }


  samples(key: string) {
    if (!this.ranges.has(key)) {
      this.add_uk(key)
    }

    return solidify_range(this.ranges.get(key) ?? 0)
    .map(range => range.map(i => this.data[i]))
  }
}

function find_ranges_consecutive<A>(data: A[], filter: (_: A) => boolean): UnionRange {
  let res = []
  for (let s = 0; s < data.length; s++) {
    if (!filter(data[s])) {
      continue
    }
    let i = s + 1
    for (; i < data.length; i++) {
      if (!filter(data[i])) {
        res.push([s, i] as RawRange)
        s = i
        break
      }
    }
    
    if (s !== i) {
      res.push([s, data.length] as RawRange)
      break
    }
  }

  return res
}

function solidify_range(a: Range): number[][] {
  if (is_all_range(a) || is_empty_range(a)) {
    return []
  }
  if (is_union_range(a)) {
    return a.map(_ => solidify_range(_)[0])
  }
  return [expand(a)]
}

function expand(a: RawRange): number[] {
  let [lb, hb] = a

  return [...Array(hb - lb).keys()].map(_ => _ + lb)
}

function is_all_range(a: Range): a is AllRange {
  return a === 1
}

function is_empty_range(a: Range): a is EmptyRange {
  return a === 0 || a !== 1 && a.length === 0
}

function is_union_range(a: RawRange | UnionRange): a is UnionRange {
  return typeof a[0] !== 'number'
}

function intersect_ranges(a: Range[]): Range {
  return a.reduce(intersect_range, 1)
}


function union_ranges(a: Range[]) {
  return a.reduce(union_range, 0)
}

function intersect_range(a: Range, b: Range): Range {
  if (is_all_range(a)) {
    return b
  }
  if (is_all_range(b)) {
    return a
  }
  if (is_empty_range(a) || is_empty_range(b)) {
    return 0
  }
  if (is_union_range(a)) {
    if (is_union_range(b)) {
      return a.flatMap(a => b.map(b => intersect_range(a, b) as RawRange).filter(Boolean))
    }

    return a.map(a => intersect_range(a, b) as RawRange).filter(Boolean)
  }
  if (is_union_range(b)) {
    return intersect_range(b, a)
  }
  let [la, ha] = a
  let [lb, hb] = b

  if (la >= hb || lb >= ha) {
    return 0
  }

  return [Math.max(la, lb), Math.min(ha, hb)]
}

function union_range(a: Range, b: Range): Range {
  if (is_all_range(a) || is_all_range(b)) {
    return 1
  }
  if (is_empty_range(a)) {
    if (is_empty_range(b)) {
      return 0
    }
    return b
  }
  if (is_empty_range(b)) {
    return a
  }
  if (is_union_range(a)) {
    if (is_union_range(b)) {
      return [...a, ...b]
    }
    return [...a, b]
  }
  if (is_union_range(b)) {
    return [a, ...b]
  }
  return [a, b]
}



function test() {
 }
