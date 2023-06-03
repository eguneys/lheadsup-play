import { ehs_train_main } from './ehs_train'
import { parallel_work } from './cluster'
import { test_acc_main } from './ehs_acc_test'


test_acc_main(100)

function train_main() {
  let phase = 4
  //ehs_train_main(1, phase)
  let utilization = process.argv[2] === 'f' ? 100 : undefined
  parallel_work((cpus) => ehs_train_main(Math.ceil(100 / cpus), phase), utilization)
}
