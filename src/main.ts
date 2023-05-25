import { self_play } from './hand_eval'
import { Search } from './mtcs'
import { MinRaiser, Caller, Folder, one_tournament } from './headsup_ai'

let players = [
  ['min_raiser', 'always raises minimum', MinRaiser],
  ['caller', 'always calls', Caller],
  ['folder', 'alawys folds', Folder]
]

mashup_players()

function mashup_players() {

  function mash(p1: any, p2: any) {
    let [name, desc, klass] = p1
    let [name2, desc2, klass2] = p2

    let i1 = new klass()
    let i2 = new klass()


    let res = one_tournament(i1, i2)
    let total = res[0] + res[1]

    console.log(`${name} vs ${name2} ${Math.floor(res[0] / total * 100)}% ${Math.floor(res[1] / total * 100)}%`)
  }

  players.forEach(p => mash(p, p))

  players.forEach(p1 =>
                  players.forEach(p2 => p1 !== p2 && mash(p1, p2)))
}
