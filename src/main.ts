import { self_play } from './hand_eval'
import { Search } from './mtcs'
import { sum, avg_stats_fen, RandomMixPlayer, MaxRaiser, MinRaiser, Caller, Folder, one_tournament } from './headsup_ai'

let players = [
  ['max_raiser', 'always raises maximum', MaxRaiser.make()],
  ['min_raiser', 'always raises minimum', MinRaiser.make()],
  ['caller', 'always calls', Caller.make()],
  ['folder', 'alawys folds', Folder.make()],
  ['mix rr', 'round robins max_raiser min_raiser caller folder', new RandomMixPlayer([
    MaxRaiser.make(),
    MinRaiser.make(),
    Caller.make(),
    Folder.make()
  ])]
]

mashup_players()

//xmash(players[1], players[0])

//mash(players[1], players[1])
//mash(players[2], players[2])
//mash(players[3], players[3], { domination: [], even: [], edge: []})
//mash(players[0], players[3])
//mash(players[0], players[0])
//mash(players[0], players[1])

function colorize(color: number, output: string) {
  return ['\033[', color, 'm', output, '\033[0m'].join('')
}

function mash(p1: any, p2: any, mash_res: any) {
  let [name, desc, i1] = p1
  let [name2, desc2, i2] = p2
 
  let header = colorize(93, `${name} vs ${name2} `)

  let { res_nb_deals, res, res_stats } = one_tournament(i1, i2)
  let total = res[0] + res[1]
  let a_wins = Math.floor(res[0] / total * 100)
  let b_wins = Math.floor(res[1] / total * 100)

  let avg_deals = sum(res_nb_deals) / res_nb_deals.length

  let stats_fen = avg_stats_fen(res_stats[0], res_stats[1])

  mash_res.header = header
  mash_res.more_stats = `${a_wins}% ${b_wins}% deals ${avg_deals}\n${stats_fen}`

  let win = Math.max(a_wins, b_wins)
  let loss = Math.min(a_wins, b_wins)
  if (Math.abs(a_wins - 50) < 10) {
    let mash_res_fen = `${name} vs ${name2} ${win}/${loss}`
    mash_res['even'].push(mash_res_fen)
  } else if (Math.abs(a_wins - 50) > 30) {
    let a_name = a_wins > b_wins ? name : name2
    let b_name = a_wins > b_wins ? name2 : name

    let mash_res_fen = `${a_name} vs ${b_name} ${win}/${loss}`
    mash_res['domination'].push(mash_res_fen)
  } else {
    let a_name = a_wins > b_wins ? name : name2
    let b_name = a_wins > b_wins ? name2 : name

    let mash_res_fen = `${a_name} vs ${b_name} ${win}/${loss}`
    mash_res['edge'].push(mash_res_fen)
  }
}


function xmash(p1: any, p2: any) {
  for (let i = 0; i < 10; i++) {
    let mash_res: any = {
      domination: [],
      even: [],
      edge: []
    }
    mash(p1, p2, mash_res)

    let domination = mash_res.domination.join('\n')
    let even = mash_res.even.join('\n')
    let edge = mash_res.edge.join('\n')

    if (domination !== '') {
      console.log(`domination\n${domination}`)
    }
    if (even !== '') {
      console.log(`even\n${even}`)
    }
    if (edge !== '') {
      console.log(`edge\n${edge}`)
    }
  }
}

function mashup_players() {
  let mash_res: any = {
    domination: [],
    even: [],
    edge: []
  }

  players.forEach(p => {
    console.log(`${p[0]} vs ${p[0]}`)
    mash(p, p, mash_res)
  })

  players.forEach((p1, i) =>
                  players.forEach((p2, i2) => {
                    if (i < i2) {
                      console.log(`${p1[0]} vs ${p2[0]}`)
                      mash(p1, p2, mash_res)
                    }
                  }))

  let domination = mash_res.domination.join('\n')
  let even = mash_res.even.join('\n')
  let edge = mash_res.edge.join('\n')

  console.log(`domination\n${domination}`)
  console.log(`even\n${even}`)
  console.log(`edge\n${edge}`)
}
