import { it, expect, bench } from 'vitest'
import { split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'
import { EncodeCardsForNN, network28 } from '../src/neural'

let network = network28

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
  let hand = cards.slice(0, 2)
  let board: Card[] = []

  let computation = network.new_computation()
  computation.AddInput(EncodeCardsForNN(hand, board))
  await computation.ComputeAsync()
}, { iterations: 500 })
