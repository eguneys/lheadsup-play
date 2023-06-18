import { make_cards, split_cards, shuffle, Card } from 'lheadsup'
import { card_outs, ehs, hp, ehsp } from './ehs'

type Card2 = [Card, Card]
type Card3 = [Card, Card, Card]
type Card5 = [Card, Card, Card, Card, Card]

// card_outs(excludes, ?nb)
// ehs(hs, npot, ppot)
// hs(hand, flop, tr)
// hp(hand, flop, tr)
//
export function stats_cards(str: string) {
  let cards = split_cards(str)
  let [hand, flop, turn, river] = [
    cards.slice(0, 2),
    cards.slice(2, 5),
    cards[5], cards[6]]

  return ehsp(hand as Card2, flop as Card3, turn, river)
}

function log_cards(str: string = make_cards(7)) {
  let stats = stats_cards(str)
  console.log(str, stats.map(_ => _.toFixed(2)).join(' '))
}

export function ehs_stats() {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 6; j++) {
      log_cards(make_cards(5 + i))
    }
  }
}
