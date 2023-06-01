import * as tf from '@tensorflow/tfjs'
import zlib from 'node:zlib'
import fs from 'fs'

const kInputPlanes = 8

type Input = tf.SymbolicTensor

function MakeConvBlock(
  input: Input,
  channels: number,
  input_channels: number, 
  output_channels: number, 
  weights: any, basename: string): tf.SymbolicTensor {
    const kDataFormat = "NHWC"

    let w_conv = tf.tensor4d(weights.weights, [channels, channels, input_channels, output_channels], 'float32')

    //let conv2d = tf.conv2d(input, w_conv, [1, 1], "same", kDataFormat)
    
    let conv2d = tf.layers.conv2d({
      filters: channels,
      kernelSize: channels,
      strides: [1, 1],
      padding: 'same',
      dataFormat: 'channelsLast',
      dilationRate: [1, 1],
      useBias: false,
      weights: [w_conv]
    }).apply(input) as tf.SymbolicTensor

    return conv2d
  }

function MakeNetwork(input: Input, weights: WeightsLegacy) {

  let kInputPlanes = 3
  let filters = 30

  let flow = MakeConvBlock(input, 3, kInputPlanes, filters, weights.input, "input/conv")

  let conv_val = MakeConvBlock(flow, 1, filters, 32, weights.value, "value/conv")

  let ip2_val_w = tf.tensor(weights.ip2_val_w, [128, 1])
  let value_head = tf.layers.dense({
    units: 1,
    activation: 'tanh',
    useBias: true,
    biasInitializer: tf.initializers.constant({ value: 0 }),
    //kernelRegularizer: l2reg
    weights: [ip2_val_w],
    name: 'value/out'
  }).apply(conv_val) as tf.SymbolicTensor

  let model = tf.model({ inputs: input, outputs: value_head })
  return model
}



class NetworkComputation {

  input!: tf.Tensor
  output: any

  constructor(readonly network: Network) {
  }

  get value_head() {
    return this.output[0]
  }

  AddInput(input: any) {
  }

  PrepareInput() {
  }

  ComputeAsync() {
    this.PrepareInput()
    this.network.Compute(this.input)
  }

  GetBatchSize() {
  }

  GetQVal(sample: number) {
  }
}





async function load_weights_from_file(filename: string) {
  let buffer = await decompress_gzip(filename)

  return parse_weights_json(buffer)
}


function decompress_gzip(filename: string): Promise<Buffer> {
  return new Promise(resolve => {
    fs.readFile(filename, (err, buffer) => {
      zlib.gunzip(buffer, (err, buffer) => {
        resolve(buffer)
      })
    })
  })
}

/*
type Layer = {
  min_val: number,
  max_val: number,
  params: number[]
}
*/

type Layer = number[]

type Residual = {
  conv1: ConvBlock,
  conv2: ConvBlock
}
type ConvBlock = {
  weights: Layer
}
type WeightsLegacy = {
  input: ConvBlock,
  residual: Residual[],
  value: ConvBlock,
  ip1_val_w: Layer,
  ip1_val_b: Layer,
  ip2_val_w: Layer,
  ip2_val_b: Layer,
}

function parse_weights_json(buffer: Buffer): WeightsLegacy {
  let { weights } = JSON.parse(buffer.toString('utf-8'))

  function parse_layer(l: any) {

    let min_val = l.min_val
    let max_val = l.max_val
    let decodedString = atob(l.params)

    const arrayBuffer = new ArrayBuffer(decodedString.length);
    const uint16Array = new Uint16Array(arrayBuffer);

    for (let i = 0; i < decodedString.length; i++) {
        uint16Array[i] = decodedString.charCodeAt(i);
    }

    let params = Array.from(uint16Array)


    return params
  }

  function parse_conv(c: any) {
    return {
      weights: parse_layer(c.weights)
    }
  }

  function parse_residual(r: any) {
    return { conv1: parse_conv(r.conv1), conv2: parse_conv(r.conv2) }
  }

  let input = parse_conv(weights.input)
  let residual = weights.residual.map(parse_residual)

  let value = parse_conv(weights.value)
  let ip1_val_w = parse_layer(weights.ip1_val_w)
  let ip1_val_b = parse_layer(weights.ip1_val_b)
  let ip2_val_w = parse_layer(weights.ip2_val_w)
  let ip2_val_b = parse_layer(weights.ip2_val_b)

  return {
    input,
    residual,
    value,
    ip1_val_w,
    ip1_val_b,
    ip2_val_w,
    ip2_val_b
  }

}


export class Network {

  model!: tf.LayersModel

  async init() {
    let weights = await load_weights_from_file('networks/ehs1-0.json.gz')

    let input = tf.input({ shape: [null, 8, 8, kInputPlanes], dtype: 'float32', name: 'input_planes'})
    this.model = MakeNetwork(input, weights)
  }


  net_computation() {
    return new NetworkComputation(this)
  }


  Compute(input: tf.Tensor) {
    return this.model.predict(input)
  }
}

let network = new Network()
network.init()

