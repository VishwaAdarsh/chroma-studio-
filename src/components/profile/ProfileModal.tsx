import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StorageService } from '../../services/storage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  onClearLocalData: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  onClearLocalData,
}) => {
  const {
    user,
    profile,
    signOut,
    updateProfile,
    uploadAvatar,
    updatePassword,
    isGuest,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'security' | 'preferences' | 'privacy'>('profile');

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Async states
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [storageMB, setStorageMB] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setWebsite(profile.website || '');
    }
    if (isOpen) {
      StorageService.getEstimatedStorageMB().then(setStorageMB);
      setStatusMsg(null);
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMsg(null);
    setAvatarUploading(true);
    const { url, error } = await uploadAvatar(file);
    setAvatarUploading(false);

    if (error) {
      setStatusMsg({ type: 'error', text: error.message || 'Avatar upload failed.' });
    } else {
      setStatusMsg({ type: 'success', text: 'Avatar uploaded and profile updated!' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setLoading(true);

    const { error } = await updateProfile({
      full_name: fullName.trim(),
      username: username.trim().toLowerCase() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
    });
    setLoading(false);

    if (error) {
      setStatusMsg({ type: 'error', text: error.message || 'Failed to update profile.' });
    } else {
      setStatusMsg({ type: 'success', text: 'Profile changes saved successfully.' });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(newPassword);
    setLoading(false);

    if (error) {
      setStatusMsg({ type: 'error', text: error.message || 'Failed to update password.' });
    } else {
      setStatusMsg({ type: 'success', text: 'Password changed successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-on-surface animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="h-16 px-6 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
            </div>
            <div>
              <h2 className="font-bold text-[16px] text-on-surface leading-tight">My Chroma Account</h2>
              <p className="text-[11px] text-on-surface-variant">Profile, Cloud Sync & Preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface border border-outline-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Layout: Sidebar Navigation + Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-outline-variant p-2.5 sm:p-3 flex md:flex-col gap-1 overflow-x-auto shrink-0 bg-surface-container-low/40">
            <button
              onClick={() => {
                setActiveTab('profile');
                setStatusMsg(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">badge</span>
              Profile
            </button>
            <button
              onClick={() => {
                setActiveTab('account');
                setStatusMsg(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all whitespace-nowrap ${
                activeTab === 'account'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              Account Details
            </button>
            <button
              onClick={() => {
                setActiveTab('security');
                setStatusMsg(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">shield</span>
              Security & Auth
            </button>
            <button
              onClick={() => {
                setActiveTab('preferences');
                setStatusMsg(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all whitespace-nowrap ${
                activeTab === 'preferences'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              Preferences
            </button>
            <button
              onClick={() => {
                setActiveTab('privacy');
                setStatusMsg(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all whitespace-nowrap ${
                activeTab === 'privacy'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              Privacy & Data
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-5 md:p-6 overflow-y-auto">
            {/* Guest Banner if not signed in */}
            {!user && (
              <div className="p-4 mb-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <span className="material-symbols-outlined text-[22px]">cloud_off</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[14px] text-on-surface">You are currently in Guest Mode</h4>
                    <p className="text-[12px] text-on-surface-variant">Sign in or create an account to sync your profile and cloud avatars.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold shadow-md hover:opacity-95 shrink-0"
                >
                  Sign In / Register
                </button>
              </div>
            )}

            {/* Notification messages */}
            {statusMsg && (
              <div
                className={`p-3 mb-4 rounded-xl text-[12px] flex items-center gap-2 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-900'
                    : 'bg-error-container/40 border border-error/30 text-on-error-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {statusMsg.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
                {/* Avatar Section */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-0.5 shadow-lg overflow-hidden flex items-center justify-center">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name || 'Avatar'}
                          className="w-full h-full object-cover rounded-[14px]"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-container flex items-center justify-center text-primary font-black text-2xl rounded-[14px]">
                          {fullName ? fullName.charAt(0).toUpperCase() : 'C'}
                        </div>
                      )}
                    </div>
                    {user && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                        title="Upload Avatar"
                      >
                        {avatarUploading ? (
                          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                        )}
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-[16px] text-on-surface">
                      {profile?.full_name || fullName || 'Creator'}
                    </h3>
                    <p className="text-[12px] text-on-surface-variant font-mono">
                      {profile?.username ? `@${profile.username}` : user?.email || 'Guest User'}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 border border-purple-500/20">
                      Chroma Pro Studio
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      disabled={!user}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[13px] text-on-surface-variant">@</span>
                      <input
                        type="text"
                        disabled={!user}
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="username"
                        className="w-full h-10 pl-7 pr-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Bio
                    </label>
                    <textarea
                      disabled={!user}
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell the community about your creative photography and visual styles..."
                      className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface resize-none disabled:opacity-50"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                      Portfolio / Website
                    </label>
                    <input
                      type="url"
                      disabled={!user}
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://myportfolio.art"
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant text-[13px] text-on-surface disabled:opacity-50"
                    />
                  </div>
                </div>

                {user && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-[13px] shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">save</span>
                          Save Profile Changes
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* TAB 2: ACCOUNT */}
            {activeTab === 'account' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                      Account Email
                    </span>
                    <span className="text-[14px] font-medium text-on-surface">
                      {user?.email || 'Unregistered Guest Session'}
                    </span>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Email address is managed securely by Supabase Authentication.
                    </p>
                  </div>

                  <div className="border-t border-outline-variant pt-3">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                      Account UID
                    </span>
                    <span className="text-[12px] font-mono text-on-surface-variant break-all">
                      {user?.id || 'Local Anonymous Client'}
                    </span>
                  </div>

                  <div className="border-t border-outline-variant pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                        Account Status
                      </span>
                      <span className="text-[13px] font-bold text-emerald-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                        Active & Healthy
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-on-surface-variant">
                      Created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Today'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SECURITY */}
            {activeTab === 'security' && (
              <div className="flex flex-col gap-5">
                {user ? (
                  <form onSubmit={handleUpdatePassword} className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-3.5">
                    <h4 className="font-bold text-[14px] text-on-surface">Change Password</h4>
                    <p className="text-[12px] text-on-surface-variant">
                      Enter a new password for your Supabase account.
                    </p>

                    <div>
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 rounded-xl bg-surface-container border border-outline-variant text-[13px]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 rounded-xl bg-surface-container border border-outline-variant text-[13px]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="self-start px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold shadow-md hover:opacity-95"
                    >
                      Update Password
                    </button>
                  </form>
                ) : (
                  <p className="text-[12px] text-on-surface-variant">
                    Password security is available once you sign in to a registered account.
                  </p>
                )}

                {user && (
                  <div className="p-4 rounded-2xl bg-error-container/20 border border-error/20 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[13px] text-on-surface">Sign Out of Chroma Studio</h4>
                      <p className="text-[11px] text-on-surface-variant">Your local projects will remain safe on this device.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="px-4 py-2 rounded-xl bg-error text-white font-bold text-[12px] shadow-sm hover:opacity-95"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PREFERENCES */}
            {activeTab === 'preferences' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-3">
                  <h4 className="font-bold text-[14px] text-on-surface">Export Defaults</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-semibold text-on-surface">Strip EXIF Metadata</span>
                      <p className="text-[11px] text-on-surface-variant">Protect privacy by stripping GPS coordinates on save.</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-0" />
                  </div>
                  <div className="flex items-center justify-between border-t border-outline-variant pt-3">
                    <div>
                      <span className="text-[13px] font-semibold text-on-surface">Haptic Feedback</span>
                      <p className="text-[11px] text-on-surface-variant">Vibrate device on slider detents and crop snaps.</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-0" />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PRIVACY & DATA */}
            {activeTab === 'privacy' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col gap-3">
                  <h4 className="font-bold text-[14px] text-on-surface">Local Device Storage</h4>
                  <p className="text-[12px] text-on-surface-variant">
                    Chroma Studio operates offline-first. Draft photos and studio assets are stored securely in your browser/device IndexedDB.
                  </p>
                  <div className="flex items-center justify-between py-2 border-t border-outline-variant">
                    <span className="text-[12px] font-semibold">Estimated Local Storage Usage:</span>
                    <span className="font-mono text-[13px] font-bold text-primary">{storageMB} MB</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear local draft projects and cache on this device?')) {
                        onClearLocalData();
                        setStorageMB(0);
                        setStatusMsg({ type: 'success', text: 'Local draft cache cleared.' });
                      }
                    }}
                    className="self-start px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant text-[11px] font-bold text-on-surface-variant hover:text-on-surface"
                  >
                    Clear Local Draft Cache
                  </button>
                </div>

                {user && (
                  <div className="p-4 rounded-2xl bg-error-container/20 border border-error/30 flex flex-col gap-2">
                    <h4 className="font-bold text-[13px] text-error">Account Deletion Request</h4>
                    <p className="text-[11px] text-on-surface-variant">
                      In accordance with privacy regulations, you can request full permanent removal of your Supabase profile and cloud assets.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.alert(
                          'To permanently delete your account, please contact privacy@chromastudio.app or submit via our helpdesk. Your request will be fulfilled within 48 hours.'
                        );
                      }}
                      className="self-start px-3 py-1.5 rounded-lg bg-error text-white font-bold text-[11px]"
                    >
                      Submit Deletion Request
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
