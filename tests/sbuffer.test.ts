import { it, expect } from 'vitest'
import { RoundNPov } from 'phevaluatorjs25'
import { RangeStats } from '../src/sbuffer'

it('works', async () => {
  let data = [
    '10-20 1 | d3000 / d3000 $!',
    '10-20 1 | i2980 3cQs bb-0-0-20 / @2990 sb-0-0-10 $!',
    '10-20 1 | @2980 3cQs bb-0-0-20 / i2960 raise-10-10-20 $!',
    '10-20 1 | i2840 3cQs raise-20-20-120 / @2960 raise-10-10-20 $!',
    '10-20 1 | @2840 3cQs raise-20-20-120 / i2720 raise-40-120-120 $!',
    '10-20 1 | i1840 3cQs raise-160-120-880 / @2720 raise-40-120-120 $!',
    '10-20 1 | @1840 3cQs raise-160-120-880 / i960 raise-280-880-880 $!',
    '10-20 1 | f1840 3cQs fold-1160 / p960 raise-280-880-880 $!',
    '10-20 1 | f1840 3cQs / w960 $ 3200-2 !',
    '10-20 1 | f1840 3cQs / w960 $ 3200-2 ! shares win-2-3200',
    '10-20 2 | d1840 / d4160 $!',
    '10-20 2 | @1830 Jd6h sb-0-0-10 / i4140 bb-0-0-20 $!',
    '10-20 2 | i1820 Jd6h call-10-10 / @4140 bb-0-0-20 $!',
    '10-20 2 | @1820 Jd6h call-10-10 / i4120 raise-20-0-20 $!',
    '10-20 2 | p1800 Jd6h call-20-20 / p4120 raise-20-0-20 $!',
    '10-20 2 | i1800 Jd6h / @4120 $ 80-12 !5hTc5d',
    '10-20 2 | @1800 Jd6h / i4100 raise-0-0-20 $ 80-12 !5hTc5d',
    '10-20 2 | f1800 Jd6h fold-0 / p4100 raise-0-0-20 $ 80-12 !5hTc5d',
    '10-20 2 | f1800 Jd6h / w4100 $ 100-2 !5hTc5d',
    '10-20 2 | f1800 Jd6h / w4100 $ 100-2 !5hTc5d shares win-2-100',
    '10-20 1 | d1800 / d4200 $!',
    '10-20 1 | i1780 7d6h bb-0-0-20 / @4190 sb-0-0-10 $!',
    '10-20 1 | @1780 7d6h bb-0-0-20 / i4160 raise-10-10-20 $!',
    '10-20 1 | p1760 7d6h call-20-20 / p4160 raise-10-10-20 $!',
    '10-20 1 | @1760 7d6h / i4160 $ 80-12 !QdAd9c',
    '10-20 1 | i1760 7d6h check-0 / @4160 $ 80-12 !QdAd9c',
    '10-20 1 | @1760 7d6h check-0 / i4140 raise-0-0-20 $ 80-12 !QdAd9c',
    '10-20 1 | p1740 7d6h call-0-20 / p4140 raise-0-0-20 $ 80-12 !QdAd9c',
    '10-20 1 | @1740 7d6h / i4140 $ 120-12 !QdAd9c4h',
    '10-20 1 | i1740 7d6h check-0 / @4140 $ 120-12 !QdAd9c4h',
    '10-20 1 | @1740 7d6h check-0 / i4120 raise-0-0-20 $ 120-12 !QdAd9c4h',
    '10-20 1 | p1720 7d6h call-0-20 / p4120 raise-0-0-20 $ 120-12 !QdAd9c4h',
    '10-20 1 | @1720 7d6h / i4120 $ 160-12 !QdAd9c4hJs',
    '10-20 1 | i1720 7d6h check-0 / @4120 $ 160-12 !QdAd9c4hJs',
    '10-20 1 | @1720 7d6h check-0 / i4100 raise-0-0-20 $ 160-12 !QdAd9c4hJs',
    '10-20 1 | f1720 7d6h fold-0 / p4100 raise-0-0-20 $ 160-12 !QdAd9c4hJs',
    '10-20 1 | f1720 7d6h / w4100 $ 180-2 !QdAd9c4hJs',
    '10-20 1 | f1720 7d6h / w4100 $ 180-2 !QdAd9c4hJs shares win-2-180',
    '10-20 2 | d1720 / d4280 $!',
    '10-20 2 | @1710 Jc2c sb-0-0-10 / i4260 bb-0-0-20 $!',
    '10-20 2 | i1700 Jc2c call-10-10 / @4260 bb-0-0-20 $!',
    '10-20 2 | @1700 Jc2c call-10-10 / i4240 raise-20-0-20 $!',
    '10-20 2 | i1560 Jc2c raise-20-20-120 / @4240 raise-20-0-20 $!',
    '10-20 2 | @1560 Jc2c raise-20-20-120 / i4000 raise-40-120-120 $!',
    '10-20 2 | i560 Jc2c raise-160-120-880 / @4000 raise-40-120-120 $!',
    '10-20 2 | @560 Jc2c raise-160-120-880 / i2240 raise-280-880-880 $!',
    '10-20 2 | a0 Jc2c allin-1160-560-0 / p2240 raise-280-880-880 $!',
    '10-20 2 | s0 Jc2c / s2240 Kc9c $ 320-2side 3440-21 !',
    '10-20 2 | s0 Jc2c / s2240 Kc9c $ 320-2side 3440-21 ! shares back-2-320 swin-2-3440'
  ]

  let r = new RangeStats(data.map(_ => RoundNPov.from_fen(_)))

  await r.fill_async()

  //console.log(r.ranges)
  expect(r.samples('deal').length).toBe(4)
})
