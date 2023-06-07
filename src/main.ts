import { read_from_data_training, ehs_train_prebatch, ehs_train_main, ehs_train_stats } from './ehs_train'
import { parallel_work } from './cluster'
import { test_neural_debug, test_acc_main } from './ehs_acc_test'
import { predict_strs } from './neural'
import { make_deal, split_cards } from 'lheadsup'
import { filter_high } from './ehs_filter_train'
import { test_acc_high_from_data } from './ehs_acc_test'

//filter_high()
test_acc_high_from_data()
//test_neural_debug()

//test_acc_main(2)
//data_training_test_acc()
//train_main()
//ehs_train_main(8, 4, 1000)

async function data_training_test_acc() {
  let filename = '/tmp/ehs-data/river/data_ehsdsacw_5.gz'
  filename = '/tmp/ehs-data/data_all/data_ehsblqyn_6.gz'
  let res = await read_from_data_training(filename)

  let expected = res.map(_ => _[1])
  let output = (await predict_strs(res.map(_ => _[0]))).map(_ => _[0])


  let acc = expected.map((e, i) => Math.abs(e - output[i]))

  let corrects = acc.filter(_ => _ < 0.09)

  console.log(corrects.length / acc.length)
}

async function data_training_debug_log() {
  let res = await read_from_data_training('')

  let acc = []
  for (let i = 0; i < res.length; i++) {
    let [cards, value] = res[i]
    let v = (await predict_strs([cards]))[0][0]
    acc.push(Math.abs(v - value))
    //console.log(`["${cards.slice(0, 4)}", "${cards.slice(4)}", ${v}],`)
  }

  acc.sort()

  acc = acc.filter(_ => _ > 0.09)

  console.log(acc, acc.length)
}

function train_main() {
  let phase = 4
  let utilization = process.argv[2] === 'f' ? 100 : undefined
  let kSampleNb = parseInt(process.argv[3]) || 2
  parallel_work((cpus) => ehs_train_main(Math.ceil(kSampleNb / cpus), phase), utilization)
}

