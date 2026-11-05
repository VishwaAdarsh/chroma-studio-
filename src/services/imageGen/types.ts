// Chroma Studio — AI Image Generation Types & Interfaces

export type ImageGenStyle =
  | 'photorealistic'
  | 'cinematic'
  | 'illustration'
  | '3d-render'
  | 'vintage-film'
  | 'cyberpunk';

export type ImageGenAspectRatio = '1:1' | '4:5' | '16:9' | '9:16';

export interface ImageGenOptions {
  prompt: string;
  negativePrompt?: string;
  style?: ImageGenStyle;
  aspectRatio?: ImageGenAspectRatio;
  variantsCount?: number;
  userConsent?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, status: string) => void;
}

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  negativePrompt?: string;
  style: ImageGenStyle;
  aspectRatio: ImageGenAspectRatio;
  width: number;
  height: number;
  provider: 'cloud-dalle3' | 'cloud-flux' | 'cloud-imagen' | 'local-synth';
  createdAt: number;
  explanation?: string;
}

export interface ImageGenResult {
  images: GeneratedImage[];
  durationMs: number;
  prompt: string;
  provider: string;
}

export interface ImageGeneratorEngine {
  generate(options: ImageGenOptions): Promise<ImageGenResult>;
}
