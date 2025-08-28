declare module "gifenc" {
  export function GIFEncoder(width: number, height: number): {
    writeFrame: (
      imageData: Uint8Array | Uint8ClampedArray,
      options?: { delay?: number; disposal?: number }
    ) => void;
    finish: () => Uint8Array;
  };

  export function quantize(
    pixels: Uint8Array | Uint8ClampedArray,
    maxColors: number
  ): Uint8Array;

  export function applyPalette(
    pixels: Uint8Array | Uint8ClampedArray,
    palette: Uint8Array,
    dithering?: boolean
  ): Uint8Array;
}
