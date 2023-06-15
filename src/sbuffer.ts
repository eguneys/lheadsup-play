import { RoundNPov } from 'lheadsup'
import { ehs, ehs_async } from './cards'

type EmptyRange = undefined
type RawRange = [number, number]
type UnionRange = RawRange[]

type Range = EmptyRange | RawRange | UnionRange

const phases = ['deal', 'preflop', 'flop', 'turn', 'river']
const hand_strengths = ['low', 'med', 'high']
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

async function get_hs(n: RoundNPov) {
  let hand = n.stacks[0].hand
  let board = n.middle

  if (hand && board) {
    return mix_range(await ehs_async(hand, board), hand_strengths)
  }
}

function mix_range<A>(n: number, a: A[]) {
  return a[Math.floor(n * a.length - 0.001)]
}

function get_action_bucket(n: RoundNPov) {
  let bet = n.stacks[0].bet
  if (bet) {
    return bet.desc
  }
}

function get_game_result(n: RoundNPov) {
  let { shares } = n
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

export class RangeStats {

  constructor(readonly data: RoundNPov[]) {}

  ranges: Map<string, Range> = new Map()

  add_ranges_consecutive(key: string, filter: (_: RoundNPov) => boolean) {
    this.ranges.set(key, find_ranges_consecutive(this.data, filter))
  }

  add_union_ranges(key: string, ranges: string[]) {
    this.ranges.set(key, union_ranges(ranges.map(_ => this.ranges.get(_)!)))
  }

  add_intersect_ranges(key: string, ranges: string[]) {
    this.ranges.set(key, intersect_ranges(ranges.map(_ => this.ranges.get(_)!)))
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


    const copy_range_for_first_async = async (key: string, skeys: string[], filter: (_: RoundNPov) => Promise<any>) => {
      let ranges = this.ranges.get(key) as UnionRange
      for (let range of ranges) {
        let r = await filter(this.data[range[0]])
        if (skeys.includes(r)) {
          let bucket = this.ranges.get(r) as UnionRange | undefined
          if (!bucket) {
            bucket = []
            this.ranges.set(r, bucket)
          }
          bucket.push(range)
        }
      }
    }

    fill_array(phases, get_phase)
    fill_array(action_buckets, get_action_bucket)
    fill_array(game_results, get_game_result)

    await Promise.all(phases.flatMap(phase => {
      return copy_range_for_first_async(phase, hand_strengths, get_hs)
    }))

    this.add_union_ranges('total', game_results)
    this.add_union_ranges('lowmed', ['low', 'med'])
    this.add_intersect_ranges('call_lowmed_river', 
                              ['call', 'lowmed', 'river'])

    this.add_intersect_ranges('call_med_sloss_river', 
                              ['call', 'med', 'sloss', 'river'])

  }
}


function find_ranges_consecutive<A>(data: A[], filter: (_: A) => boolean): UnionRange {
  let res = []
  for (let s = 0; s < data.length; s++) {
    if (!filter(data[s])) {
      continue
    }
    for (let i = s + 1; i < data.length; i++) {
      if (!filter(data[i])) {
        res.push([s, i] as RawRange)
        s = i
        break
      }
    }
  }

  return res
}

function is_empty_range(a: Range): a is EmptyRange {
  return a === undefined
}

function is_union_range(a: RawRange | UnionRange): a is UnionRange {
  return typeof a[0] !== 'number'
}

function intersect_ranges(a: Range[]): Range {
  return a.reduce((a, b) => a ?? intersect_range(a, b), undefined)
}

function union_ranges(a: Range[]) {
  return a.reduce(union_range, [])
}

function intersect_range(a: Range, b: Range): Range {
  if (is_empty_range(a) || is_empty_range(b)) {
    return undefined
  }
  if (is_union_range(a)) {
    return union_ranges(a.map(a => intersect_range(a, b)).filter(Boolean) as Range[])
  }
  if (is_union_range(b)) {
    return union_ranges(b.map(b => intersect_range(a, b)).filter(Boolean) as Range[])
  }
  let [la, ha] = a
  let [lb, hb] = b

  if (la >= hb || lb >= ha) {
    return undefined
  }

  return [Math.max(la, lb), Math.min(ha, hb)]
}

function union_range(a: Range, b: Range): Range {
  if (is_empty_range(a)) {
    return b
  }
  if (is_empty_range(b)) {
    return a
  }
  if (is_union_range(a)) {
    return union_ranges(a.map(a => union_range(a, b)))
  }
  if (is_union_range(b)) {
    return union_ranges(b.map(b => union_range(a, b)))
  }
  return [a, b]
}

