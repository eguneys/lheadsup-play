import { ehs_train_main, ehs_train_stats } from './ehs_train'
import { parallel_work } from './cluster'
import { test_acc_main } from './ehs_acc_test'
import { predict_str } from './neural'
import { make_deal, split_cards } from 'lheadsup'

let res = [...Array(10).keys()].map(_ => make_deal(2))

res = [
  'AcQhTh5c8d8hQcAsKs',
  '3sJh3c7h2c6c2hAd8h',
  '4c4sQh8h3c8c6dQsJd',
  '9dQhJhTsQs7dTcJdQd',
  '8dJd5h2sQc6h5s6c8s',
  'Js3c3s8h9s8dQs9dQd',
  '9hJh5d8d9s7sQhQd3s',
  '9s3h8c8h2sQdAs7cAh',
  '7dQc6sKd7hAcThTs2h',
  '2h3hAh4cQh8h5h7dQd'
]

res = [...Array(100).keys()].map(_ => make_deal(2))
for (let i = 0; i < res.length; i++) {
  let cards = split_cards(7, res[i])
  let hand = cards.slice(0, 2).join('')
  let board = cards.slice(2, 7).join('')
  console.log(`["${hand}", "${board}", ${await predict_str(hand, board)}],`)
}

//ehs_train_stats()
//test_acc_main(5)

function train_main() {
  let phase = 4
  //ehs_train_main(1, phase)
  let utilization = process.argv[2] === 'f' ? 100 : undefined
  parallel_work((cpus) => ehs_train_main(Math.ceil(100 / cpus), phase), utilization)
}

//train_main()
