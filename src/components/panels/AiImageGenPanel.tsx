import React, { useState, useRef } from 'react';
import type { GeneratedImage, ImageGenAspectRatio, ImageGenStyle } from '../../services/imageGen';
import { imageGenService } from '../../services/imageGen';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { ExportService } from '../../services/exportService';

interface AiImageGenPanelProps {
  onOpenInEditor?: (imageUrl: string, title?: string) => void;
  onUseAsBackdrop?: (imageUrl: string) => void;
  onClose?: () => void;
  defaultPrompt?: string;
}

const STYLE_PRESETS: Array<{ id: ImageGenStyle; label: string; icon: string; gradient: string }> = [
  { id: 'photorealistic', label: 'Photo', icon: 'photo_camera', gradient: 'from-blue-600 to-indigo-600' },
  { id: 'cinematic', label: 'Cinematic', icon: 'movie', gradient: 'from-amber-600 to-rose-600' },
  { id: 'illustration', label: 'Illustration', icon: 'palette', gradient: 'from-purple-600 to-pink-600' },
  { id: '3d-render', label: '3D Render', icon: 'view_in_ar', gradient: 'from-cyan-600 to-blue-600' },
  { id: 'vintage-film', label: 'Vintage Film', icon: 'camera_roll', gradient: 'from-yellow-700 to-amber-700' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: 'bolt', gradient: 'from-fuchsia-600 to-cyan-600' },
];

const ASPECT_RATIOS: Array<{ id: ImageGenAspectRatio; label: string; ratio: string; icon: string }> = [
  { id: '1:1', label: 'Square', ratio: '1:1 (1024×1024)', icon: 'crop_square' },
  { id: '4:5', label: 'Portrait', ratio: '4:5 (896×1120)', icon: 'crop_portrait' },
  { id: '16:9', label: 'Landscape', ratio: '16:9 (1280×720)', icon: 'crop_16_9' },
  { id: '9:16', label: 'Story', ratio: '9:16 (720×1280)', icon: 'smartphone' },
];

const PROMPT_SUGGESTIONS = [
  'A neon-lit cyberpunk street market with rain puddle reflections and volumetric fog',
  'Macro shot of a luminous morning dewdrop resting on a vibrant orchid petal',
  'Minimalist ceramic vase on a travertine pedestal with soft dramatic sunlight',
  'Cinematic portrait of an astronaut looking at earth reflected in gold visor',
  'Cozy wooden cabin covered in fresh snow with warm glowing amber windows at twilight',
];

