import React, { useState, useRef, useEffect } from 'react';
import { useAuth, SUPPORTED_COUNTRIES, normalizePhoneNumber, isValidE164 } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { StorageService } from '../../services/storage';
import { CloudProjectService, StorageQuotaInfo } from '../../services/cloudProjectService';
import { storageMonitorService } from '../../services/storageMonitorService';
import { ExportService } from '../../services/exportService';

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
    linkPhone,
    verifyPhoneUpdate,
    refreshProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'storage' | 'preferences' | 'security' | 'notifications'>('profile');
  const { isPro, plan: subPlan, status: subStatus, currentPeriodEnd, openUpgradeModal, refreshSubscription, loading: subLoading } = useSubscription();

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Phone Linking State
  const [phoneToLink, setPhoneToLink] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(SUPPORTED_COUNTRIES[0]);
  const [phoneOtpStep, setPhoneOtpStep] = useState<'idle' | 'otp_sent'>('idle');
  const [phoneOtpToken, setPhoneOtpToken] = useState('');

  // Async states
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [storageMB, setStorageMB] = useState<number>(0);
  const [quotaInfo, setQuotaInfo] = useState<StorageQuotaInfo | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setWebsite(profile.website || '');
    } else if (user) {
      setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
    } else {
      setFullName('Ananya Sharma');
    }

    if (isOpen) {
      if (user?.id) {
        storageMonitorService.refresh(true).then((q) => {
          setQuotaInfo(q);
          setStorageMB(q.usedMB);
        });
      } else {
        StorageService.getEstimatedStorageMB().then((mb) => {
          if (mb > 0) setStorageMB(mb);
        });
      }
      setStatusMsg(null);
    }
  }, [profile, user, isOpen]);

  if (!isOpen) return null;

  const displayName = profile?.full_name || fullName || 'Ananya Sharma';
  const displayEmail = user?.email || 'ananya@example.com';
  const displayPhone = profile?.phone || user?.phone || null;
  const isPhoneVerified = !!(profile?.phone_verified || (user as any)?.phone_confirmed_at);
  const avatarUrl =
    profile?.avatar_url ||
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '12 March 2024';

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
      setIsEditingProfile(false);
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

  const handleInitiatePhoneLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const formatted = normalizePhoneNumber(phoneToLink, selectedCountry.dialCode);
    if (!isValidE164(formatted)) {
      setStatusMsg({ type: 'error', text: `Please enter a valid phone number (e.g. ${selectedCountry.dialCode} 9876543210).` });
      return;
    }

    setLoading(true);
    const { error } = await linkPhone(formatted);
    setLoading(false);

    if (error) {
      setStatusMsg({ type: 'error', text: error.message || 'Failed to send phone verification OTP.' });
    } else {
      setStatusMsg({ type: 'success', text: `Verification code sent to ${formatted}!` });
      setPhoneOtpStep('otp_sent');
    }
  };

  const handleVerifyPhoneLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const cleanOtp = phoneOtpToken.replace(/\D/g, '');
    if (cleanOtp.length < 6) {
      setStatusMsg({ type: 'error', text: 'Please enter the complete 6-digit OTP code.' });
      return;
    }

    const formatted = normalizePhoneNumber(phoneToLink, selectedCountry.dialCode);
    setLoading(true);
    const { error } = await verifyPhoneUpdate(formatted, cleanOtp);
    setLoading(false);

    if (error) {
      setStatusMsg({ type: 'error', text: error.message || 'Invalid or expired verification code.' });
    } else {
      setStatusMsg({ type: 'success', text: 'Phone number linked and verified successfully!' });
      setPhoneOtpStep('idle');
      setPhoneToLink('');
      setPhoneOtpToken('');
      await refreshProfile();
    }
  };

  const navTabs = [
    { id: 'profile' as const, label: 'Profile', icon: 'person' },
    { id: 'subscription' as const, label: 'Subscription', icon: 'credit_card' },
    { id: 'storage' as const, label: 'Storage', icon: 'cloud' },
    { id: 'preferences' as const, label: 'Preferences', icon: 'tune' },
    { id: 'security' as const, label: 'Security', icon: 'shield' },
    { id: 'notifications' as const, label: 'Notifications', icon: 'notifications' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-[#0D1424] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header matching reference screenshot */}
        <div className="h-16 px-4 sm:px-6 border-b border-white/10 flex items-center justify-between bg-[#070B14]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <h2 className="font-extrabold text-[17px] text-white tracking-tight">My Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white border border-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Left Tabs + Main Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Navigation Sidebar matching screenshot */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-white/10 p-2.5 sm:p-3 flex md:flex-col gap-1.5 overflow-x-auto shrink-0 bg-[#070B14]/60 touch-scroll-x touch-pan-x">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setStatusMsg(null);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl min-h-[40px] text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer touch-manipulation ${
                    isActive
                      ? 'bg-[#1E1B4B] text-[#A855F7] border border-[#8B5CF6]/30 shadow-sm'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Main Content Panel */}
          <div className="flex-1 p-4 sm:p-6 md:p-7 overflow-y-auto flex flex-col gap-5">
            {/* Notification messages */}
            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-[12px] flex items-center gap-2 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border border-red-500/30 text-red-300'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {statusMsg.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* TAB 1: PROFILE TAB matching reference layout */}
            {activeTab === 'profile' && (
              <div className="flex flex-col gap-5">
                {/* 1. Profile Summary Card */}
                <div className="p-4 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] p-0.5">
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-full" />
                      </div>
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#111827]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[16px] text-white">{displayName}</h3>
                      <p className="text-[12px] text-[#94A3B8]">{displayEmail}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[12px] font-bold border border-white/10 transition-colors cursor-pointer"
                  >
                    {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                  </button>
                </div>

                {/* Inline Profile Editing Form */}
                {isEditingProfile && (
                  <form onSubmit={handleSaveProfile} className="p-4 rounded-2xl bg-[#172033] border border-white/10 flex flex-col gap-3">
                    <h4 className="font-bold text-[14px] text-white">Edit Profile Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#94A3B8] font-bold uppercase block mb-1">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full h-9 px-3 rounded-lg bg-[#111827] border border-white/10 text-[13px] text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#94A3B8] font-bold uppercase block mb-1">Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username"
                          className="w-full h-9 px-3 rounded-lg bg-[#111827] border border-white/10 text-[13px] text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-[#94A3B8] font-bold uppercase block mb-1">Bio</label>
                        <textarea
                          rows={2}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Your visual style and bio..."
                          className="w-full p-2.5 rounded-lg bg-[#111827] border border-white/10 text-[13px] text-white resize-none"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="self-end px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-bold text-[12px]"
                    >
                      Save Changes
                    </button>
                  </form>
                )}

                {/* 2-Column Grid: Account Information & Profile Photo Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Account Information Card */}
                  <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex flex-col gap-3.5">
                    <h4 className="font-bold text-[14px] text-white">Account Information</h4>
                    <div className="flex flex-col gap-2.5 text-[12px]">
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span className="text-[#94A3B8]">Full Name</span>
                        <span className="font-semibold text-white">{displayName}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span className="text-[#94A3B8]">Email Address</span>
                        <span className="font-semibold text-white">{displayEmail}</span>
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span className="text-[#94A3B8]">Phone Number</span>
                        {displayPhone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white font-mono">{displayPhone}</span>
                            {isPhoneVerified ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                Verified
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveTab('security')}
                                className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold hover:bg-amber-500/30 cursor-pointer"
                              >
                                Verify Now
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveTab('security')}
                            className="text-[#8B5CF6] hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            Link Phone
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span className="text-[#94A3B8]">Member Since</span>
                        <span className="font-semibold text-white">{memberSince}</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[#94A3B8]">Plan</span>
                        <div className="flex items-center gap-2">
                          {isPro ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#F59E0B] via-[#EC4899] to-[#8B5CF6] text-white text-[10px] font-extrabold shadow-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">crown</span>
                              <span>CHROMA PRO</span>
                            </span>
                          ) : (
                            <>
                              <span className="font-semibold text-white">Free Plan</span>
                              <button
                                onClick={() => openUpgradeModal('Upgrade to Chroma Pro for unlimited creative AI and 4K exports')}
                                className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:brightness-110 text-white text-[10px] font-bold cursor-pointer transition-all"
                              >
                                Upgrade
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Photo Card */}
                  <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex flex-col gap-3.5 justify-between">
                    <div>
                      <h4 className="font-bold text-[14px] text-white">Profile Photo</h4>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">JPG, PNG up to 5MB</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] p-0.5 shrink-0">
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-full" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[12px] border border-white/10 flex items-center gap-1.5 cursor-pointer"
                        >
                          {avatarUploading ? (
                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                          )}
                          <span>Change Photo</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleAvatarFile}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Storage Usage meter inside photo card matching screenshot */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#94A3B8]">Storage Usage</span>
                        <span className="font-mono text-white">
                          {quotaInfo
                            ? `${quotaInfo.formattedUsed} of ${quotaInfo.formattedTotal} used (${quotaInfo.percentage}%)`
                            : 'Loading...'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            quotaInfo?.isExceeded ? 'bg-rose-500' : 'bg-[#8B5CF6]'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, quotaInfo?.percentage || 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions Row matching screenshot */}
                <div className="flex flex-col gap-2">
                  <h4 className="font-bold text-[13px] text-[#94A3B8] uppercase tracking-wider">Quick Actions</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      onClick={() => setActiveTab('subscription')}
                      className="p-3 rounded-xl bg-[#111827] hover:bg-[#172033] border border-white/10 flex items-center justify-center gap-2 text-[12px] font-semibold text-white transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#F59E0B]">crown</span>
                      <span>Manage Subscription</span>
                    </button>
                    <button
                      onClick={() => alert('Cloud Sync is active and healthy.')}
                      className="p-3 rounded-xl bg-[#111827] hover:bg-[#172033] border border-white/10 flex items-center justify-center gap-2 text-[12px] font-semibold text-white transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#22D3EE]">cloud_sync</span>
                      <span>Cloud Sync</span>
                    </button>
                    <button
                      onClick={() => alert('Downloading offline project archive...')}
                      className="p-3 rounded-xl bg-[#111827] hover:bg-[#172033] border border-white/10 flex items-center justify-center gap-2 text-[12px] font-semibold text-white transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#34D399]">download</span>
                      <span>Download My Data</span>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Request permanent deletion of your Chroma account?')) {
                          alert('Account deletion request submitted.');
                        }
                      }}
                      className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center gap-2 text-[12px] font-semibold text-[#EF4444] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                      <span>Delete Account</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SUBSCRIPTION */}
            {activeTab === 'subscription' && (
              <div className="flex flex-col gap-5">
                {/* Current Active Plan Card */}
                <div className="p-6 rounded-3xl bg-[#111827] border border-white/10 relative overflow-hidden flex flex-col gap-5 shadow-xl">
                  <div className="absolute top-0 right-0 w-80 h-32 bg-gradient-to-l from-[#8B5CF6]/20 via-[#EC4899]/10 to-transparent blur-2xl pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F59E0B] via-[#EC4899] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-950/40">
                        <span className="material-symbols-outlined text-[24px] text-white">crown</span>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-[18px] text-white tracking-tight flex items-center gap-2">
                          {isPro ? (subPlan === 'pro_yearly' ? 'Chroma Pro (Yearly)' : 'Chroma Pro (Monthly)') : 'Chroma Free Plan'}
                          {isPro && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-[10px]">
                              ACTIVE
                            </span>
                          )}
                        </h4>
                        <p className="text-[12px] text-[#94A3B8]">
                          {isPro
                            ? 'Full access to Cloud AI Generative Suite, Smart Presets & 4K exports'
                            : 'Basic photo editing, offline filters, and local draft saving'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start sm:items-end">
                      <span className="text-[20px] font-black text-white">
                        {isPro
                          ? (subPlan === 'pro_yearly' ? '₹599 / yr' : '₹99 / mo')
                          : '₹0'}
                      </span>
                      <span className="text-[11px] text-[#94A3B8]">
                        {isPro ? (subPlan === 'pro_yearly' ? 'Billed annually (~₹49.90/mo)' : 'Billed monthly') : 'Free forever'}
                      </span>
                    </div>
                  </div>

                  {/* Subscription Details & Expiry Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-[#94A3B8]">Entitlement Status</span>
                      <span className="text-[13px] font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isPro ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                        {isPro ? 'Pro Subscribed (Active)' : 'Free Tier'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-[#94A3B8]">
                        {isPro ? 'Current Period Ends' : 'Billing Cycle'}
                      </span>
                      <span className="text-[13px] font-bold text-white">
                        {isPro && currentPeriodEnd
                          ? new Date(currentPeriodEnd).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'No active renewal'}
                      </span>
                    </div>
                  </div>

                  {/* Pro Plan Feature Highlights */}
                  <div className="flex flex-col gap-2.5 relative z-10 pt-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">Included in Chroma Pro</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                      {[
                        'Generative AI Photo Editing Assistant',
                        'Cloud AI Deep Multi-zone Enhancement',
                        'Generative AI Object Removal & Inpainting',
                        'Ultra-precise AI Edge Cutout with Alpha',
                        'Synthetic AI Backdrop Replacement',
                        'Text-to-Image Synthesis Studio',
                        '100+ Professional Templates & Fonts',
                        'Uncompressed 4K Ultra Lossless Exports',
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[#CBD5E1]">
                          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="flex items-center gap-3 pt-3 border-t border-white/10 relative z-10">
                    {!isPro ? (
                      <button
                        onClick={() => openUpgradeModal('Upgrade to Chroma Pro to unlock all AI tools and 4K exports')}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] text-white font-bold text-[13px] shadow-lg shadow-purple-950/40 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">crown</span>
                        <span>Upgrade to Pro (from ₹99/mo)</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            await refreshSubscription();
                            setStatusMsg({ type: 'success', text: 'Subscription status refreshed.' });
                          }}
                          disabled={subLoading}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[12px] border border-white/10 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className={`material-symbols-outlined text-[16px] ${subLoading ? 'animate-spin' : ''}`}>sync</span>
                          <span>{subLoading ? 'Refreshing...' : 'Refresh Status'}</span>
                        </button>
                        <span className="text-[11px] text-[#94A3B8]">
                          Secured via Razorpay payments.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STORAGE */}
            {activeTab === 'storage' && (() => {
              const totalLimitMB = isPro ? 10240 : 100;
              const usedMB = quotaInfo ? quotaInfo.usedMB : storageMB;
              const percent = Math.min(100, Math.max(0, Math.round((usedMB / totalLimitMB) * 100)));
              const formattedUsed = usedMB >= 1024 ? `${(usedMB / 1024).toFixed(2)} GB` : `${usedMB.toFixed(1)} MB`;
              const formattedTotal = isPro ? '10 GB' : '100 MB';
              const remainingMB = Math.max(0, totalLimitMB - usedMB);
              const formattedRemaining = remainingMB >= 1024 ? `${(remainingMB / 1024).toFixed(2)} GB` : `${remainingMB.toFixed(1)} MB`;

              return (
                <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[15px] text-white">Cloud Storage Breakdown</h4>
                      <p className="text-[11px] text-[#94A3B8]">
                        {isPro ? 'Pro Workspace: Unlimited Projects & 10 GB' : 'Free Plan: Up to 3 Cloud Projects & 100 MB'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isPro ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-[#CBD5E1]'}`}>
                      {isPro ? 'PRO 10GB' : 'FREE 100MB'}
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] via-[#8B5CF6] to-[#EC4899] transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[12px] text-[#94A3B8]">
                    <span>{formattedUsed} used of {formattedTotal}</span>
                    <span>{formattedRemaining} remaining ({percent}%)</span>
                  </div>

                  {quotaInfo && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-[11px]">
                      <div>
                        <span className="text-[#94A3B8] block text-[10px] uppercase font-mono">Cloud Projects</span>
                        <span className="font-bold text-white text-[13px]">
                          {quotaInfo.projectCount} {isPro ? 'projects' : `of ${quotaInfo.maxProjects} max`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] block text-[10px] uppercase font-mono">Quota Status</span>
                        <span className={`font-bold text-[13px] ${quotaInfo.isExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {quotaInfo.isExceeded ? 'Quota Exceeded' : 'Healthy'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={async () => {
                        try {
                          const projects = await StorageService.getProjects(user ? user.id : null);
                          const backupData = {
                            exportedAt: new Date().toISOString(),
                            userId: user?.id,
                            projectCount: projects.length,
                            projects,
                          };
                          const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                          const fileName = `chroma_studio_backup_${Date.now()}.json`;
                          await ExportService.saveExportedFile(blob, fileName, 'application/json', {
                            dialogTitle: 'Save Chroma Studio Backup',
                            shareText: 'Chroma Studio JSON Backup',
                          });
                          setStatusMsg({ type: 'success', text: 'Backup data downloaded successfully!' });
                        } catch (err: any) {
                          setStatusMsg({ type: 'error', text: err?.message || 'Failed to download backup data.' });
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold border border-white/10 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">file_download</span>
                      <span>Download My Data (JSON Backup)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('Clear local draft projects and cache?')) {
                          onClearLocalData();
                          setStatusMsg({ type: 'success', text: 'Local draft cache cleared.' });
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                      <span>Clear Local Draft Cache</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* TAB 4: PREFERENCES */}
            {activeTab === 'preferences' && (
              <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex flex-col gap-3">
                <h4 className="font-bold text-[15px] text-white">App Preferences</h4>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-[13px] text-white">Dark Creative-Studio Theme</span>
                  <span className="text-[12px] font-bold text-[#8B5CF6]">Active</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-[13px] text-white">Strip EXIF on Export</span>
                  <input type="checkbox" defaultChecked className="rounded text-[#8B5CF6]" />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-white">Haptic Feedback</span>
                  <input type="checkbox" defaultChecked className="rounded text-[#8B5CF6]" />
                </div>
              </div>
            )}

            {/* TAB 5: SECURITY */}
            {activeTab === 'security' && (
              <div className="flex flex-col gap-4">
                {/* Phone Verification Card */}
                <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[15px] text-white">Phone Verification</h4>
                      <p className="text-[12px] text-[#94A3B8]">
                        Secure your account with SMS OTP authentication.
                      </p>
                    </div>
                    {displayPhone && isPhoneVerified && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        Verified
                      </span>
                    )}
                  </div>

                  {phoneOtpStep === 'idle' ? (
                    <form onSubmit={handleInitiatePhoneLink} className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <div className="relative w-36 shrink-0">
                          <select
                            value={selectedCountry.code}
                            onChange={(e) => {
                              const found = SUPPORTED_COUNTRIES.find((c) => c.code === e.target.value);
                              if (found) setSelectedCountry(found);
                            }}
                            className="w-full h-10 px-2.5 rounded-xl bg-[#0D1424] border border-white/10 text-[12px] text-white focus:outline-none focus:border-[#8B5CF6] cursor-pointer appearance-none"
                          >
                            {SUPPORTED_COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code} className="bg-[#111827] text-white">
                                {c.flag} {c.dialCode} ({c.code})
                              </option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-2 top-2.5 text-[18px] text-[#94A3B8] pointer-events-none">
                            expand_more
                          </span>
                        </div>
                        <input
                          type="tel"
                          required
                          value={phoneToLink}
                          onChange={(e) => setPhoneToLink(e.target.value)}
                          placeholder={displayPhone || "98765 43210"}
                          className="flex-1 h-10 px-3 rounded-xl bg-[#0D1424] border border-white/10 text-[13px] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !phoneToLink.trim()}
                        className="self-start px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-[12px] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? 'Sending SMS...' : displayPhone ? 'Update & Send OTP' : 'Send Verification OTP'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyPhoneLink} className="flex flex-col gap-3">
                      <p className="text-[12px] text-[#94A3B8]">
                        Enter the 6-digit code sent to <span className="font-mono text-white">{normalizePhoneNumber(phoneToLink, selectedCountry.dialCode)}</span>
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          maxLength={6}
                          required
                          value={phoneOtpToken}
                          onChange={(e) => setPhoneOtpToken(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className="w-40 h-10 text-center font-mono text-lg tracking-[0.3em] font-bold rounded-xl bg-[#0D1424] border border-white/10 text-white focus:outline-none focus:border-[#8B5CF6]"
                        />
                        <button
                          type="submit"
                          disabled={loading || phoneOtpToken.length < 6}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-bold text-[12px] disabled:opacity-50 cursor-pointer"
                        >
                          Verify & Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhoneOtpStep('idle')}
                          className="text-[12px] text-[#94A3B8] hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Password Update Form */}
                <form onSubmit={handleUpdatePassword} className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex flex-col gap-3">
                  <h4 className="font-bold text-[15px] text-white">Update Password</h4>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="w-full h-10 px-3 rounded-xl bg-[#0D1424] border border-white/10 text-[13px] text-white"
                  />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full h-10 px-3 rounded-xl bg-[#0D1424] border border-white/10 text-[13px] text-white"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="self-start px-4 py-2 rounded-xl bg-[#8B5CF6] text-white font-bold text-[12px] cursor-pointer disabled:opacity-50"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            )}

            {/* TAB 6: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex flex-col gap-3">
                <h4 className="font-bold text-[15px] text-white">Notification Settings</h4>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-[13px] text-white">New Template Announcements</span>
                  <input type="checkbox" defaultChecked className="rounded text-[#8B5CF6]" />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-white">Product Updates & Tips</span>
                  <input type="checkbox" defaultChecked className="rounded text-[#8B5CF6]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
