import { make_deal, split_cards, shuffle, Card } from 'lheadsup'
import { card_outs, ehs, hs, hp } from './ehs'

type Card2 = [Card, Card]
type Card3 = [Card, Card, Card]
type Card5 = [Card, Card, Card, Card, Card]

// card_outs(excludes, ?nb)
// ehs(hs, npot, ppot)
// hs(hand, flop, tr)
// hp(hand, flop, tr)
function stats(hand: [Card, Card], flop: [Card, Card, Card], turn?: Card, river?: Card) {
  let hs_, ppot, npot, ehs_

  if (!turn) {
    hs_ = hs(hand, flop, []);
    [ppot, npot] = hp(hand, flop, [])
    ehs_ = ehs(hs_, npot, ppot)
  } else if (!river) {
    hs_ = hs(hand, flop, [turn]);
    [ppot, npot] = hp(hand, flop, [turn])
    ehs_ = ehs(hs_, npot, ppot)
  } else {
    hs_ = hs(hand, flop, [turn, river]);
    [ppot, npot] = hp(hand, flop, [turn, river])
    ehs_ = ehs(hs_, npot, ppot)
  }

  return [hs_, ehs_, ppot, npot].map(_ => _.toFixed(2))
}

function stats_cards(str: string = make_deal(9)) {
  let cards = split_cards(str)
  let [hand, flop, turn, river] = [
    cards.slice(0, 2),
    cards.slice(2, 5),
    cards[5], cards[6]]

  return stats(hand as Card2, flop as Card3, turn, river)
}

function log_cards(str?: string) {
  console.log(stats_cards(str))
}

export function ehs_stats() {
  // `3c2c4d9hJc5c` 0.00 0.00 0.00 0.00

  log_cards(`3c2c4d9hJc5c`)
  log_cards()

}
