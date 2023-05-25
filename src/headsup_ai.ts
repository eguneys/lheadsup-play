import { Chips, GameN, RoundNPov, make_deal, Headsup, Dests } from 'lheadsup'

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
  for (let i = 0; i < 100; i++) {
    // swap seats
    seats = [seats[1], seats[0]]

    let winner = one_match(seats[0], seats[1])
    if (seats[winner - 1] === p1) {
      res[0]++;
    } else {
      res[1]++;
    }
  }
  return res
}

function increase_blinds(blinds: Chips) {
  return blinds + 25
}

export function one_match(p1: Player, p2: Player) {

  let players = [p1, p2]

  let h = Headsup.make()
  let i = 0 

  while (!h.winner) {
    if (h.game_dests.deal) {

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

        let _ = h.round!.fen
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

  return h.winner
}
