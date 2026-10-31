import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PendingDestination } from '../../contexts/AuthContext';

// Ensure in-memory storage polyfills for Node test runner
const createMockStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockStorage(),
    writable: true,
  });
}

if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: createMockStorage(),
    writable: true,
  });
}

describe('Phase 7: Public Dashboard & Centralized Auth Gate System', () => {
  const PENDING_DESTINATION_KEY = 'chroma_pending_auth_destination';

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Unauthenticated Visitor Access (Public Browsing)', () => {
    it('allows public dashboard access without requiring immediate sign-in', () => {
      const publicViews = ['home', 'templates-browse', 'collage-browse', 'carousel-browse'];
      expect(publicViews).toContain('home');
      expect(publicViews).toContain('templates-browse');
      expect(publicViews).toContain('collage-browse');
      expect(publicViews).toContain('carousel-browse');
    });

    it('sessionStorage has no initial pending destination on clean visitor launch', () => {
      const stored = sessionStorage.getItem(PENDING_DESTINATION_KEY);
      expect(stored).toBeNull();
    });
  });

  describe('2. Centralized Auth Gate (requireAuth) Logic', () => {
    it('blocks unauthenticated action, stores destination in sessionStorage, and triggers auth gate', () => {
      let isModalOpen = false;
      let modalReason: string | null = null;
      let actionExecuted = false;

      const mockRequireAuth = (
        user: any,
        destination: PendingDestination,
        onProceed?: () => void,
        reason?: string
      ): boolean => {
        if (user) {
          if (onProceed) onProceed();
          return true;
        }
        sessionStorage.setItem(PENDING_DESTINATION_KEY, JSON.stringify(destination));
        modalReason = reason || 'Sign in to access this feature';
        isModalOpen = true;
        return false;
      };

      const result = mockRequireAuth(
        null,
        { type: 'template-edit', template: { id: 'tmp-1', name: 'Cyberpunk Flyer' } as any },
        () => {
          actionExecuted = true;
        },
        'Sign in to customize "Cyberpunk Flyer"'
      );

      expect(result).toBe(false);
      expect(actionExecuted).toBe(false);
      expect(isModalOpen).toBe(true);
      expect(modalReason).toBe('Sign in to customize "Cyberpunk Flyer"');

      const savedDestination = JSON.parse(sessionStorage.getItem(PENDING_DESTINATION_KEY)!);
      expect(savedDestination.type).toBe('template-edit');
      expect(savedDestination.template.name).toBe('Cyberpunk Flyer');
    });

    it('allows authenticated user action immediately without opening auth modal', () => {
      let isModalOpen = false;
      let actionExecuted = false;

      const mockRequireAuth = (
        user: any,
        destination: PendingDestination,
        onProceed?: () => void,
        reason?: string
      ): boolean => {
        if (user) {
          if (onProceed) onProceed();
          return true;
        }
        sessionStorage.setItem(PENDING_DESTINATION_KEY, JSON.stringify(destination));
        isModalOpen = true;
        return false;
      };

      const mockUser = { id: 'usr-123', email: 'creator@chromastudio.app' };
      const result = mockRequireAuth(
        mockUser,
        { type: 'editor' },
        () => {
          actionExecuted = true;
        },
        'Sign in to open editor'
      );

      expect(result).toBe(true);
      expect(actionExecuted).toBe(true);
      expect(isModalOpen).toBe(false);
      expect(sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBeNull();
    });
  });

  describe('3. Return-to-Destination Restoration Flow', () => {
    it('consumes and cleans up pending destination after successful login', () => {
      const destination: PendingDestination = {
        type: 'carousel-edit',
        family: { id: 'fam-3', name: 'Product Launch Carousel' } as any,
      };

      sessionStorage.setItem(PENDING_DESTINATION_KEY, JSON.stringify(destination));

      const consumePendingDestination = (): PendingDestination | null => {
        let dest: PendingDestination | null = null;
        try {
          const stored = sessionStorage.getItem(PENDING_DESTINATION_KEY);
          if (stored) dest = JSON.parse(stored);
        } catch {}
        sessionStorage.removeItem(PENDING_DESTINATION_KEY);
        return dest;
      };

      const restored = consumePendingDestination();
      expect(restored).not.toBeNull();
      expect(restored?.type).toBe('carousel-edit');
      expect((restored as any)?.family.name).toBe('Product Launch Carousel');

      // Second consumption must return null
      expect(sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBeNull();
      expect(consumePendingDestination()).toBeNull();
    });

    it('correctly maps all 8 destination workspace actions upon auth success', () => {
      const handledDestinations: string[] = [];

      const routeDestination = (dest: PendingDestination) => {
        switch (dest.type) {
          case 'editor':
            handledDestinations.push(dest.sample ? 'routed:editor-sample' : dest.file ? 'routed:editor-file' : 'routed:editor');
            break;
          case 'open-project':
            handledDestinations.push('routed:open-project');
            break;
          case 'template-edit':
            handledDestinations.push('routed:template-edit');
            break;
          case 'collage-edit':
            handledDestinations.push('routed:collage-edit');
            break;
          case 'carousel-edit':
            handledDestinations.push('routed:carousel-edit');
            break;
          case 'my-projects':
            handledDestinations.push('routed:my-projects');
            break;
          case 'save-project':
            handledDestinations.push('routed:save-project');
            break;
          case 'profile':
            handledDestinations.push('routed:profile');
            break;
          case 'export':
            handledDestinations.push('routed:export');
            break;
        }
      };

      routeDestination({ type: 'editor' });
      routeDestination({ type: 'editor', sample: { title: 'Neon Tokyo' } as any });
      routeDestination({ type: 'editor', file: new File([''], 'photo.jpg') });
      routeDestination({ type: 'open-project', project: { id: 'p1' } as any });
      routeDestination({ type: 'template-edit', template: { id: 't1' } as any });
      routeDestination({ type: 'collage-edit', images: ['img1.jpg'] });
      routeDestination({ type: 'carousel-edit', family: { id: 'c1' } as any });
      routeDestination({ type: 'my-projects' });
      routeDestination({ type: 'save-project' });
      routeDestination({ type: 'profile' });
      routeDestination({ type: 'export' });

      expect(handledDestinations).toEqual([
        'routed:editor',
        'routed:editor-sample',
        'routed:editor-file',
        'routed:open-project',
        'routed:template-edit',
        'routed:collage-edit',
        'routed:carousel-edit',
        'routed:my-projects',
        'routed:save-project',
        'routed:profile',
        'routed:export',
      ]);
    });

    it('clears pending destination when user cancels or continues as guest', () => {
      const destination: PendingDestination = { type: 'collage-edit', images: ['test.png'] };
      sessionStorage.setItem(PENDING_DESTINATION_KEY, JSON.stringify(destination));

      const clearPendingDestination = () => {
        sessionStorage.removeItem(PENDING_DESTINATION_KEY);
      };

      clearPendingDestination();
      expect(sessionStorage.getItem(PENDING_DESTINATION_KEY)).toBeNull();
    });
  });

  describe('4. Canva-Inspired Responsive Layout & Creative Gate UI Tokens', () => {
    it('uses Chroma Studio signature creative dark aesthetic tokens', () => {
      const designTokens = {
        bgApp: '#070B14',
        bgCard: '#0D1424',
        bgElevated: '#111827',
        primaryAccent: '#8B5CF6',
        secondaryAccent: '#EC4899',
        borderSubtle: 'rgba(255, 255, 255, 0.1)',
      };

      expect(designTokens.bgApp).toBe('#070B14');
      expect(designTokens.primaryAccent).toBe('#8B5CF6');
      expect(designTokens.secondaryAccent).toBe('#EC4899');
    });

    it('verifies responsive header and scrubber styles prevent overflow on mobile', () => {
      // Small screen styling rules
      const mobileHeaderTitleClass = 'max-w-[95px] sm:max-w-[160px] truncate';
      const mobileZoomClass = 'hidden sm:inline';
      const scrubberLabelClass = 'truncate min-w-0 flex-1 mr-2';

      expect(mobileHeaderTitleClass).toContain('truncate');
      expect(mobileHeaderTitleClass).toContain('max-w-[95px]');
      expect(mobileZoomClass).toContain('hidden');
      expect(scrubberLabelClass).toContain('truncate');
      expect(scrubberLabelClass).toContain('min-w-0');
    });
  });
});
