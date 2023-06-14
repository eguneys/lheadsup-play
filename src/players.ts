import { Side, Chips, Dests, RoundNPov, RoundN } from 'lheadsup'
import { Spectator, Player } from './headsup_ai2'
import { Search } from './mcts'

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

export class Logger extends Spectator {

  _tournament_begin(p1: Player, p2: Player) {
    console.log(`Tournament ${p1.name} vs ${p2.name} begins.`)
  }

  _tournament_end() {
    console.log(`Tournament ends`)
  }

  _dealer_act(action: string) {
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
