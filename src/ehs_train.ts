import { make_cards } from 'lheadsup'
import { stats_cards } from './ehs_stats'


// hs ehs ppot npot
export function gen_ehs_train() {
  let cards = make_cards(5)
  console.log(cards, stats_cards(cards))
}
