import {
  CanvasBackground,
  CarouselSlide,
  CollageProject,
  DesignElement,
  DesignProject,
  ImageDesignElement,
  ShapeDesignElement,
  TextDesignElement,
} from '../types/design';

// In-memory image cache for fast rendering
const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    const cached = imageCache.get(src)!;
    if (cached.complete && cached.naturalWidth > 0) {
      return Promise.resolve(cached);
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Draws rounded rectangle path on 2D context
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, Math.min(w / 2, h / 2)));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Parses and fills a background
 */
async function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bg: CanvasBackground
) {
  if (bg.type === 'color') {
    ctx.fillStyle = bg.value || '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } else if (bg.type === 'gradient') {
    const val = bg.value;
    // Default gradient parsing or custom angle
    let grad: CanvasGradient;
    if (val.includes('radial')) {
      grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.5
      );
    } else {
      // Linear gradient
      grad = ctx.createLinearGradient(0, 0, width, height);
    }

    // Extract hex/rgba colors from gradient string
    const colorMatches = val.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
    if (colorMatches && colorMatches.length >= 2) {
      const step = 1 / (colorMatches.length - 1);
      colorMatches.forEach((c, idx) => {
        try {
          grad.addColorStop(idx * step, c);
        } catch {
          // fallback
        }
      });
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = val.startsWith('#') ? val : '#1e1b18';
    }
    ctx.fillRect(0, 0, width, height);
  } else if (bg.type === 'image' && bg.value) {
    try {
      const img = await loadImage(bg.value);
      ctx.drawImage(img, 0, 0, width, height);
    } catch {
      ctx.fillStyle = '#222222';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Draws shape element
 */
function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeDesignElement) {
  ctx.save();
  ctx.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
  if (shape.rotation) {
    ctx.rotate((shape.rotation * Math.PI) / 180);
  }
  ctx.translate(-(shape.width / 2), -(shape.height / 2));
  ctx.globalAlpha = shape.opacity ?? 1;

  ctx.fillStyle = shape.fillColor || '#ffffff';
  if (shape.strokeColor && shape.strokeWidth) {
    ctx.strokeStyle = shape.strokeColor;
    ctx.lineWidth = shape.strokeWidth;
  }

  const w = shape.width;
  const h = shape.height;

  switch (shape.shapeType) {
    case 'circle': {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (shape.strokeColor && shape.strokeWidth) ctx.stroke();
      break;
    }
    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      if (shape.strokeColor && shape.strokeWidth) ctx.stroke();
      break;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.strokeStyle = shape.fillColor || shape.strokeColor || '#ffffff';
      ctx.lineWidth = shape.strokeWidth || 2;
      ctx.stroke();
      break;
    }
    case 'pill': {
      const radius = Math.min(w, h) / 2;
      roundRect(ctx, 0, 0, w, h, radius);
      ctx.fill();
      if (shape.strokeColor && shape.strokeWidth) ctx.stroke();
      break;
    }
    case 'rect':
    default: {
      if (shape.borderRadius) {
        roundRect(ctx, 0, 0, w, h, shape.borderRadius);
        ctx.fill();
        if (shape.strokeColor && shape.strokeWidth) ctx.stroke();
      } else {
        ctx.fillRect(0, 0, w, h);
        if (shape.strokeColor && shape.strokeWidth) ctx.strokeRect(0, 0, w, h);
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * Draws image element with cover cropping, zoom, and border radius
 */
async function drawImageElement(ctx: CanvasRenderingContext2D, el: ImageDesignElement) {
  ctx.save();
  ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
  if (el.rotation) {
    ctx.rotate((el.rotation * Math.PI) / 180);
  }
  ctx.translate(-(el.width / 2), -(el.height / 2));
  ctx.globalAlpha = el.opacity ?? 1;

  const w = el.width;
  const h = el.height;

  // Clip rounded corners if specified
  if (el.borderRadius) {
    roundRect(ctx, 0, 0, w, h, el.borderRadius);
    ctx.clip();
  }

  if (el.src) {
    try {
      const img = await loadImage(el.src);
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      // Cover crop math with zoom & offset
      const zoom = Math.max(1, el.zoom || 1);
      const scale = Math.max(w / imgW, h / imgH) * zoom;
      const drawW = imgW * scale;
      const drawH = imgH * scale;

      const drawX = (w - drawW) / 2 + (el.offsetX || 0);
      const drawY = (h - drawH) / 2 + (el.offsetY || 0);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } catch {
      drawPlaceholderSlot(ctx, w, h, el.placeholderLabel || 'Photo');
    }
  } else {
    drawPlaceholderSlot(ctx, w, h, el.placeholderLabel || 'Add Photo');
  }

  // Draw border if requested
  if (el.borderWidth && el.borderColor) {
    ctx.lineWidth = el.borderWidth;
    ctx.strokeStyle = el.borderColor;
    if (el.borderRadius) {
      roundRect(ctx, 0, 0, w, h, el.borderRadius);
      ctx.stroke();
    } else {
      ctx.strokeRect(0, 0, w, h);
    }
  }

  ctx.restore();
}

/**
 * Draws an interactive dashed placeholder box when no photo is loaded
 */
function drawPlaceholderSlot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  label: string
) {
  ctx.fillStyle = '#f3d3cf';
  ctx.fillRect(0, 0, w, h);

  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#bf0411';
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.setLineDash([]);

  // Draw icon and text
  ctx.fillStyle = '#bf0411';
  ctx.font = '600 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2);
}

/**
 * Wraps text into lines that fit inside maxWidth
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draws text element with wrapping, alignment, and styling
 */
function drawTextElement(ctx: CanvasRenderingContext2D, el: TextDesignElement) {
  ctx.save();
  ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
  if (el.rotation) {
    ctx.rotate((el.rotation * Math.PI) / 180);
  }
  ctx.translate(-(el.width / 2), -(el.height / 2));
  ctx.globalAlpha = el.opacity ?? 1;

  const fontStyle = el.fontStyle === 'italic' ? 'italic' : 'normal';
  const fontWeight = el.fontWeight || 'normal';
  const fontSize = el.fontSize || 16;
  const fontFamily = el.fontFamily || 'Inter, sans-serif';

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = el.color || '#281715';
  ctx.textBaseline = 'top';

  const lineHeight = el.lineHeight ? el.lineHeight * fontSize : fontSize * 1.25;
  const lines = wrapText(ctx, el.text, el.width);

  // Background highlight box if any
  if (el.backgroundColor) {
    ctx.fillStyle = el.backgroundColor;
    const pad = el.backgroundPadding || 4;
    const bgH = lines.length * lineHeight + pad * 2;
    if (el.backgroundRadius) {
      roundRect(ctx, -pad, -pad, el.width + pad * 2, bgH, el.backgroundRadius);
      ctx.fill();
    } else {
      ctx.fillRect(-pad, -pad, el.width + pad * 2, bgH);
    }
    ctx.fillStyle = el.color || '#ffffff';
  }

  let textX = 0;
  if (el.textAlign === 'center') {
    textX = el.width / 2;
    ctx.textAlign = 'center';
  } else if (el.textAlign === 'right') {
    textX = el.width;
    ctx.textAlign = 'right';
  } else {
    ctx.textAlign = 'left';
  }

  lines.forEach((line, index) => {
    let output = line;
    if (el.textTransform === 'uppercase') output = output.toUpperCase();
    if (el.textTransform === 'lowercase') output = output.toLowerCase();
    ctx.fillText(output, textX, index * lineHeight);
  });

  ctx.restore();
}

/**
 * Renders all elements of a DesignProject onto canvas
 */
export async function renderDesignProject(
  project: DesignProject,
  targetCanvas?: HTMLCanvasElement,
  scale: number = 1
): Promise<HTMLCanvasElement> {
  const canvas = targetCanvas || document.createElement('canvas');
  const w = Math.round(project.width * scale);
  const h = Math.round(project.height * scale);

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.save();
  ctx.scale(scale, scale);

  // 1. Draw Background
  await drawBackground(ctx, project.width, project.height, project.background);

  // 2. Sort elements by zIndex
  const sortedElements = [...project.elements]
    .filter((e) => e.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // 3. Draw each element
  for (const el of sortedElements) {
    if (el.type === 'shape') {
      drawShape(ctx, el as ShapeDesignElement);
    } else if (el.type === 'image') {
      await drawImageElement(ctx, el as ImageDesignElement);
    } else if (el.type === 'text') {
      drawTextElement(ctx, el as TextDesignElement);
    }
  }

  ctx.restore();
  return canvas;
}

/**
 * Renders a Collage Project onto canvas
 */
export async function renderCollageProject(
  project: CollageProject,
  targetCanvas?: HTMLCanvasElement,
  scale: number = 1
): Promise<HTMLCanvasElement> {
  const canvas = targetCanvas || document.createElement('canvas');
  const w = Math.round(project.width * scale);
  const h = Math.round(project.height * scale);

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.save();
  ctx.scale(scale, scale);

  // 1. Background
  await drawBackground(ctx, project.width, project.height, project.background);

  // 2. Slots
  const innerW = project.width - project.padding * 2;
  const innerH = project.height - project.padding * 2;

  for (const slot of project.slots) {
    const slotX = project.padding + slot.x * innerW + (project.spacing / 2);
    const slotY = project.padding + slot.y * innerH + (project.spacing / 2);
    const slotW = slot.width * innerW - project.spacing;
    const slotH = slot.height * innerH - project.spacing;

    ctx.save();
    roundRect(ctx, slotX, slotY, slotW, slotH, project.cornerRadius);
    ctx.clip();

    if (slot.imageSrc) {
      try {
        const img = await loadImage(slot.imageSrc);
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;

        const zoom = Math.max(1, slot.zoom || 1);
        const imgScale = Math.max(slotW / imgW, slotH / imgH) * zoom;
        const drawW = imgW * imgScale;
        const drawH = imgH * imgScale;

        const drawX = slotX + (slotW - drawW) / 2 + (slot.offsetX || 0);
        const drawY = slotY + (slotH - drawH) / 2 + (slot.offsetY || 0);

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } catch {
        drawPlaceholderSlot(ctx, slotW, slotH, 'Photo');
      }
    } else {
      ctx.fillStyle = '#fcdbd7';
      ctx.fillRect(slotX, slotY, slotW, slotH);
      drawPlaceholderSlot(ctx, slotW, slotH, '+ Photo');
    }

    ctx.restore();

    // Slot border
    if (project.borderWidth > 0 && project.borderColor) {
      ctx.save();
      ctx.lineWidth = project.borderWidth;
      ctx.strokeStyle = project.borderColor;
      roundRect(ctx, slotX, slotY, slotW, slotH, project.cornerRadius);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Freeform elements if enabled
  if (project.isFreeform && project.freeformElements) {
    const sorted = [...project.freeformElements].sort((a, b) => a.zIndex - b.zIndex);
    for (const el of sorted) {
      if (el.type === 'shape') drawShape(ctx, el as ShapeDesignElement);
      else if (el.type === 'image') await drawImageElement(ctx, el as ImageDesignElement);
      else if (el.type === 'text') drawTextElement(ctx, el as TextDesignElement);
    }
  }

  ctx.restore();
  return canvas;
}

/**
 * Renders a single Carousel slide
 */
export async function renderCarouselSlide(
  slide: CarouselSlide,
  width: number,
  height: number,
  targetCanvas?: HTMLCanvasElement,
  scale: number = 1
): Promise<HTMLCanvasElement> {
  const pseudoProject: DesignProject = {
    id: slide.id,
    name: slide.title,
    type: 'template',
    width,
    height,
    background: slide.background,
    elements: slide.elements,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return renderDesignProject(pseudoProject, targetCanvas, scale);
}

/**
 * Encodes canvas to Blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate image blob'));
      },
      mime,
      quality
    );
  });
}
