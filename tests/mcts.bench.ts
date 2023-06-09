import { it, expect, bench } from 'vitest'
import { split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'
import { predict_strs } from '../src/neural'

bench('preflop', () => {
  let cards = split_cards(7, make_deal(2))
  ehs(cards.slice(0, 2), [])
}, { iterations: 500 })

bench('river', () => {
  let cards = split_cards(7, make_deal(2))
  ehs(cards.slice(0, 2), cards.slice(2, 5))
}, { iterations: 500 })


bench('preflop neural', async () => {
  let cards = split_cards(7, make_deal(2))

  await predict_strs([cards.slice(0, 5).join('')])

}, { iterations: 500 })
