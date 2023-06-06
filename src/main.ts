import { read_from_data_training, ehs_train_prebatch, ehs_train_main, ehs_train_stats } from './ehs_train'
import { parallel_work } from './cluster'
import { test_neural_debug, test_acc_main } from './ehs_acc_test'
import { predict_str } from './neural'
import { make_deal, split_cards } from 'lheadsup'

//ehs_train_stats()
//test_acc_main(5)
//ehs_train_prebatch()

//test_neural_debug()

//let res = await read_from_data_training()

/*
let acc = []
for (let i = 0; i < res.length; i++) {
  let [cards, value] = res[i]
  let v = await predict_str(cards.slice(0, 4), cards.slice(4))
  acc.push(Math.abs(v - value))
  //console.log(`["${cards.slice(0, 4)}", "${cards.slice(4)}", ${v}],`)
}

acc.sort()

acc = acc.filter(_ => _ > 0.09)

console.log(acc, acc.length)
*/

function train_main() {
  let phase = 4
  let utilization = process.argv[2] === 'f' ? 100 : undefined
  let kSampleNb = parseInt(process.argv[3]) || 2
  parallel_work((cpus) => ehs_train_main(Math.ceil(kSampleNb / cpus), phase), utilization)
}

train_main()
