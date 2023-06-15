import { Side, Chips, Dests, RoundNPov, RoundN } from 'lheadsup'
import { Spectator, Player } from './headsup_ai2'
import { Search } from './mcts'
import { RangeStats } from './sbuffer'

export function min_raise_logic_for_allin(dests: Dests) {
  if (dests.raise) {
    let { match, min_raise, cant_match, cant_minraise } = dests.raise

    if (cant_match !== undefined) {
      return `raise ${cant_match}-0`
    } else if (cant_minraise !== undefined) {
      return `raise ${match}-${cant_minraise}`
    } else {
      return `raise ${match}-${min_raise}`
    }
  }
  if (dests.call) {
    return `call ${dests.call.match}`
  }

  throw `Cant go "allin" ${dests.fen}`
}

type MatchMetrics = [MatchPovMetric, MatchPovMetric][]


class MatchMetricsLogger {
  static log = async (key: string, metrics: MatchMetrics) => {
    console.log(`${key} Tournament metrics`)

    for (let i = 0; i < metrics.length; i++) {
      let [m1, m2] = metrics[i]
      console.log(`#${i+1}th Match`)

      await MatchPovMetricLogger.log(m1)
      await MatchPovMetricLogger.log(m2)
      let winner = m1.winner ? m1.p1.name : m2.p1.name

      console.log(`Winner ${winner}`)

    }
  }
}


class MatchPovMetricLogger {
  static log = async (metric: MatchPovMetric) => {
    let res = new RangeStats(metric.data)
    return res.fill_async().then(() => {
      console.log(res.ranges)
    })
  }
}

class MatchPovMetric {

  static make = (p: Player, op: Player) => {
    return new MatchPovMetric(p, op)
  }

  winner?: true
  blinds: Chips[] = []
  data: RoundNPov[] = []

  constructor(readonly p1: Player, readonly opponent: Player) {}

  dealt(round: RoundNPov) {
    this.data.push(round)
  }

  dealer(round: RoundNPov, action: string) {
    this.data.push(round)
  }

  increase_blinds(blinds: Chips) {
    this.blinds.push(blinds)
  }

  set_winner() {
    this.winner = true
  }

  action(round: RoundNPov, action: string) {
    this.data.push(round)
  }

  facing_action(round: RoundNPov, action: string) {
    this.data.push(round)
  }
}


export class Metrics extends Spectator {

  tournament_metrics: Map<string, MatchMetrics> = new Map()
  match_metrics!: MatchMetrics

  get last_match_metrics() {
    return this.match_metrics[this.match_metrics.length - 1]
  }


  _tournament_begin(p1: Player, p2: Player) {
    this.match_metrics = []
  }

  async _tournament_end() {
    this.tournament_metrics.set(this.tournament_key!, this.match_metrics)


    await MatchMetricsLogger.log(this.tournament_key!, this.match_metrics)
  }

  _dealt(round: RoundN) {
    let [m1, m2] = this.last_match_metrics
    m1.dealt(round.pov(1))
    m2.dealt(round.pov(2))
  }

  _dealer_act(round: RoundN, action: string) {
    let [m1, m2] = this.last_match_metrics
    m1.dealer(round.pov(1), action)
    m2.dealer(round.pov(2), action)
  }

  _match_begin(p1: Player, p2: Player) {
    let match_metrics: [MatchPovMetric, MatchPovMetric] = [
      MatchPovMetric.make(p1, p2),
      MatchPovMetric.make(p2, p1)
    ]
    this.match_metrics.push(match_metrics)
  }

  _increase_blinds(blinds: Chips, level: number) {
    let [m1, m2] = this.last_match_metrics
    m1.increase_blinds(blinds)
    m2.increase_blinds(blinds)
  }

  async _action(round: RoundN, action: string) {
    let [m1, m2] = this.last_match_metrics
    m1.action(round.pov(1), action)
    m2.action(round.pov(2), action)
  }

  _match_end(winner: Side) {
    let ms = this.last_match_metrics
    ms[winner - 1].set_winner()
  }
}

export class Logger extends Spectator {

  _tournament_begin(p1: Player, p2: Player) {
    console.log(`Tournament ${p1.name} vs ${p2.name} begins.`)
  }

  async _tournament_end() {
    console.log(`Tournament ends`)
  }

  _dealt(round: RoundN) {
  }

  _dealer_act(round: RoundN, action: string) {
  }

  _match_begin(p1: Player, p2: Player) {
    console.log(`Match ${p1.name} vs ${p2.name} begins.`)
  }

  _increase_blinds(blinds: Chips, level: number) {
    console.log(`#${level} Blinds increase to ${blinds}`)
  }

  async _action(round: RoundN, action: string) {
  }

  _match_end(winner: Side) {
    console.log(`Match ends`)
  }
}



export class MCTSPlayer extends Player {

  name = 'MCTS Player'
  desc = 'Monte Carlo Search Tree'

  async _act(round: RoundNPov, dests: Dests) {
    let res = await Search.begin_async(round)
    return res
  }
}

export class MaxRaiser extends Player {

  name = 'MaxRaiser'
  desc = 'Always goes allin'

  async _act(round: RoundNPov, dests: Dests) {
    if (dests.raise) {
      let { match, min_raise, cant_match, cant_minraise } = dests.raise
      let max_raise = round.stacks[0].stack - match

      if (cant_match !== undefined) {
        return `raise ${cant_match}-0`
      } else if (cant_minraise !== undefined) {
        return `raise ${match}-${cant_minraise}`
      } else {
        return `raise ${match}-${max_raise}`
      }

    }
    return min_raise_logic_for_allin(dests)
  }
}

export class MinRaiser extends Player {

  name = 'MinRaiser'
  desc = 'Always min raises'

  async _act(round: RoundNPov, dests: Dests) {
    return min_raise_logic_for_allin(dests)
  }
}

export class Caller extends Player {

  name = 'Caller'
  desc = 'Always calls'

  async _act(round: RoundNPov, dests: Dests) {
    if (dests.call) {
      return `call ${dests.call.match}`
    }
    if (dests.check) {
      return 'check'
    }
    return min_raise_logic_for_allin(dests)
  }
}

export class Folder extends Player {

  name = 'Folder'
  desc = 'Folds to any raise'

  async _act(round: RoundNPov, dests: Dests) {
    if (dests.check) {
      return 'check'
    }
    return 'fold'
  }
}