export const AiImageGenPanel: React.FC<AiImageGenPanelProps> = ({
  onOpenInEditor,
  onUseAsBackdrop,
  onClose,
  defaultPrompt = '',
}) => {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<ImageGenStyle>('photorealistic');
  const [selectedAspect, setSelectedAspect] = useState<ImageGenAspectRatio>('1:1');
  const [hasUserConsent, setHasUserConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Generation status state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedImage | null>(null);

  const { checkFeatureAccess, isPro } = useSubscription();
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartGeneration = async () => {
    if (isGenerating) return;
    if (!prompt.trim() || prompt.trim().length < 3) {
      setErrorMessage('Please enter a descriptive prompt with at least 3 characters.');
      return;
    }

    const hasAccess = checkFeatureAccess(
      'ai_image_gen',
      undefined,
      'Upgrade to Chroma Pro to synthesize high-resolution images with AI.'
    );
    if (!hasAccess) return;

    if (!hasUserConsent) {
      setShowConsentModal(true);
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage(null);
      setProgressPercent(10);
      setProgressStatus('Analyzing prompt aesthetics & configuration...');

      abortControllerRef.current = new AbortController();

      const result = await imageGenService.generate({
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        style: selectedStyle,
        aspectRatio: selectedAspect,
        userConsent: true,
        signal: abortControllerRef.current.signal,
        onProgress: (percent, status) => {
          setProgressPercent(percent);
          setProgressStatus(status);
        },
      });

      if (result.images && result.images.length > 0) {
        setGeneratedResult(result.images[0]);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err.message || 'Image generation failed. Please try again.');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleConsentAccept = () => {
    setHasUserConsent(true);
    setShowConsentModal(false);
    setTimeout(() => {
      handleStartGeneration();
    }, 50);
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setProgressStatus('Generation cancelled');
  };

  const handleDownload = async () => {
    if (!generatedResult) return;
    try {
      const res = await fetch(generatedResult.imageUrl);
      const blob = await res.blob();
      const fileName = `chroma_ai_${Date.now()}.png`;
      await ExportService.saveExportedFile(blob, fileName, 'image/png', {
        dialogTitle: 'Save or Share AI Generated Image',
        shareText: 'Generated with Chroma Studio AI',
      });
    } catch (e) {
      console.error('Download error', e);
    }
  };

  return (
    <div className="w-full bg-[#0D1424] border border-white/10 rounded-2xl p-3.5 sm:p-4 space-y-4 shadow-xl select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6]/30 to-[#EC4899]/30 text-[#A78BFA] flex items-center justify-center border border-[#8B5CF6]/30 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">brush</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-white tracking-wide">
                AI Image Generation
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#8B5CF6]/30 to-[#EC4899]/30 text-[#C4B5FD] font-mono font-bold border border-[#8B5CF6]/30">
                TEXT TO IMAGE
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">
              Create original high-definition images from text descriptions
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer min-h-[36px]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Main Prompt Input Area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#CBD5E1] font-semibold">Image Description</span>
          <span className="text-[10px] text-[#64748B] font-mono">{prompt.length}/1000</span>
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create in detail..."
            rows={3}
            maxLength={1000}
            className="w-full bg-[#070B14] border border-white/10 rounded-xl p-3 text-[12px] text-white placeholder-white/30 focus:outline-hidden focus:border-[#8B5CF6] transition-all resize-none shadow-inner"
          />
          {prompt && (
            <button
              onClick={() => setPrompt('')}
              className="absolute top-2 right-2 text-white/40 hover:text-white p-1 rounded-md min-h-[30px]"
              title="Clear prompt"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Prompt Ideas */}
      <div className="space-y-1">
        <span className="text-[9px] uppercase tracking-wider font-mono text-[#64748B] block">
          Inspiration Ideas
        </span>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {PROMPT_SUGGESTIONS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(item)}
              className="text-[9px] px-2.5 py-1 bg-white/5 hover:bg-[#8B5CF6]/15 hover:text-[#C4B5FD] text-[#94A3B8] rounded-full border border-white/5 whitespace-nowrap shrink-0 transition-all cursor-pointer min-h-[32px] flex items-center active:scale-95"
            >
              {item.slice(0, 28)}...
            </button>
          ))}
        </div>
      </div>

      {/* Style Preset Selector */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-[#CBD5E1]">Aesthetic Style</span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {STYLE_PRESETS.map((style) => {
            const isSelected = selectedStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all min-h-[52px] cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white shadow-sm'
                    : 'bg-[#070B14] border-white/5 text-[#94A3B8] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] mb-0.5">{style.icon}</span>
                <span className="text-[10px] font-medium tracking-tight text-center truncate w-full">
                  {style.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Aspect Ratio Selector */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-[#CBD5E1]">Aspect Ratio</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {ASPECT_RATIOS.map((aspect) => {
            const isSelected = selectedAspect === aspect.id;
            return (
              <button
                key={aspect.id}
                onClick={() => setSelectedAspect(aspect.id)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all min-h-[44px] cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-white shadow-sm'
                    : 'bg-[#070B14] border-white/5 text-[#94A3B8] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[17px] text-[#A78BFA]">
                  {aspect.icon}
                </span>
                <div className="text-left truncate">
                  <span className="text-[11px] font-medium block leading-tight">{aspect.label}</span>
                  <span className="text-[8px] text-[#64748B] font-mono leading-none">{aspect.ratio.split(' ')[0]}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Drawer Toggle (Negative Prompt) */}
      <div className="space-y-2 pt-1 border-t border-white/5">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-[#94A3B8] hover:text-white flex items-center gap-1 cursor-pointer min-h-[32px]"
        >
          <span className="material-symbols-outlined text-[14px]">
            {showAdvanced ? 'expand_less' : 'tune'}
          </span>
          <span>{showAdvanced ? 'Hide Advanced Options' : 'Negative Prompt & Controls'}</span>
        </button>

        {showAdvanced && (
          <div className="p-2.5 bg-[#070B14] rounded-xl border border-white/5 space-y-1.5">
            <span className="text-[10px] text-[#94A3B8] block">Negative Prompt (Elements to avoid)</span>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="e.g. blurry, low quality, artifacts, extra fingers, text"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/30 focus:outline-hidden focus:border-[#8B5CF6]"
            />
          </div>
        )}
      </div>

      {/* Progress & Generation State */}
      {isGenerating && (
        <div className="p-3 bg-[#1E1B4B]/40 border border-[#8B5CF6]/30 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#C4B5FD]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span className="font-semibold">{progressStatus}</span>
            </div>
            <span className="font-mono text-white text-[10px]">{progressPercent}%</span>
          </div>

          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#06B6D4] transition-all duration-300"
              style={{ width: `${Math.max(6, progressPercent)}%` }}
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleCancel}
              className="text-[10px] text-red-400 hover:text-red-300 min-h-[34px] px-2.5 cursor-pointer font-medium"
            >
              Cancel Generation
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-[11px] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Generated Result Preview Card */}
      {generatedResult && !isGenerating && (
        <div className="p-3 bg-[#070B14] border border-[#8B5CF6]/40 rounded-xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span>Generated Image Preview</span>
            </span>
            <span className="text-[9px] text-[#94A3B8] font-mono uppercase">
              {generatedResult.width}×{generatedResult.height}
            </span>
          </div>

          {/* Image Display */}
          <div className="relative rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center max-h-[320px]">
            <img
              src={generatedResult.imageUrl}
              alt={generatedResult.prompt}
              className="max-h-[320px] w-auto object-contain rounded-md"
            />
          </div>

          {/* Action Buttons */}
          <div className={`grid ${onUseAsBackdrop ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'} gap-2 pt-1`}>
            {onOpenInEditor && (
              <button
                onClick={() => onOpenInEditor(generatedResult.imageUrl, `AI - ${generatedResult.prompt.slice(0, 24)}`)}
                className="py-2.5 px-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer min-h-[44px]"
                title="Create a new photo project from this generated image"
              >
                <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                <span>Open New Project</span>
              </button>
            )}

            {onUseAsBackdrop && (
              <button
                onClick={() => onUseAsBackdrop(generatedResult.imageUrl)}
                className="py-2.5 px-2.5 bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] hover:opacity-95 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer min-h-[44px]"
                title="Apply as background replacement layer in current photo"
              >
                <span className="material-symbols-outlined text-[16px]">wallpaper</span>
                <span>Set as Backdrop</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              className="py-2.5 px-2.5 bg-white/10 hover:bg-white/15 text-white font-medium text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Save PNG</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Generate Button */}
      <button
        onClick={handleStartGeneration}
        disabled={isGenerating || !prompt.trim()}
        className="w-full py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:opacity-95 text-white font-bold text-[13px] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#8B5CF6]/20 transition-all cursor-pointer min-h-[46px] active:scale-98 disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-[19px]">auto_awesome</span>
        <span>{generatedResult ? 'Generate Another Variant' : 'Generate AI Image'}</span>
        {!isPro && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black tracking-wider uppercase flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[11px]">crown</span>
            <span>PRO</span>
          </span>
        )}
      </button>

      {/* Privacy Notice Pill */}
      <div className="flex items-center gap-1.5 text-[9px] text-[#64748B] pt-0.5">
        <span className="material-symbols-outlined text-[13px] text-[#8B5CF6]">verified_user</span>
        <span>All prompts processed via private authenticated backend. Zero credentials in client.</span>
      </div>

      {/* User Consent Disclosure Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D1424] border border-[#8B5CF6]/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 text-[#A78BFA] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">security</span>
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-white">AI Generation Disclosure</h4>
                <p className="text-[10px] text-[#94A3B8]">Privacy and Terms Confirmation</p>
              </div>
            </div>

            <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
              Generating an image connects to Chroma Studio&apos;s server-side AI model to synthesize
              your scene. Your prompts are processed privately and are never stored or sold to third
              parties.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConsentModal(false)}
                className="px-3.5 py-2 rounded-xl text-[11px] text-[#94A3B8] hover:text-white hover:bg-white/5 min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentAccept}
                className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px] shadow-lg cursor-pointer"
              >
                I Agree &amp; Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
