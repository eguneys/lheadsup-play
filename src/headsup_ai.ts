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

    return `\
wins ${avg(a.nb_wins, t.nb_wins)}% \
backs ${avg(a.nb_backs, t.nb_backs)}% \
swins ${avg(a.nb_swins, t.nb_swins)}% \
max win ${a.max_win} \
max swin ${a.max_swin} \
total wins ${avg(a.total_wins, t.total_wins)}% \
total swins ${avg(a.total_swins, t.total_swins)}% \
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

    if (cant_match) {
      return `raise ${cant_match}-0`
    } else if (cant_minraise) {
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

export class MinRaiser implements Player {

  static make = () => new Folder()

  act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    return min_raise_logic_for_allin(dests)
  }
}

export class Caller implements Player {

  static make = () => new Folder()

  act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
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

  act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    return 'fold'
  }
}

export interface Player {
  act(history: RoundNPov[], round: RoundNPov, dests: Dests): string
}

export function one_tournament(p1: Player, p2: Player) {

  let seats = [p1, p2]
  let res = [0, 0]
  let res_stats = [MatchStats.empty(), MatchStats.empty()]

  let res_nb_deals = []

  for (let i = 0; i < 100; i++) {
    // swap seats
    seats = [seats[1], seats[0]]

    let { nb_deals, winner, stats } = one_match(seats[0], seats[1])
    res_nb_deals.push(nb_deals[0])
    if (seats[0] === p1) {
      res_stats[0] = merge(res_stats[0], stats[0])
      res_stats[1] = merge(res_stats[1], stats[1])
    } else {
      res_stats[0] = merge(res_stats[0], stats[1])
      res_stats[1] = merge(res_stats[1], stats[0])
    }
    if (seats[winner - 1] === p1) {
      res[0]++;
    } else {
      res[1]++;
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

export function one_match(p1: Player, p2: Player): MatchResult {

  let wins: SideChips[] = [],
    backs: SideChips[] = [],
    swins: SideChips[] = []

  let nb_deals = [0]

  let players = [p1, p2]

  let h = Headsup.make()
  let i = 0 

  while (!h.winner) {
    if (h.game_dests.deal) {

      nb_deals[0]++;
      let { small_blind, button, seats } = h.game!
      if (i++ > 20) {
        i = 0
        let new_blinds = increase_blinds(small_blind)
        h.game = new GameN(new_blinds, button, seats)
      }


      h.game_act('deal')
      h.round_act(`deal ${make_deal(2)}`)
    }

    let { history, round, round_dests } = h

    if (round && round_dests) {
      if (round_dests.phase) {
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


        h.round_act('share')
        /*
        if (h.winner) {
          console.log(h.history.map(_ => _.fen))
        }
       */
      } else if (round_dests.showdown) {
        h.round_act('showdown')
      } else {
      
        let { action_side } = round

        let action = players[action_side - 1].act(history.map(_ => _.pov(action_side)), round.pov(action_side), round_dests)


        let _ = h.round!.fen
        h.round_act(action)
      }
    }
  }


  let winner = h.winner
  let stats: [MatchStats, MatchStats] = [
    MatchStats.make(1, wins, backs, swins),
    MatchStats.make(2, wins, backs, swins)]

  return { nb_deals, winner, stats }
}
