import { MaxRaiser, MinRaiser, Caller, Folder, MCTSPlayer, Logger, Metrics } from './players'
import { one_tournament, Player, Spectator } from './headsup_ai2'

let simple = [
  new MaxRaiser(),
  new MinRaiser(),
  new Caller(),
  new Folder()
]

let mc = new MCTSPlayer()

let logger = new Logger()
let metrics = new Metrics()

export function mash_main() {

  //players([new Folder(), new Folder()], [logger, metrics])
  //players([new Caller(), new Caller()], [logger, metrics])
  players([...simple, mc], [logger, metrics])
}


async function xmash(p1: Player, p2: Player, specs: Spectator[]) {
  for (let i = 0; i < 3; i++) {
    await mash(p1, p2, specs)
  }
}


async function players(players: Player[], specs: Spectator[]) {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      await mash(players[i], players[j], specs)
    }
  }
}

async function mash(p1: Player, p2: Player, specs: Spectator[]) {
  await one_tournament(p1, p2, specs)
}
