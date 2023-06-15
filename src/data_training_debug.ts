import { read_from_data_training, ehs_train_prebatch, ehs_train_main } from './ehs_train'
import { make_deal, split_cards } from 'lheadsup'


import { predict_strs } from './neural'

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


