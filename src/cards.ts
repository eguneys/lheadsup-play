import { Card, shuffle, hand_rank, cards } from 'lheadsup'
import { predict_strs } from './neural'

const dummy = 'AhAhAhAhAh'
const pad_flop = (_: string) => _.length === 4 ? dummy : _

export async function ehs_async_batched(hb: [Card[], Card[]][], nb = 50, use_cache = true) {
  let res = (await predict_strs(hb.map(_ => pad_flop([..._[0], ..._[1]].join('')))))
  .map(_ => _[0])

  hb.forEach((hb, i) => {
    if (hb[1].length === 0) {
      res[i] = ehs(hb[0],  hb[1], nb, use_cache)
    }
  })
  return res
}

export async function ehs_async(hand: Card[], board: Card[], nb = 50, use_cache = true) {
  if (board.length === 0) {
    return ehs(hand, board, nb, use_cache)
  }

  return (await predict_strs([[...hand, ...board].join('')]))[0][0]
}




export function card_outs(excludes: Card[], n: number) {
  return shuffle(cards.filter(_ => !excludes.includes(_))).slice(0, n)
}




let cache: any = {}

export function ehs(hand: Card[], board: Card[], nb = 50, use_cache = true) {
  let ahead = 0

  let i = cache[hand.join('') + board.join('')]
  if (use_cache && i) {
    return i
  }

  for (let i = 0; i < nb; i++) {
    let op = card_outs([...board, ...hand], 2)
    let board_rest = card_outs([...hand, ...board, ...op], 5 - board.length)

    let my_hand = [...hand, ...board, ...board_rest]
    let op_hand = [...op, ...board, ...board_rest]

    if (hand_rank(my_hand).hand_eval >= hand_rank(op_hand).hand_eval) {
      ahead ++;
    }
  }
  let res = ahead / nb

  if (use_cache) {
    cache[hand.join('') + board.join('')] = res
  }
  return res
}

/*
let res: any = []
for (let i = 0; i < 100; i++) {
  let hand = card_outs([], 2)
  res.push([hand.join(''), ehs(hand, [])])
}
res.sort((a: any, b: any) => a[1] - b[1])
console.log(res)
console.log(ehs(['Kc', 'Qd'], []))
console.log(ehs(['Ac', 'Qd'], []))
console.log(ehs(['Ac', 'Ad'], []))
*/
//console.log(ehs(['Td', 'Qh'], ['2c', 'Jd', 'Kc']))
//
//console.log(ehs(['2s', '4h'], ['Td','Tc','6h','Qs']))
// console.log(ehs(['9s', '3c'], ['8s','Td','6s','Ah']))
//console.log(ehs(['Qs', 'Qc'], []))
//console.log(ehs(['As', 'Kc'], []))
//console.log(ehs(['As', 'Ks'], []))


