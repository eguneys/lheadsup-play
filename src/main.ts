import { self_play } from './hand_eval'
import { Search } from './mtcs'
import { sum, avg_stats_fen, MinRaiser, Caller, Folder, one_tournament } from './headsup_ai'

let players = [
  ['min_raiser', 'always raises minimum', MinRaiser],
  ['caller', 'always calls', Caller],
  ['folder', 'alawys folds', Folder]
]

mashup_players()

//mash(players[0], players[0])


function mash(p1: any, p2: any) {
  let [name, desc, klass] = p1
  let [name2, desc2, klass2] = p2

  let i1 = new klass()
  let i2 = new klass2()


  let { res_nb_deals, res, res_stats } = one_tournament(i1, i2)
  let total = res[0] + res[1]

  let avg_deals = sum(res_nb_deals) / res_nb_deals.length

  let stats_fen = avg_stats_fen(res_stats[0], res_stats[1])

  console.log(`${name} vs ${name2} ${Math.floor(res[0] / total * 100)}% ${Math.floor(res[1] / total * 100)}% deals ${avg_deals}`)
  console.log(stats_fen)
}



function mashup_players() {
  players.forEach(p => mash(p, p))

  players.forEach(p1 =>
                  players.forEach(p2 => p1 !== p2 && mash(p1, p2)))
}
