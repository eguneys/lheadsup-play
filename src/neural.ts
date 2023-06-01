import * as tf from '@tensorflow/tfjs'
import zlib from 'node:zlib'
import fs from 'fs'

type InputPlanes = number[]

const kInputPlanes = 15

type Input = tf.SymbolicTensor

function MakeResidualBlock(
  input: Input,
  channels: number,
  weights: Residual,
  basename: string) {

    let block1 = MakeConvBlock(input, 3, channels, channels,
                               weights.conv1, basename + "/conv1")

    let block2 = MakeConvBlock(block1, 3, channels, channels,
                               weights.conv2, basename + "/conv2")


    return tf.layers.reLU({ trainable: false })
    .apply(tf.layers.add().apply([input, block2])) as tf.SymbolicTensor

  }


function MakeConvBlock(
  input: Input,
  channels: number,
  input_channels: number, 
  output_channels: number, 
  weights: ConvBlock, basename: string): tf.SymbolicTensor {
    const kDataFormat = "NHWC"


    // channels 3 input_channels 11 output_channels 64
    //
    let w_conv = tf.tensor4d(weights.weights, [channels, channels, input_channels, output_channels], 'float32')

    let conv2d = tf.layers.conv2d({
      filters: output_channels,
      kernelSize: channels,
      strides: [1, 1],
      padding: 'same',
      dataFormat: 'channelsLast',
      dilationRate: [1, 1],
      activation: 'relu',
      useBias: false,
      weights: [w_conv]
    }).apply(input) as tf.SymbolicTensor

    return conv2d
  }

function MakeNetwork(input: Input, weights: WeightsLegacy) {

  let filters = 64

  let flow = MakeConvBlock(input, 3, kInputPlanes, filters, weights.input, "input/conv")

  weights.residual.forEach((block, i) =>
                           flow = MakeResidualBlock(flow, filters, block,
                                                    `block_${i}`))

  let conv_val = MakeConvBlock(flow, 1, filters, 32, weights.value, "value/conv")

  conv_val = tf.layers.flatten().apply(conv_val) as tf.SymbolicTensor

  let ip1_val_w = tf.tensor(weights.ip1_val_w, [8 * 32, 128])
  let ip1_val_b = tf.tensor(weights.ip1_val_b, [128])

  let value_flow = tf.layers.dense({
    units: 128,
    activation: 'relu',
    useBias: true,
    weights: [ip1_val_w, ip1_val_b],
    trainable: false
  }).apply(conv_val) as tf.SymbolicTensor

  let ip2_val_w = tf.tensor(weights.ip2_val_w, [128, 1])
  let ip2_val_b = tf.tensor(weights.ip2_val_b, [1])

  let value_head = tf.layers.dense({
    units: 1,
    activation: 'tanh',
    useBias: true,
    weights: [ip2_val_w, ip2_val_b],
    name: 'value/out',
    trainable: false
  }).apply(value_flow) as tf.SymbolicTensor

  let model = tf.model({ inputs: input, outputs: value_head })
  return model
}



class NetworkComputation {

  input!: tf.Tensor
  output!: any

  raw_input: InputPlanes[] = []

  constructor(readonly network: Network) {
  }

  AddInput(input: InputPlanes) {
    this.raw_input.push(input)
  }

  PrepareInput() {
    let shape = [this.raw_input.length, 1, 8, kInputPlanes]
    let values: number[] = []
    this.raw_input.forEach(sample => {
      const buffer = new Uint8Array(sample)
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i]
        for (let j = 0; j < 8; j++) {
          const bit = (byte >> j) & 1
          values.push(bit)
        }
      }
    })
    this.input = tf.tensor(values, shape)
  }

  async ComputeAsync() {
    this.PrepareInput()
    this.output = await (this.network.Compute(this.input) as tf.Tensor).array()
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
    const uint8Array = new Uint8Array(arrayBuffer)
    const uint16Array = new Uint16Array(arrayBuffer);

    for (let i = 0; i < decodedString.length; i++) {
        uint8Array[i] = decodedString.charCodeAt(i);
    }

    let params = Array.from(uint16Array)


    let range = max_val - min_val
    params = params.map(_ => _ / (0xffff) * range + min_val)

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
    let weights = await load_weights_from_file('networks/ehs1-140.json.gz')

    let input = tf.input({ shape: [1, 8, kInputPlanes], dtype: 'float32', name: 'input_planes'})
    this.model = MakeNetwork(input, weights)


    let fake_request = this.new_computation()
    fake_request.AddInput(Array(kInputPlanes))
    await fake_request.ComputeAsync()
  }


  new_computation() {
    return new NetworkComputation(this)
  }


  Compute(input: tf.Tensor) {
    return this.model.predict(input)
  }
}

let network = new Network()
await network.init()
export { network }
