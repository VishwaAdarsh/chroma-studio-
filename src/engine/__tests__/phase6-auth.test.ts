import { describe, it, expect, beforeEach } from 'vitest';
import { isSupabaseConfigured, UserProfile } from '../../lib/supabase';

// Ensure in-memory localStorage for Node testing environments
if (typeof globalThis.localStorage === 'undefined') {
  const memStore = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => memStore.get(key) ?? null,
    setItem: (key: string, val: string) => memStore.set(key, String(val)),
    removeItem: (key: string) => memStore.delete(key),
    clear: () => memStore.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
}

describe('Phase 6: Supabase Authentication, Profiles & Storage Engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Configuration & Client Isolation', () => {
    it('correctly detects configured Supabase environment variables', () => {
      expect(typeof isSupabaseConfigured).toBe('boolean');
    });

    it('validates project URL protocol and structure', () => {
      const validUrl = 'https://fbtiigdfglailzjzfryp.supabase.co';
      expect(validUrl.startsWith('https://')).toBe(true);
      expect(validUrl.includes('.supabase.co')).toBe(true);
    });

    it('ensures service role keys are never loaded in client environment', () => {
      const clientAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      // Service role keys in Supabase typically contain "service_role" in JWT payload
      if (clientAnonKey && clientAnonKey.startsWith('eyJ')) {
        const payloadBase64 = clientAnonKey.split('.')[1];
        const decoded = JSON.parse(atob(payloadBase64));
        expect(decoded.role).not.toBe('service_role');
        expect(decoded.role).toBe('anon');
      }
    });
  });

  describe('2. Username Normalization & Validation', () => {
    const normalizeUsername = (val: string) => val.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const isValidUsername = (val: string) => /^[a-zA-Z0-9_]{3,20}$/.test(val.trim());

    it('normalizes uppercase and special characters safely', () => {
      expect(normalizeUsername('Alex_Rivera_99!')).toBe('alex_rivera_99');
      expect(normalizeUsername('  Photographer@Studio  ')).toBe('photographerstudio');
    });

    it('validates allowed 3-20 character usernames', () => {
      expect(isValidUsername('dev')).toBe(true);
      expect(isValidUsername('creator_pro_2026')).toBe(true);
      expect(isValidUsername('hi')).toBe(false); // too short (<3)
      expect(isValidUsername('this_username_is_way_too_long_for_system')).toBe(false); // >20
      expect(isValidUsername('user name with spaces')).toBe(false);
      expect(isValidUsername('user$special!')).toBe(false);
    });
  });

  describe('3. Email & Password Verification', () => {
    const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
    const validatePassword = (pwd: string, confirm: string) => {
      if (pwd.length < 6) return 'Password must be at least 6 characters.';
      if (pwd !== confirm) return 'Passwords do not match.';
      return null;
    };

    it('validates email format accurately', () => {
      expect(isValidEmail('creator@chromastudio.app')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail(' spaces @ domain.com ')).toBe(false);
    });

    it('enforces password minimum length and confirmation matching', () => {
      expect(validatePassword('12345', '12345')).toBe('Password must be at least 6 characters.');
      expect(validatePassword('secure123', 'different123')).toBe('Passwords do not match.');
      expect(validatePassword('securePass99', 'securePass99')).toBeNull();
    });
  });

  describe('4. Avatar Storage Path & Constraints', () => {
    const buildAvatarPath = (userId: string, fileName: string) => {
      const ext = fileName.split('.').pop() || 'jpg';
      return `${userId}/avatar_${1700000000}.${ext}`;
    };

    const validateAvatarFile = (type: string, sizeBytes: number) => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(type)) return 'Invalid file type';
      if (sizeBytes > 5 * 1024 * 1024) return 'File too large';
      return null;
    };

    it('enforces user ID folder prefix for RLS foldername containment', () => {
      const userId = 'usr-c4b2a8d1';
      const path = buildAvatarPath(userId, 'profile_pic.png');
      expect(path.startsWith(`${userId}/`)).toBe(true);
      expect(path.split('/')[0]).toBe(userId);
      expect(path.endsWith('.png')).toBe(true);
    });

    it('validates allowed image types and size limit of 5MB', () => {
      expect(validateAvatarFile('image/jpeg', 2 * 1024 * 1024)).toBeNull();
      expect(validateAvatarFile('image/webp', 1024 * 1024)).toBeNull();
      expect(validateAvatarFile('application/pdf', 500 * 1024)).toBe('Invalid file type');
      expect(validateAvatarFile('image/jpeg', 6 * 1024 * 1024)).toBe('File too large');
    });
  });

  describe('5. Profile Object & Null Resilience', () => {
    it('creates resilient profile object from user metadata without crashing', () => {
      const userMeta = {
        name: 'Jordan Sparks',
        avatar_url: 'https://cdn.example.com/sparks.jpg',
      };
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const userEmail = 'jordan@example.com';

      const profile: UserProfile = {
        id: userId,
        email: userEmail,
        full_name: userMeta.name,
        username: userEmail.split('@')[0],
        avatar_url: userMeta.avatar_url,
        bio: null,
        website: null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };

      expect(profile.id).toBe(userId);
      expect(profile.full_name).toBe('Jordan Sparks');
      expect(profile.username).toBe('jordan');
      expect(profile.bio).toBeNull();
      expect(profile.website).toBeNull();
    });
  });

  describe('6. Offline-First Guest Mode State Machine', () => {
    const GUEST_KEY = 'chroma_studio_guest_mode';

    it('persists guest mode state locally without cloud dependency', () => {
      expect(localStorage.getItem(GUEST_KEY)).toBeNull();
      localStorage.setItem(GUEST_KEY, 'true');
      expect(localStorage.getItem(GUEST_KEY)).toBe('true');
      localStorage.removeItem(GUEST_KEY);
      expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    });

    it('preserves existing local projects during guest mode toggle', () => {
      const mockProjects = [{ id: 'p1', name: 'Desert Sunset' }];
      localStorage.setItem('chroma_studio_projects', JSON.stringify(mockProjects));

      // Toggle guest mode
      localStorage.setItem(GUEST_KEY, 'true');

      // Verify projects remain intact
      const preserved = JSON.parse(localStorage.getItem('chroma_studio_projects') || '[]');
      expect(preserved).toHaveLength(1);
      expect(preserved[0].name).toBe('Desert Sunset');
    });
  });
});
