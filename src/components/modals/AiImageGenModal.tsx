import React from 'react';
import { AiImageGenPanel } from '../panels/AiImageGenPanel';

interface AiImageGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInEditor: (imageUrl: string, title?: string) => void;
  onUseAsBackdrop?: (imageUrl: string) => void;
}

export const AiImageGenModal: React.FC<AiImageGenModalProps> = ({
  isOpen,
  onClose,
  onOpenInEditor,
  onUseAsBackdrop,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="max-w-xl w-full my-auto animate-in fade-in zoom-in-95 duration-200">
        <AiImageGenPanel
          onClose={onClose}
          onOpenInEditor={(url, title) => {
            onClose();
            onOpenInEditor(url, title);
          }}
          onUseAsBackdrop={
            onUseAsBackdrop
              ? (url) => {
                  onClose();
                  onUseAsBackdrop(url);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};
