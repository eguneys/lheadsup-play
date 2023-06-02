import { ehs_train_main } from './ehs_train'
import { parallel_work } from './cluster'
import { test_acc_main } from './ehs_acc_test'


//test_acc_main(100)

//ehs_train_main()


let utilization = process.argv[2] === 'f' ? 100 : undefined

console.log(utilization)

parallel_work((cpus) => ehs_train_main(Math.ceil(100 / cpus)), utilization)

