/**
 * Board Puzzle — Image Processing Module
 * Handles center-crop, aspect-ratio preservation, and tile slicing.
 * All operations use the 2D Canvas API — no external dependencies.
 */

const ImageProcessor = (() => {

  /**
   * Load an image from a URL and return an HTMLImageElement.
   * @param {string} src
   * @returns {Promise<HTMLImageElement>}
   */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error(`Cannot load image: ${src}`));
      img.src = src;
    });
  }

  /**
   * Center-crop an image element into a square canvas of `targetSize` pixels.
   * Maintains aspect ratio — no distortion.
   *
   * @param {HTMLImageElement} img
   * @param {number} targetSize  – output canvas width/height in pixels
   * @returns {HTMLCanvasElement}
   */
  function centerCrop(img, targetSize) {
    const canvas = document.createElement('canvas');
    canvas.width  = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    const { naturalWidth: sw, naturalHeight: sh } = img;
    const minSide = Math.min(sw, sh);
    const srcX = (sw - minSide) / 2;
    const srcY = (sh - minSide) / 2;

    // Enable image smoothing for high quality scaling
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'high';

    ctx.drawImage(img, srcX, srcY, minSide, minSide, 0, 0, targetSize, targetSize);
    return canvas;
  }

  /**
   * Slice a square canvas into a grid of (size × size) tile canvases.
   * Returns a 1-D array of canvases in row-major order.
   *
   * @param {HTMLCanvasElement} sourceCanvas – the full cropped image
   * @param {number} size                   – grid dimension (3, 4, or 5)
   * @returns {HTMLCanvasElement[]}
   */
  function sliceIntoTiles(sourceCanvas, size) {
    const totalSize = sourceCanvas.width;
    const tilePixels = Math.floor(totalSize / size);
    const tiles = [];
    const srcCtx = sourceCanvas.getContext('2d');

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const tile = document.createElement('canvas');
        tile.width  = tilePixels;
        tile.height = tilePixels;
        const tCtx = tile.getContext('2d');

        tCtx.imageSmoothingEnabled = true;
        tCtx.imageSmoothingQuality = 'high';

        // Copy the relevant region from the source canvas
        const imageData = srcCtx.getImageData(
          col * tilePixels,
          row * tilePixels,
          tilePixels,
          tilePixels
        );
        tCtx.putImageData(imageData, 0, 0);

        tiles.push(tile);
      }
    }

    return tiles; // tiles[0] = top-left piece, tiles[size²-1] = bottom-right piece
  }

  /**
   * Full pipeline: load a preset URL → crop → slice.
   *
   * @param {string} src    – image URL (preset or blob)
   * @param {number} size   – grid dimension
   * @param {number} resolution – canvas pixels for the full image (default 600)
   * @returns {Promise<{full: HTMLCanvasElement, tiles: HTMLCanvasElement[]}>}
   */
  async function processImage(src, size, resolution = 600) {
    const img     = await loadImage(src);
    const full    = centerCrop(img, resolution);
    const tiles   = sliceIntoTiles(full, size);
    return { full, tiles };
  }

  /**
   * Load from a File object (user upload). Returns a blob URL.
   * @param {File} file
   * @returns {Promise<string>} – object URL, safe to pass to processImage()
   */
  function fileToURL(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Not an image file'));
        return;
      }
      const url = URL.createObjectURL(file);
      resolve(url);
    });
  }

  /**
   * Build CSS background-position to show a specific tile's region of the
   * full image, when using CSS background-size trick.
   *
   * @param {number} tileIndex   – 0-based, row-major
   * @param {number} size        – grid dimension
   * @param {number} tileDisplayPx – rendered tile pixel size in the DOM
   * @returns {{ backgroundSize: string, backgroundPosition: string }}
   */
  function getTileBackgroundCSS(tileIndex, size, tileDisplayPx) {
    const row = Math.floor(tileIndex / size);
    const col = tileIndex % size;
    const fullPx = tileDisplayPx * size;
    const offsetX = -(col * tileDisplayPx);
    const offsetY = -(row * tileDisplayPx);

    return {
      backgroundSize:     `${fullPx}px ${fullPx}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    };
  }

  return {
    loadImage,
    centerCrop,
    sliceIntoTiles,
    processImage,
    fileToURL,
    getTileBackgroundCSS,
  };
})();
