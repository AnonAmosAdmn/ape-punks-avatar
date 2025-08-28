declare module 'gifencoder' {
  class GIFEncoder {
    constructor(width: number, height: number);
    start(): void;
    setRepeat(repeat: number): void;
    setDelay(ms: number): void;
    setQuality(quality: number): void;
    addFrame(ctx: CanvasRenderingContext2D): void;
    finish(): void;
    createReadStream(): NodeJS.ReadableStream;
  }
  export default GIFEncoder;
}
