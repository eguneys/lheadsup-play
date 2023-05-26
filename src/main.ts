import { self_play } from './hand_eval'
import { Search } from './mtcs'
import { sum, avg_stats_fen, RandomMixPlayer, MinRaiser, Caller, Folder, one_tournament } from './headsup_ai'

let players = [
  ['min_raiser', 'always raises minimum', MinRaiser.make()],
  ['caller', 'always calls', Caller.make()],
  ['folder', 'alawys folds', Folder.make()],
  ['mix rr', 'round robins min_raiser caller folder', new RandomMixPlayer([
    MinRaiser.make(),
    Caller.make(),
    Folder.make()
  ])]
]

mashup_players()

//mash(players[1], players[1])
//mash(players[2], players[2])
//mash(players[3], players[3], { domination: [], even: [], edge: []})
//mash(players[0], players[3])
//mash(players[0], players[0])
//mash(players[0], players[1])

function colorize(color: number, output: string) {
  return process.stdout.write(['\033[', color, 'm', output, '\033[0m'].join(''))
}

function mash(p1: any, p2: any, mash_res: any) {
  let [name, desc, i1] = p1
  let [name2, desc2, i2] = p2
 
  colorize(93, `${name} vs ${name2} `)

  let { res_nb_deals, res, res_stats } = one_tournament(i1, i2)
  let total = res[0] + res[1]
  let a_wins = Math.floor(res[0] / total * 100)
  let b_wins = Math.floor(res[1] / total * 100)

  let avg_deals = sum(res_nb_deals) / res_nb_deals.length

  let stats_fen = avg_stats_fen(res_stats[0], res_stats[1])

  console.log(`${a_wins}% ${b_wins}% deals ${avg_deals}`)
  console.log(stats_fen)

  if (Math.abs(a_wins - b_wins) < 15) {
    let mash_res_fen = `${name} vs ${name2}\n`
    mash_res['even'].push(mash_res_fen)
  } else if (Math.abs(a_wins - b_wins) > 30) {
    let a_name = a_wins > b_wins ? name : name2
    let b_name = a_wins > b_wins ? name2 : name

    let mash_res_fen = `${a_name} vs ${b_name}\n`
    mash_res['domination'].push(mash_res_fen)
  } else {
    let a_name = a_wins > b_wins ? name : name2
    let b_name = a_wins > b_wins ? name2 : name

    let mash_res_fen = `${a_name} vs ${b_name}\n`
    mash_res['edge'].push(mash_res_fen)
  }
}



function mashup_players() {
  let mash_res = {
    domination: [],
    even: [],
    edge: []
  }
  players.forEach(p => mash(p, p, mash_res))

  players.forEach((p1, i) =>
                  players.forEach((p2, i2) => i < i2 && mash(p1, p2, mash_res)))

  let domination = mash_res.domination.join('  ')
  let even = mash_res.even.join('  ')
  let edge = mash_res.edge.join('  ')

  console.log(`domination \n${domination}`)
  console.log(`even \n${even}`)
  console.log(`edge \n${edge}`)
}
