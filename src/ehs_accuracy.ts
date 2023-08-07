import { predict_strs, networks_all } from './neural'


async function batched_neural_all_log(data: [string, [number, number, number]][]) {
  let cards = data.map(_ => _[0])
  let expected = data.map(_ => _[1])

  let res = await Promise.all(networks_all.map(async function _(network) {
    let output = await predict_strs(cards, network)


    let o_hs = output.map(_ => _[0])
    let o_ppot = output.map(_ => _[1])
    let o_npot = output.map(_ => _[2])

    let acc = [
      o_hs.filter((o, i) => Math.abs(expected[i][0] - o) < 0.09),
      o_ppot.filter((o, i) => Math.abs(expected[i][1] - o) < 0.09),
      o_npot.filter((o, i) => Math.abs(expected[i][2] - o) < 0.09)
    ]

    let outliers = [
      o_hs.filter((o, i) => Math.abs(expected[i][0] - o) >= 0.2),
      o_ppot.filter((o, i) => Math.abs(expected[i][1] - o) >= 0.2),
      o_npot.filter((o, i) => Math.abs(expected[i][2] - o) >= 0.2),
    ]

    let off_cards = o_hs.map((o, i) => Math.abs(expected[i][0] - o) >= 0.2 ? 
                    `${cards[i]}:${expected[i]}` : undefined).filter(Boolean)

    function acc_vs(acc: number[], o: number[]) {
      return (acc.length / o.length).toFixed(2)
    }

    let acc_res = [`A_HS`, acc_vs(acc[0], o_hs), `A_PPot`, acc_vs(acc[1], o_ppot),
    `A_NPot`, acc_vs(acc[2], o_npot)].join(' ')

    let res = `${network.name} ${acc_res} \n ${off_cards.slice(0, 10).join(' ')}`

    return res
  }))

  console.log(res.join('\n'))
}
