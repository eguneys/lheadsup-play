import { ehs_train_main } from './ehs_train'
import { parallel_work } from './cluster'
import { test_neural_debug, test_acc_main } from './ehs_acc_test'

import { mash_main } from './mash'

mash_main()





async function test_phases() {
  await test_acc_main('f', 2)
  await test_acc_main('t', 2)
  await test_acc_main('r', 2)
}

function train_main() {
  console.log('Usage: pnpm start f kSampleNb phase') 
  let utilization = process.argv[2] === 'f' ? 1 : 0.1
  let kSampleNb = parseInt(process.argv[3]) || 2
  let phase = process.argv[4]
  parallel_work((cpus) => ehs_train_main(Math.ceil(kSampleNb / cpus), 
                                         phase, 10000), utilization)
}
