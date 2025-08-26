// lib/canvasUtils.ts
export const combineLayers = async (layers: HTMLImageElement[]): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each layer in order
    const drawLayers = async () => {
      for (const layer of layers) {
        try {
          ctx.drawImage(layer, 0, 0, canvas.width, canvas.height);
        } catch (e) {
          console.error("Error drawing layer:", e);
        }
      }
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png', 1.0);
    };
    
    drawLayers();
  });
};

export const downloadImage = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Helper function to extract first frame from GIF
// Note: This would require a server endpoint or a GIF processing library
export const getFirstFrameOfGif = async (gifUrl: string): Promise<string> => {
  // In a real implementation, you would:
  // 1. Use a server API to extract the first frame, or
  // 2. Use a client-side library like libgif.js or gif-frames
  // For this demo, we'll return the original URL
  return gifUrl;
};