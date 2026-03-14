/**
 * Client-side receipt image preprocessing.
 * Runs canvas operations to improve OCR accuracy before upload.
 */

interface QualityResult {
  ok: boolean;
  message?: string;
  brightness: number;
  contrast: number;
  sharpness: number;
}

interface PreprocessResult {
  file: File;
  preview: string;
  quality: QualityResult;
}

/**
 * Analyse image quality — brightness, contrast, and estimated sharpness.
 */
function analyseQuality(imageData: ImageData): QualityResult {
  const { data, width, height } = imageData;
  const totalPixels = width * height;

  let brightnessSum = 0;
  const histogram = new Uint32Array(256);

  // Calculate brightness and build histogram
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    brightnessSum += lum;
    histogram[Math.round(lum)]++;
  }

  const avgBrightness = brightnessSum / totalPixels;

  // Contrast: standard deviation of luminance
  let varianceSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    varianceSum += (lum - avgBrightness) ** 2;
  }
  const contrast = Math.sqrt(varianceSum / totalPixels);

  // Sharpness: Laplacian variance (sample every 2nd pixel for speed)
  let laplacianVariance = 0;
  let laplacianCount = 0;
  const stride = 2;

  for (let y = 1; y < height - 1; y += stride) {
    for (let x = 1; x < width - 1; x += stride) {
      const idx = (y * width + x) * 4;
      const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      const top = 0.299 * data[idx - width * 4] + 0.587 * data[idx - width * 4 + 1] + 0.114 * data[idx - width * 4 + 2];
      const bottom = 0.299 * data[idx + width * 4] + 0.587 * data[idx + width * 4 + 1] + 0.114 * data[idx + width * 4 + 2];
      const left = 0.299 * data[idx - 4] + 0.587 * data[idx - 3] + 0.114 * data[idx - 2];
      const right = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];

      const laplacian = Math.abs(4 * center - top - bottom - left - right);
      laplacianVariance += laplacian * laplacian;
      laplacianCount++;
    }
  }

  const sharpness = laplacianCount > 0 ? Math.sqrt(laplacianVariance / laplacianCount) : 0;

  // Quality thresholds
  if (avgBrightness < 40) {
    return { ok: false, message: "This photo is too dark. Please retake the receipt photo with better lighting.", brightness: avgBrightness, contrast, sharpness };
  }
  if (avgBrightness > 240) {
    return { ok: false, message: "This photo is overexposed (too bright). Please retake avoiding direct light on the receipt.", brightness: avgBrightness, contrast, sharpness };
  }
  if (contrast < 15) {
    return { ok: false, message: "This photo has very low contrast — the receipt text may not be readable. Please retake in better lighting.", brightness: avgBrightness, contrast, sharpness };
  }
  if (sharpness < 3) {
    return { ok: false, message: "This photo is too blurry. Please hold your phone steady and make sure the receipt is in focus.", brightness: avgBrightness, contrast, sharpness };
  }

  return { ok: true, brightness: avgBrightness, contrast, sharpness };
}

/**
 * Apply contrast enhancement using adaptive histogram-like stretch.
 */
function enhanceContrast(data: Uint8ClampedArray, strength: number = 1.4): void {
  // Find min/max luminance for stretch
  let min = 255, max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }

  // Apply contrast stretch with clipping at 1st/99th percentile
  const range = max - min;
  if (range < 20) return; // Already very low range, skip

  const clipMin = min + range * 0.01;
  const clipMax = max - range * 0.01;
  const clipRange = clipMax - clipMin;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c];
      val = ((val - clipMin) / clipRange) * 255;
      // Apply strength multiplier around midpoint
      val = 128 + (val - 128) * strength;
      data[i + c] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }
}

/**
 * Apply unsharp mask for text sharpening.
 */
function sharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number = 0.6): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // Create blurred copy
  const blurred = new Float32Array(data.length);
  const kernel = 3;
  const half = Math.floor(kernel / 2);

  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx];
            count++;
          }
        }
        blurred[(y * width + x) * 4 + c] = sum / count;
      }
    }
  }

  // Unsharp mask: original + amount * (original - blurred)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = data[i + c] - blurred[i + c];
      data[i + c] = Math.max(0, Math.min(255, Math.round(data[i + c] + amount * diff)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Reduce shadows by applying local brightness normalisation.
 */
function reduceShadows(data: Uint8ClampedArray, width: number, height: number): void {
  // Downsample for local average (block size ~32px)
  const blockSize = 32;
  const bw = Math.ceil(width / blockSize);
  const bh = Math.ceil(height / blockSize);
  const localAvg = new Float32Array(bw * bh);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let sum = 0, count = 0;
      const yStart = by * blockSize;
      const xStart = bx * blockSize;
      for (let y = yStart; y < Math.min(yStart + blockSize, height); y++) {
        for (let x = xStart; x < Math.min(xStart + blockSize, width); x++) {
          const idx = (y * width + x) * 4;
          sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          count++;
        }
      }
      localAvg[by * bw + bx] = sum / count;
    }
  }

  // Apply normalisation
  const globalAvg = localAvg.reduce((a, b) => a + b, 0) / localAvg.length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bx = Math.min(Math.floor(x / blockSize), bw - 1);
      const by = Math.min(Math.floor(y / blockSize), bh - 1);
      const local = localAvg[by * bw + bx];
      const correction = local > 0 ? globalAvg / local : 1;
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        data[idx + c] = Math.max(0, Math.min(255, Math.round(data[idx + c] * correction)));
      }
    }
  }
}

/**
 * Convert to high-contrast grayscale optimised for text.
 */
function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = Math.round(gray);
  }
}

/**
 * Main preprocessing pipeline.
 * Returns a processed File + preview, or quality rejection.
 */
export async function preprocessReceiptImage(file: File): Promise<PreprocessResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Scale down very large images to max 2400px on longest side (keeps detail for OCR)
      const maxDim = 2400;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      // Reject very small images (likely cropped/incomplete)
      if (width < 200 || height < 300) {
        resolve({
          file,
          preview: URL.createObjectURL(file),
          quality: {
            ok: false,
            message: "This image is too small — it may be cropped or incomplete. Please retake the receipt photo with the full receipt visible.",
            brightness: 0,
            contrast: 0,
            sharpness: 0,
          },
        });
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      // Draw original
      ctx.drawImage(img, 0, 0, width, height);

      // Step 1: Analyse quality on original
      const originalData = ctx.getImageData(0, 0, width, height);
      const quality = analyseQuality(originalData);

      if (!quality.ok) {
        resolve({
          file,
          preview: URL.createObjectURL(file),
          quality,
        });
        return;
      }

      // Step 2: Shadow reduction
      const imageData = ctx.getImageData(0, 0, width, height);
      reduceShadows(imageData.data, width, height);
      ctx.putImageData(imageData, 0, 0);

      // Step 3: Convert to grayscale
      const grayData = ctx.getImageData(0, 0, width, height);
      toGrayscale(grayData.data);
      ctx.putImageData(grayData, 0, 0);

      // Step 4: Enhance contrast
      const contrastData = ctx.getImageData(0, 0, width, height);
      enhanceContrast(contrastData.data, 1.5);
      ctx.putImageData(contrastData, 0, 0);

      // Step 5: Sharpen text
      sharpen(ctx, width, height, 0.7);

      // Convert processed canvas to file
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ file, preview: URL.createObjectURL(file), quality });
            return;
          }

          const processedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
          });

          const preview = canvas.toDataURL('image/jpeg', 0.85);

          resolve({
            file: processedFile,
            preview,
            quality: { ...quality, ok: true },
          });
        },
        'image/jpeg',
        0.92
      );
    };

    img.onerror = () => {
      resolve({
        file,
        preview: URL.createObjectURL(file),
        quality: {
          ok: false,
          message: "Could not read this image file. Please try a different photo.",
          brightness: 0,
          contrast: 0,
          sharpness: 0,
        },
      });
    };

    img.src = URL.createObjectURL(file);
  });
}
