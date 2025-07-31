import { GUI } from 'dat.gui';
import visualizeTextureWGSL from './visualizeTexture.wgsl';
import { quitIfWebGPUNotAvailable } from './util';

const outBlockBits = document.getElementById(
  'outBlockBits'
) as HTMLTextAreaElement;

const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const device = await (async () => {
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: 'compatibility',
  });
  const requiredFeatures: GPUFeatureName[] = [];
  for (const feature of [
    'texture-compression-etc2',
    'texture-compression-bc',
    'texture-compression-astc',
  ] as const) {
    if (adapter?.features.has(feature)) {
      requiredFeatures.push(feature);
    }
  }
  const device = await adapter?.requestDevice({ requiredFeatures });
  quitIfWebGPUNotAvailable(adapter, device);
  return device;
})();

const context = canvas.getContext('webgpu') as GPUCanvasContext;

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device,
  format: presentationFormat,
});

const fullscreenQuadModule = device.createShaderModule({
  code: visualizeTextureWGSL,
});
const fullscreenQuadPipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: fullscreenQuadModule,
  },
  fragment: {
    module: fullscreenQuadModule,
    targets: [
      {
        format: presentationFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',
  },
});

const sampler = device.createSampler({});

const kCompressedFormatInfo = {
  rgba8unorm: {
    blockSize: [1, 1, 1],
    blockByteSize: 4,
    encode({ rgba8unorm: p }: typeof parameters) {
      return `\
${toBits(p.r, 8)} ${toBits(p.g, 8)} ${toBits(p.b, 8)} ${toBits(p.a, 8)}`;
    },
  },
  'etc2-rgb8unorm': {
    blockSize: [4, 4, 1],
    blockByteSize: 8,
    encode({ 'etc2-rgb8unorm': p }: typeof parameters) {
      switch (p.mode) {
        case 'individual':
          const kPixelIndexValues = [3, 2, 0, 1];
          const ponmlkjihgfedcba = p.abcdefghijklmnop.toReversed();
          return `\
${toBits(p.R1, 4)} ${toBits(p.R2, 4)}
${toBits(p.G1, 4)} ${toBits(p.G2, 4)}
${toBits(p.B1, 4)} ${toBits(p.B2, 4)}
 ${toBits(p.table1, 3)}  ${toBits(p.table2, 3)} 0 ${toBit(p.flipBit)}
${ponmlkjihgfedcba.map((v) => (kPixelIndexValues[v] >>> 1) & 1).join(' ')}
${ponmlkjihgfedcba.map((v) => (kPixelIndexValues[v] >>> 0) & 1).join(' ')}`;
      }
      return '0000000000000000000000000000000000000000000000000000000000000000'; // TODO
    },
  },
  'bc3-rgba-unorm': {
    blockSize: [4, 4, 1],
    blockByteSize: 16,
    encode(p: typeof parameters) {
      console.log(p);
      return '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'; // TODO
    },
  },
  'astc-6x6-unorm': {
    blockSize: [6, 6, 1],
    blockByteSize: 16,
    encode(p: typeof parameters) {
      console.log(p);
      return '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'; // TODO
    },
  },
} as const;
const kDefaultFormat: GPUTextureFormat = 'etc2-rgb8unorm';

const kLargestBlockByteSize = Math.max(
  ...Object.values(kCompressedFormatInfo).map((info) => info.blockByteSize)
);

const parameters = {
  'etc2-rgb8unorm': {
    mode: 'individual',
    R1: 0,
    G1: 15,
    B1: 0,
    table1: 6,
    R2: 0,
    G2: 0,
    B2: 15,
    table2: 6,
    flipBit: false,
    abcdefghijklmnop: [0, 1, 2, 3, 1, 1, 1, 2, 2, 1, 1, 1, 3, 2, 1, 0],
  },
  rgba8unorm: { r: 0, g: 100, b: 200, a: 127 },
};
const settings = {
  format: kDefaultFormat,
};

const gui = new GUI();
gui
  .add(settings, 'format', Object.keys(kCompressedFormatInfo))
  .onChange(update);
{
  const folder = gui.addFolder('rgba8unorm');
  folder.open();
  folder.add(parameters.rgba8unorm, 'r', 0, 255, 1).onChange(update);
  folder.add(parameters.rgba8unorm, 'g', 0, 255, 1).onChange(update);
  folder.add(parameters.rgba8unorm, 'b', 0, 255, 1).onChange(update);
  folder.add(parameters.rgba8unorm, 'a', 0, 255, 1).onChange(update);
}
{
  const folder = gui.addFolder('etc2-rgb8unorm');
  folder.open();
  folder
    .add(parameters['etc2-rgb8unorm'], 'mode', [
      'individual',
      'differential',
      'T',
      'H',
      'planar',
    ])
    .onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'flipBit').onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'R1', 0, 15, 1).onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'G1', 0, 15, 1).onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'B1', 0, 15, 1).onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'table1', 0, 7, 1).onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'R2', 0, 15, 1).onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'G2', 0, 15, 1).onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'B2', 0, 15, 1).onChange(update);
  folder.add(parameters['etc2-rgb8unorm'], 'table2', 0, 7, 1).onChange(update);
  for (let i = 0; i < 16; ++i) {
    // TODO: ideally these would show as -large, -small, +small, +large, or
    // even better using the lookup values from the actual table
    folder
      .add(parameters['etc2-rgb8unorm'].abcdefghijklmnop, i, 0, 3, 1)
      .name(String.fromCharCode('a'.charCodeAt(0) + i) + ' modifier')
      .onChange(update);
  }
}

let state: {
  texture: GPUTexture;
  bindGroup: GPUBindGroup;
} = undefined!;

function toBits(value: number, numBits: number) {
  return value.toString(2).padStart(numBits, '0');
}
function toBit(value: number | boolean) {
  return value ? '1' : '0';
}

const dataFromBits = (() => {
  const scratchBytes = new Uint8Array(kLargestBlockByteSize);
  return function dataFromBitsString(bits: string) {
    let numBits = 0;
    let byte = 0;
    for (const char of bits) {
      if (char !== '0' && char !== '1') continue;
      byte <<= 1;
      if (char === '1') byte |= 1;
      numBits++;
      if (numBits % 8 === 0) {
        scratchBytes[Math.floor(numBits / 8) - 1] = byte;
        byte = 0;
      }
    }
    if (numBits % 8 !== 0) {
      throw new Error(
        `expected a multiple of 8 bits, got ${numBits}:\n${bits}`
      );
    }
    return scratchBytes.slice(0, numBits / 8);
  };
})();

function update() {
  const info = kCompressedFormatInfo[settings.format];

  if (state === undefined || state.texture.format !== settings.format) {
    const texture = device.createTexture({
      format: settings.format,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      size: info.blockSize,
    });

    const bindGroup = device.createBindGroup({
      layout: fullscreenQuadPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });

    state = { texture, bindGroup };
  }

  const bitsString = info.encode(parameters);
  outBlockBits.textContent = bitsString;
  const textureBytes = dataFromBits(bitsString);
  device.queue.writeTexture(
    { texture: state.texture },
    textureBytes,
    {},
    info.blockSize
  );

  const commandEncoder = device.createCommandEncoder();

  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });

  passEncoder.setPipeline(fullscreenQuadPipeline);
  passEncoder.setBindGroup(0, state.bindGroup);
  passEncoder.draw(6);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}

update();
