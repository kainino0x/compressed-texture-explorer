import { FolderApi, Pane } from 'tweakpane';
import visualizeTextureWGSL from './visualizeTexture.wgsl';
import { quitIfWebGPUNotAvailable } from './util';

const outBlockBits = document.getElementById('outBlockBits') as HTMLTextAreaElement;

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
${uintToBits(p.r, 8)} ${uintToBits(p.g, 8)} ${uintToBits(p.b, 8)} ${uintToBits(p.a, 8)}`;
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
${uintToBits(p.R1, 4)} ${uintToBits(p.R2, 4)}
${uintToBits(p.G1, 4)} ${uintToBits(p.G2, 4)}
${uintToBits(p.B1, 4)} ${uintToBits(p.B2, 4)}
 ${uintToBits(p.table1, 3)}  ${uintToBits(p.table2, 3)} 0 ${toBit(p.flipBit)}
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
  format: 'etc2-rgb8unorm' as keyof typeof kCompressedFormatInfo,
};

const pane = new Pane();
pane.on('change', update);
pane
  .addBinding(settings, 'format', {
    options: Object.fromEntries(Object.keys(kCompressedFormatInfo).map((k) => [k, k])),
  })
  .on('change', updateFolders);

const formatFolders: FolderApi[] = [];
{
  const folder = pane.addFolder({ title: 'rgba8unorm' });
  formatFolders.push(folder);
  // TODO: would be nice to use a color picker here, but the 'format' option doesn't work
  folder.addBinding(parameters.rgba8unorm, 'r', { min: 0, max: 255, step: 1 });
  folder.addBinding(parameters.rgba8unorm, 'g', { min: 0, max: 255, step: 1 });
  folder.addBinding(parameters.rgba8unorm, 'b', { min: 0, max: 255, step: 1 });
  folder.addBinding(parameters.rgba8unorm, 'a', { min: 0, max: 255, step: 1 });
}
{
  const folder = pane.addFolder({ title: 'etc2-rgb8unorm' });
  formatFolders.push(folder);
  folder.addBinding(parameters['etc2-rgb8unorm'], 'R1', { min: 0, max: 15, step: 1 });
  folder.addBinding(parameters['etc2-rgb8unorm'], 'G1', { min: 0, max: 15, step: 1 });
  folder.addBinding(parameters['etc2-rgb8unorm'], 'B1', { min: 0, max: 15, step: 1 });
  folder.addBinding(parameters['etc2-rgb8unorm'], 'table1', { min: 0, max: 7, step: 1 });
  folder.addBinding(parameters['etc2-rgb8unorm'], 'R2', { min: 0, max: 15, step: 1 });
  folder.addBinding(parameters['etc2-rgb8unorm'], 'G2', { min: 0, max: 15, step: 1 });
  folder.addBinding(parameters['etc2-rgb8unorm'], 'B2', { min: 0, max: 15, step: 1 });
  folder.addBinding(parameters['etc2-rgb8unorm'], 'table2', { min: 0, max: 7, step: 1 });
  for (let i = 0; i < 16; ++i) {
    folder.addBinding(parameters['etc2-rgb8unorm'].abcdefghijklmnop, i, {
      min: 0,
      max: 3,
      step: 1,
      format: (v) => ['-large', '-small', '+small', '+large'][v],
      label: String.fromCharCode('a'.charCodeAt(0) + i) + ' mod',
    });
  }
}

function updateFolders() {
  for (const folder of formatFolders) {
    folder.hidden = folder.title !== settings.format;
  }
}
updateFolders();

let state: {
  texture: GPUTexture;
  bindGroup: GPUBindGroup;
} = undefined!;

function uintToBits(value: number, numBits: number) {
  return value.toString(2).padStart(numBits, '0');
}
//function unormToBits(value: number, numBits: number) {
//  return uintToBits(Math.round(value * (2 ** numBits - 1)), numBits);
//}
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
      throw new Error(`expected a multiple of 8 bits, got ${numBits}:\n${bits}`);
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
  device.queue.writeTexture({ texture: state.texture }, textureBytes, {}, info.blockSize);

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
