export type ProjectType = 'photo' | 'template' | 'collage' | 'carousel';

export type ElementType = 'image' | 'text' | 'shape' | 'frame';

export interface BaseDesignElement {
  id: string;
  type: ElementType;
  x: number; // in pixels or percentage (0..canvasWidth)
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  zIndex: number;
  visible: boolean;
  locked?: boolean;
}

export interface ImageDesignElement extends BaseDesignElement {
  type: 'image';
  src: string; // url or data url
  originalWidth?: number;
  originalHeight?: number;
  placeholderId?: string; // If this element is a designated photo replacement slot
  placeholderLabel?: string;
  isPlaceholder?: boolean;
  zoom: number; // 1 = fit, >1 = zoomed
  offsetX: number; // pan x in pixels
  offsetY: number; // pan y in pixels
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  aspectRatio?: number;
  objectFit?: 'cover' | 'contain';
}

export interface TextDesignElement extends BaseDesignElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold' | '600' | '800';
  fontStyle: 'normal' | 'italic';
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  backgroundColor?: string;
  backgroundPadding?: number;
  backgroundRadius?: number;
}

export interface ShapeDesignElement extends BaseDesignElement {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'triangle' | 'line' | 'pill' | 'star' | 'badge';
  fillColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export type DesignElement = ImageDesignElement | TextDesignElement | ShapeDesignElement;

export interface CanvasBackground {
  type: 'color' | 'gradient' | 'image';
  value: string; // hex color or css gradient (e.g. 'linear-gradient(135deg, #281715, #140000)') or image url
}

// ---------------- TEMPLATES STUDIO ---------------- //

export type TemplateStudioCategory =
  | 'All Templates'
  | 'Instagram Posts'
  | 'Instagram Stories'
  | 'Instagram Carousels'
  | 'Travel'
  | 'Photography'
  | 'Portrait'
  | 'Birthday'
  | 'Wedding'
  | 'Events'
  | 'Fashion'
  | 'Lifestyle'
  | 'Food'
  | 'Business'
  | 'Portfolio'
  | 'Minimal'
  | 'Aesthetic'
  | 'Festival and Celebration'
  | 'Promotional Designs'
  | 'Quote and Typography';

export interface ReadyMadeTemplate {
  id: string;
  name: string;
  category: TemplateStudioCategory;
  width: number;
  height: number;
  description: string;
  tags: string[];
  background: CanvasBackground;
  elements: DesignElement[];
  thumbnailGradient?: string;
  isFavorite?: boolean;
}

export interface DesignProject {
  id: string;
  name: string;
  type: 'template';
  templateId?: string;
  width: number;
  height: number;
  background: CanvasBackground;
  elements: DesignElement[];
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}

// ---------------- COLLAGE STUDIO ---------------- //

export interface CollageSlot {
  id: string;
  x: number; // 0..1 (fraction of collage inner area)
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
  imageSrc?: string;
  zoom: number; // default 1
  offsetX: number; // -100..100
  offsetY: number; // -100..100
  rotation: number; // 0, 90, 180, 270 or free
}

export interface CollageLayoutDefinition {
  id: string;
  name: string;
  photoCount: number;
  style: 'grid' | 'split' | 'magazine' | 'polaroid' | 'scrapbook' | 'editorial' | 'filmstrip' | 'pinterest';
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | '3:2';
  slots: Omit<CollageSlot, 'imageSrc' | 'zoom' | 'offsetX' | 'offsetY' | 'rotation'>[];
}

export interface CollageProject {
  id: string;
  name: string;
  type: 'collage';
  width: number;
  height: number;
  aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | '3:2';
  layoutId: string;
  slots: CollageSlot[];
  spacing: number; // 0..40 px
  padding: number; // 0..40 px
  cornerRadius: number; // 0..40 px
  borderWidth: number; // 0..10 px
  borderColor: string;
  background: CanvasBackground;
  isFreeform: boolean;
  freeformElements?: DesignElement[];
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}

// ---------------- CAROUSEL STUDIO ---------------- //

export type CarouselFormat = '4:5' | '1:1' | '9:16' | '16:9';

export interface CarouselSlide {
  id: string;
  title: string;
  slideType: 'cover' | 'photo' | 'text' | 'mixed' | 'closing';
  background: CanvasBackground;
  elements: DesignElement[];
}

export interface CarouselProject {
  id: string;
  name: string;
  type: 'carousel';
  format: CarouselFormat;
  width: number;
  height: number;
  slides: CarouselSlide[];
  activeSlideIndex: number;
  theme: {
    fontFamily: string;
    primaryColor: string;
    accentColor: string;
    bgColor: string;
  };
  isPanoramic?: boolean;
  panoramicSrc?: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}

// Unified project representation
export type StudioProject =
  | { type: 'photo'; [key: string]: any }
  | DesignProject
  | CollageProject
  | CarouselProject;
