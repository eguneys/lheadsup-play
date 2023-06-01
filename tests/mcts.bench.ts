import { it, expect, bench } from 'vitest'
import { split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'
import { network } from '../src/neural'


bench('preflop', () => {
  let cards = split_cards(7, make_deal(2))
  ehs(cards.slice(0, 2), [])
}, { iterations: 500 })

bench('flop', () => {
  let cards = split_cards(7, make_deal(2))
  ehs(cards.slice(0, 2), cards.slice(2, 5))
}, { iterations: 500 })


bench('preflop neural', async () => {
  let computation = network.new_computation()

  computation.AddInput(Array(15 * 8))
  await computation.ComputeAsync()
}, { iterations: 500 })
