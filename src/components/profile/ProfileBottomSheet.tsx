import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface ProfileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullProfile: () => void;
  onOpenPreferences: () => void;
  onOpenAuth: () => void;
}

export const ProfileBottomSheet: React.FC<ProfileBottomSheetProps> = ({
  isOpen,
  onClose,
  onOpenFullProfile,
  onOpenPreferences,
  onOpenAuth,
}) => {
  const { user, profile, signOut, isGuest, openAuthModal } = useAuth();
  const { isPro } = useSubscription();

  if (!isOpen) return null;

  const displayName = user
    ? (profile?.full_name || user.email?.split('@')[0] || 'Chroma Creator')
    : 'Guest Explorer';
  const displayEmail = user ? (user.email || 'Registered Creator') : 'Browse & Preview Mode';
  const avatarUrl = user
    ? (profile?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80')
    : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';

  const handleSignOutClick = async () => {
    await signOut();
    onClose();
  };

  const handleGuardedProfileClick = () => {
    onClose();
    if (user) {
      onOpenFullProfile();
    } else {
      openAuthModal('signin', 'Sign in to access your account profile');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:justify-end sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet / Dropdown Container matching reference screenshot */}
      <div className="relative z-10 w-full sm:w-80 sm:mt-12 bg-[#0D1424] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl shadow-black/60 flex flex-col gap-4 text-white animate-in slide-in-from-bottom-6 sm:slide-in-from-top-4 duration-200">
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden mb-1" />

        {/* User Profile Summary Header */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-white/10">
          {/* Avatar with Status Dot */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] p-0.5">
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            {/* Status Dot */}
            <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0D1424] ${user ? 'bg-emerald-500' : 'bg-purple-500'}`} />
          </div>

          {/* User Info & View Profile CTA */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h3 className="font-bold text-[15px] text-white truncate">{displayName}</h3>
            </div>
            <p className="text-[11px] text-[#94A3B8] truncate">{displayEmail}</p>

            <div className="flex items-center justify-between mt-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                user
                  ? isPro
                    ? 'bg-gradient-to-r from-[#F59E0B]/20 to-[#EC4899]/20 border-[#F59E0B]/40 text-[#F59E0B]'
                    : 'bg-white/5 border border-white/10 text-[#CBD5E1]'
                  : 'bg-white/5 border border-white/10 text-[#94A3B8]'
              }`}>
                {user ? (isPro ? '★ Pro Member' : 'Free Plan') : 'Public Visitor'}
              </span>
              <button
                onClick={handleGuardedProfileClick}
                className="text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg border border-white/10 transition-colors cursor-pointer"
              >
                {user ? 'View Profile' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Items List */}
        <div className="flex flex-col gap-1">
          <button
            onClick={handleGuardedProfileClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px] text-[#94A3B8]">person</span>
            <span>My Account</span>
          </button>

          <button
            onClick={handleGuardedProfileClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px] text-[#94A3B8]">credit_card</span>
            <span>Subscription</span>
          </button>

          <button
            onClick={handleGuardedProfileClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px] text-[#94A3B8]">cloud_sync</span>
            <span>Cloud Sync</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenPreferences();
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px] text-[#94A3B8]">tune</span>
            <span>Preferences</span>
          </button>

          <button
            onClick={() => {
              window.open('https://github.com', '_blank');
              onClose();
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[19px] text-[#94A3B8]">help</span>
            <span>Help & Support</span>
          </button>

          <div className="my-1 border-t border-white/10" />

          {/* Sign Out or Sign In */}
          {user ? (
            <button
              onClick={handleSignOutClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#EF4444] hover:bg-red-500/10 transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px] text-[#EF4444]">logout</span>
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#8B5CF6] hover:bg-purple-500/10 transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px] text-[#8B5CF6]">login</span>
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
