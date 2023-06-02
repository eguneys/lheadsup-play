import { ehs_train_main } from './ehs_train'
import { parallel_work } from './cluster'


//ehs_train_main()
parallel_work((cpus) => ehs_train_main(Math.ceil(100 / cpus)))
