import { it, expect } from 'vitest'
import { ehsp } from '../src/ehs'
import { Card, Card3, split_cards } from 'phevaluatorjs25'
import { stats_cards } from '../src/ehs_stats'


it('works', () => {
    let cc = split_cards('JcQcKc3sQh4cTc')
    let __ = ehsp(cc.slice(0, 2) as [Card, Card], cc.slice(2, 5) as Card3, cc[5], cc[6])

    let ss = stats_cards('JcQcKc3sQh4cTc')
    console.log(ss.map(_ => _.toFixed(2)).join(' '))
})