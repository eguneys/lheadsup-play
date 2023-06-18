import { ehs, ehs_str } from './cards'
import { make_deal, Card, split_cards } from 'lheadsup'
import { sum, mean, variance } from './util'



export function ehs_plus(hand: Card[], board: Card[]) {
  let res = []
  for (let i = 0; i < 5; i++) {
    res.push(ehs(hand, board, 50, false))
  }
  return [mean(res), variance(res)]
}


export function ehs_plus_str(s: string) {
  let cards = split_cards(s)
  return ehs_plus(cards.slice(0, 2), cards.slice(2, 7))
}


function tests() {
  for (let i = 0; i < 10; i++) {
  //console.log(ehs_plus_str(`4s6sKh7hAd7cAs`))
  }
  throw 3

  const log = (_: string) => console.log(_, ehs_plus_str(_))

  let cards = [...Array(10).keys()].map(_ => make_deal(2).slice(0, 14))

  cards.forEach(log);

  console.log('here');

  ;[
    `7cJcJh3s6dTs5s`,
    `4s6sKh7hAd7cAs`
  ].forEach(log)
}

tests()
