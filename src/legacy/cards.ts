import { split_cards, Card, shuffle, hand_rank, cards } from 'lheadsup'
import { predict_strs } from './neural'
import { mean } from './util'

const dummy = 'AhAhAhAhAh'
const pad_flop = (_: string) => _.length === 4 ? dummy : _


export async function ehs_async_batched(hb: [Card[], Card[]][], nb = 50, use_cache = true) {
  if (hb.length === 0) {
    return []
  }
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

let cache = (() => {
  let res: Record<string, number> = {}

  let hands = cards.flatMap(c1 => 
                cards.map(c2 => c1 === c2 ? undefined : [c1, c2]).filter(Boolean))

  hands.forEach(hand => {

    let v = []
    for (let i = 0; i < 20; i++) {
      let board = card_outs(hand!, 5)
      v.push(ehs(hand!, board))
    }
    console.log(hand!.join(''), v)
    res[hand!.join('')] = mean(v)
  })
  console.log(res)
  return res
})()

export function ehs_preflop(hand: Card[]) {
  return 0
  //return cache[hand.join('')]
}

export function ehs(hand: Card[], board: Card[], nb = 50, use_cache = true): number {
  if (board.length === 0) {
    return ehs_preflop(hand)
  }

  let ahead = 0
  for (let i = 0; i < nb; i++) {
    let op = card_outs([...board, ...hand], 2)
    let board_rest = card_outs([...hand, ...board, ...op], 5 - board.length)

    let my_hand = [...hand, ...board, ...board_rest]
    let op_hand = [...op, ...board, ...board_rest]

    let my_eval = hand_rank(my_hand).hand_eval 
    let op_eval = hand_rank(op_hand).hand_eval
    if (my_eval > op_eval) {
      ahead++;
    } else if (my_eval === op_eval) {
      if (ehs_preflop(hand) * 1.99 > Math.random()) {
        ahead++;
      }
    }
  }
  let res = ahead / nb

  return res
}

export async function ehs_async_str(s: string) {
  let cards = split_cards(s)
  return ehs_async(cards.slice(0, 2), cards.slice(2))
}

export function ehs_str(s: string) {
  let cards = split_cards(s)
  return ehs(cards.slice(0, 2), cards.slice(2))
}



