import { it, expect, bench } from 'vitest'
import { split_cards, make_deal } from 'lheadsup'
import { ehs, ehs_async } from '../src/cards'

bench('preflop', () => {
  let cards = split_cards(make_deal(2), 7)
  ehs(cards.slice(0, 2), [])
}, { iterations: 500 })

bench('river', () => {
  let cards = split_cards(make_deal(2), 7)
  ehs(cards.slice(0, 2), cards.slice(2, 5))
}, { iterations: 500 })


bench('preflop neural', async () => {
  let cards = split_cards(make_deal(2), 7)
  ehs_async(cards.slice(0, 2), cards.slice(2, 5))
}, { iterations: 500 })
