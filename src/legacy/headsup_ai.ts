import { Side, Chips, GameN, RoundNPov, make_deal, Headsup, Dests } from 'lheadsup'

export function sum(a: number[]) {
  return a.reduce((a, b) => a + b, 0)
}

export function avg_stats_fen(a: MatchStats, b: MatchStats) {
  let t = merge(a, b)

  function avg(a: number, t: number) {
    if (a === 0 || t === 0) return 0
    return Math.floor(a / t * 100)
  }

  function get_fen(a: MatchStats) {
    let wbsw = a.nb_wins + a.nb_backs + a.nb_swins

    return `\
w ${avg(a.nb_wins, t.nb_wins)}% \
b ${avg(a.nb_backs, t.nb_backs)}% \
sw ${avg(a.nb_swins, t.nb_swins)}% \
max w ${a.max_win} \
max s ${a.max_swin} \
total w ${avg(a.total_wins, t.total_wins)}% \
total sw ${avg(a.total_swins, t.total_swins)}% \
w/b/sw ${avg(a.nb_wins, wbsw)}/${avg(a.nb_backs, wbsw)}/${avg(a.nb_swins, wbsw)}\
`
  }

  return `${get_fen(a)}\n${get_fen(b)}`
}

function merge(a: MatchStats, b: MatchStats) {
  return new MatchStats(
    a.nb_wins + b.nb_wins,
    a.nb_backs + b.nb_backs,
    a.nb_swins + b.nb_swins,
    Math.max(a.max_win, b.max_win),
    Math.max(a.max_swin, b.max_swin),
    a.total_wins + b.total_wins,
    a.total_swins + b.total_swins)
}

function min_raise_logic_for_allin(dests: Dests) {
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


export class RandomMixPlayer implements Player {

  i: number
  turn_i: number

  constructor(readonly players: Player[]) {
    this.i = 0
    this.turn_i = 0
  }

  async act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    let { players, i, turn_i } = this
    let res = players[turn_i].act(history, round, dests)

    this.i++;

    if (this.i % 4 === 0) {
      this.turn_i = Math.floor(Math.random() * players.length)
    }

    return res
  }
}


export class MaxRaiser implements Player {

  static make = () => new MaxRaiser()

  async act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
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
    if (dests.call) {
      return `call ${dests.call.match}`
    }

    throw `Cant go "allin" ${dests.fen}`
  }
}

export class MinRaiser implements Player {

  static make = () => new MinRaiser()

  async act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    return min_raise_logic_for_allin(dests)
  }
}

export class Caller implements Player {

  static make = () => new Caller()

  async act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    if (dests.call) {
      return `call ${dests.call.match}`
    } else if (dests.check) {
      return 'check'
    } 
    return min_raise_logic_for_allin(dests)
  }
}

export class Folder implements Player {

  static make = () => new Folder()

  async act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    return 'fold'
  }
}

export interface Player {
  act(history: RoundNPov[], round: RoundNPov, dests: Dests): Promise<string>
}

export async function one_tournament(p1: Player, p2: Player) {

  let ps = [p1, p2]
  let seats = [0, 1]
  let res = [0, 0]
  let res_stats = [MatchStats.empty(), MatchStats.empty()]

  let res_nb_deals = []

  for (let i = 0; i < 10; i++) {
    // swap seats
    seats = [seats[1], seats[0]]

    let { nb_deals, winner, stats } = await one_match(ps[seats[0]], ps[seats[1]])
    //console.log(nb_deals)
    res_nb_deals.push(nb_deals[0])
    if (seats[0] === 0) {
      res_stats[0] = merge(res_stats[0], stats[0])
      res_stats[1] = merge(res_stats[1], stats[1])
      if (winner === 1) {
        res[0]++;
      } else {
        res[1]++;
      }
    } else {
      res_stats[0] = merge(res_stats[0], stats[1])
      res_stats[1] = merge(res_stats[1], stats[0])
      if (winner === 1) {
        res[1]++;
      } else {
        res[0]++;
      }
    }
  }
  return {
    res,
    res_stats,
    res_nb_deals
  }
}

function increase_blinds(blinds: Chips) {
  return blinds + 25
}

type SideChips = [Side, Chips]

type MatchResult = {
  nb_deals: number[],
  winner: Side,
  stats: [MatchStats, MatchStats]
}

class MatchStats {

  static empty = () => {

      return new MatchStats(0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0)
  }

  static make = (side: Side, _wins: SideChips[], _backs: SideChips[], _swins: SideChips[]) => {
    let wins = _wins.filter(_ => _[0] === side).map(_ => _[1])
    let backs = _backs.filter(_ => _[0] === side).map(_ => _[1])
    let swins = _swins.filter(_ => _[0] === side).map(_ => _[1])

    let nb_wins = wins.length,
      nb_backs = backs.length,
      nb_swins = swins.length,
      max_win = Math.max(...wins),
      max_swin = Math.max(...swins),
      total_wins = sum(wins),
      total_swins = sum(swins)




      return new MatchStats(nb_wins,
                            nb_backs,
                            nb_swins,
                            max_win,
                            max_swin,
                            total_wins,
                            total_swins)
  }

  constructor(
    readonly nb_wins: number,
    readonly nb_backs: number,
    readonly nb_swins: number,
    readonly max_win: number,
    readonly max_swin: number,
    readonly total_wins: number,
    readonly total_swins: number
  ) {}
}

export async function one_match(p1: Player, p2: Player): Promise<MatchResult> {

  let wins: SideChips[] = [],
    backs: SideChips[] = [],
    swins: SideChips[] = []

  let nb_deals = [0]

  let players = [p1, p2]

  let h = Headsup.make()
  let i = 0 


  let prev_action_fens = []
  let prev_phase

  while (!h.winner) {
    if (h.game_dests.deal) {
      nb_deals[0]++;
      let { small_blind, button, seats } = h.game!
      if (i++ > 20) {
        i = 0
        let new_blinds = increase_blinds(small_blind)
        h.game = new GameN(new_blinds, button, seats)
        console.log(`Deal #${nb_deals[0]} New blinds ${new_blinds}`)
      }


      h.game_act('deal')
      h.round_act(`deal ${make_deal(2)}`)
    }

    let { history, round, round_dests } = h

    if (round && round_dests) {
      if (round_dests.phase) {
        prev_phase = h.round!.fen
        h.round_act('phase')
      } else if (round_dests.win) {
        h.round_act('win')
      } else if (round_dests.share) {

        h.round!.shares!.map(_ => {
          let { win, back, swin } = _
          if (win) { wins.push(win) }
          if (back) { backs.push(back) }
          if (swin) { swins.push(swin) }
        })


        let _ = h.round!.fen
        try {
        h.round_act('share')
        } catch (e) {
          console.log(prev_action_fens, prev_phase, '\n', _)
          throw e
        }
        /*
        if (h.winner) {
          console.log(h.history.map(_ => _.fen))
        }
       */
      } else if (round_dests.showdown) {
        h.round_act('showdown')
      } else {
        let { action_side } = round

        let _ = h.round!.fen
        //console.log(_, round_dests.fen)

        let action = await players[action_side - 1].act(history.map(_ => _.pov(action_side)), round.pov(action_side), round_dests)

        h.round_act(action)

        if (prev_action_fens.length > 4) {
          prev_action_fens.shift()
        }
        prev_action_fens.push(_)
      }
    }
  }

  console.log(`Match end`)

  let winner = h.winner
  let stats: [MatchStats, MatchStats] = [
    MatchStats.make(1, wins, backs, swins),
    MatchStats.make(2, wins, backs, swins)]

  return { nb_deals, winner, stats }
}
