import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Database,
  LogOut,
  MailCheck,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAppData } from '../hooks/useAuthAndActivity';
import { useLanguage } from '../hooks/useLanguage';
import type { LanguageCode, PlaybackFormat } from '../types';

export const ProfilePage: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const {
    firebaseUser,
    profile,
    authReady,
    isVerifiedUser,
    preferredFormat,
    catalogSource,
    subscription,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    sendVerification,
    refreshVerificationStatus,
    updateProfile,
    deleteAccount,
    seedCatalog,
    activateMockSubscription,
    cancelMockSubscription,
  } = useAppData();

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Profile edit state
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLang, setEditLang] = useState<LanguageCode>(lang);
  const [editFormat, setEditFormat] = useState<PlaybackFormat>(preferredFormat);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  // Seed & Subscription status
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMessage, setSubMessage] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Delete modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName);
      setEditBio(profile.bio ?? '');
      setEditLang(profile.preferredLanguage);
      setEditFormat(profile.preferredFormat === 'video' ? 'video' : 'audio');
    }
  }, [profile]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email.trim() || !password) {
      setAuthError('Please enter both email address and password.');
      return;
    }
    if (authMode === 'signup' && password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, signupName || email.split('@')[0]);
      }
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (msg.includes('operation-not-allowed')) {
        setAuthError(
          'Email/Password sign-in is not yet enabled in Firebase Console. Use Google Sign-In above, or enable Email/Password under Firebase Console → Authentication → Sign-in method.'
        );
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setProfileBusy(true);
    setProfileStatus(null);
    try {
      await updateProfile({
        displayName: editName,
        bio: editBio,
        preferredLanguage: editLang,
        preferredFormat: editFormat,
      });
      setProfileStatus(t('profile.profileSaved'));
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setProfileBusy(false);
    }
  };

  const handleSeedFirestore = async () => {
    setSeedBusy(true);
    setSeedMessage(null);
    try {
      const res = await seedCatalog();
      setSeedMessage(
        `Seeded Firestore: ${res.categoriesWritten} genres, ${res.creatorsWritten} creators, ${res.storiesWritten} stories, ${res.episodesWritten} episodes (${res.skippedExisting} already existed).`
      );
    } catch (err) {
      setSeedMessage(err instanceof Error ? err.message : 'Seeding failed.');
    } finally {
      setSeedBusy(false);
    }
  };

  const handleActivateMockPremium = async () => {
    setSubBusy(true);
    setSubMessage(null);
    try {
      await activateMockSubscription('premium_monthly');
      setSubMessage('Simulated Premium activated. All Premium episodes are now unlocked.');
    } catch (err) {
      setSubMessage(err instanceof Error ? err.message : 'Unable to update subscription.');
    } finally {
      setSubBusy(false);
    }
  };

  const handleCancelMockPremium = async () => {
    setSubBusy(true);
    setSubMessage(null);
    try {
      await cancelMockSubscription();
      setSubMessage('Simulated subscription cancelled. Reverted to Free Listener tier.');
    } catch (err) {
      setSubMessage(err instanceof Error ? err.message : 'Unable to cancel subscription.');
    } finally {
      setSubBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      setConfirmDeleteOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Account deletion failed.';
      if (msg.includes('requires-recent-login')) {
        setDeleteError(
          'For security, please sign out and sign back in right before deleting your account.'
        );
      } else {
        setDeleteError(msg);
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!authReady) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="h-64 rounded-2xl bg-[#141418] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F5F3EE]">
          {t('profile.title')}
        </h1>
        {firebaseUser && (
          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-[40px] px-4 rounded-xl bg-[#141418] border border-white/15 text-xs font-medium text-[#F5F3EE] hover:border-white/30 inline-flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            {t('profile.signOut')}
          </button>
        )}
      </div>

      {/* Signed-Out Auth View */}
      {!firebaseUser ? (
        <section className="rounded-2xl bg-[#141418] border border-white/[0.08] p-6 sm:p-8 space-y-6 max-w-xl">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold text-[#F5F3EE]">
              {t('profile.signInHeading')}
            </h2>
            <p className="text-sm text-[#A39E93]">{t('profile.signInSub')}</p>
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => void handleGoogleSignIn()}
            className="w-full min-h-[46px] px-5 rounded-xl bg-[#E5A93C] text-[#0B0B0E] text-sm font-semibold hover:bg-[#F3C669] disabled:opacity-60 transition-colors"
          >
            {t('profile.continueWithGoogle')}
          </button>

          <div className="flex items-center gap-3 text-xs text-[#78736A]">
            <div className="h-px flex-1 bg-white/10" />
            <span>{t('profile.orEmail')}</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Login / Signup segmented tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0B0B0E] border border-white/10">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                authMode === 'login' ? 'bg-[#1C1C22] text-[#F5F3EE]' : 'text-[#A39E93]'
              }`}
            >
              {t('profile.tabLogin')}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setAuthError(null);
              }}
              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                authMode === 'signup' ? 'bg-[#1C1C22] text-[#F5F3EE]' : 'text-[#A39E93]'
              }`}
            >
              {t('profile.tabSignup')}
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div className="space-y-1.5">
                <label htmlFor="auth-name" className="text-xs font-medium text-[#A39E93] block">
                  {t('profile.displayNameLabel')}
                </label>
                <input
                  id="auth-name"
                  type="text"
                  maxLength={80}
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="text-xs font-medium text-[#A39E93] block">
                {t('profile.emailLabel')}
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="auth-password" className="text-xs font-medium text-[#A39E93] block">
                {t('profile.passwordLabel')}
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
                required
              />
            </div>

            {authError && (
              <p
                role="alert"
                className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/25 rounded-xl px-4 py-3 leading-relaxed"
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full min-h-[44px] rounded-xl bg-[#1C1C22] border border-white/15 text-sm font-semibold text-[#F5F3EE] hover:border-[#E5A93C]/50 disabled:opacity-50 transition-colors"
            >
              {authMode === 'login' ? t('profile.loginBtn') : t('profile.signupBtn')}
            </button>

            <p className="text-[11px] text-[#78736A] leading-relaxed">
              {t('profile.emailAuthConsoleNote')}
            </p>
          </form>
        </section>
      ) : (
        <div className="space-y-8">
          {/* Email verification notice if unverified */}
          {!isVerifiedUser && (
            <div className="rounded-2xl bg-[#1C1C22] border border-[#E5A93C]/40 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <MailCheck className="w-5 h-5 text-[#E5A93C] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[#F5F3EE]">
                    {t('profile.verifyEmailBanner')}
                  </p>
                  {verifyMessage && <p className="text-xs text-[#E5A93C]">{verifyMessage}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-8">
                <button
                  type="button"
                  onClick={async () => {
                    await sendVerification();
                    setVerifyMessage('Verification email sent. Check your inbox.');
                  }}
                  className="min-h-[38px] px-4 rounded-lg bg-[#141418] border border-white/15 text-xs font-medium text-[#F5F3EE]"
                >
                  {t('profile.resendVerify')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await refreshVerificationStatus();
                    setVerifyMessage(
                      ok ? 'Email verified! Cloud sync is now active.' : 'Still not verified yet.'
                    );
                  }}
                  className="min-h-[38px] px-4 rounded-lg bg-[#E5A93C] text-[#0B0B0E] text-xs font-semibold"
                >
                  {t('profile.refreshVerify')}
                </button>
              </div>
            </div>
          )}

          {/* Account Summary + Edit Profile */}
          <section className="rounded-2xl bg-[#141418] border border-white/[0.08] p-6 space-y-6">
            <div className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
              <div className="w-14 h-14 rounded-2xl bg-[#E5A93C]/15 border border-[#E5A93C]/40 text-[#F3C669] font-display text-xl font-semibold flex items-center justify-center shrink-0">
                {profile?.avatarInitials ?? 'DT'}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-[#F5F3EE] truncate">
                  {profile?.displayName}
                </h2>
                <p className="text-xs text-[#A39E93] truncate">{profile?.email}</p>
                <p className="text-xs text-[#E5A93C] mt-0.5 capitalize">
                  {t('profile.roleLabel')}: {profile?.role ?? 'user'} ·{' '}
                  {profile?.subscriptionTier === 'premium' ? t('common.premium') : t('common.free')}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="text-sm font-semibold text-[#F5F3EE]">
                {t('profile.editProfileHeading')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="profile-name" className="text-xs text-[#A39E93] block">
                    {t('profile.displayNameLabel')}
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    maxLength={80}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="profile-lang" className="text-xs text-[#A39E93] block">
                    {t('profile.languagePrefLabel')}
                  </label>
                  <select
                    id="profile-lang"
                    value={editLang}
                    onChange={(e) => {
                      const next = e.target.value as LanguageCode;
                      setEditLang(next);
                      setLang(next);
                    }}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिंदी (Hindi)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="profile-format" className="text-xs text-[#A39E93] block">
                    {t('profile.preferredFormatLabel')}
                  </label>
                  <select
                    id="profile-format"
                    value={editFormat}
                    onChange={(e) => setEditFormat(e.target.value as PlaybackFormat)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
                  >
                    <option value="audio">{t('player.audioMode')}</option>
                    <option value="video">{t('player.videoMode')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profile-bio" className="text-xs text-[#A39E93] block">
                  {t('profile.bioLabel')}
                </label>
                <textarea
                  id="profile-bio"
                  rows={2}
                  maxLength={300}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell fellow listeners what genres you enjoy..."
                  className="w-full p-3.5 rounded-xl bg-[#0B0B0E] border border-white/10 text-sm text-[#F5F3EE] placeholder:text-[#78736A] focus:outline-none focus:border-[#E5A93C]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={profileBusy || !isVerifiedUser}
                  className="min-h-[42px] px-5 rounded-xl bg-[#E5A93C] text-[#0B0B0E] text-xs font-semibold hover:bg-[#F3C669] disabled:opacity-50 transition-colors"
                >
                  {t('profile.saveProfile')}
                </button>
                {profileStatus && (
                  <span className="text-xs text-[#E5A93C] inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    {profileStatus}
                  </span>
                )}
              </div>
            </form>
          </section>

          {/* Simulated Subscription Plan Section */}
          <section className="rounded-2xl bg-[#141418] border border-white/[0.08] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-semibold text-[#F5F3EE] flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[#E5A93C]" aria-hidden="true" />
                  {t('profile.subscriptionHeading')}
                </h2>
                <p className="text-xs text-[#A39E93] max-w-2xl">
                  {t('profile.subscriptionSimulatedNote')}
                </p>
              </div>
              <span className="text-xs font-medium text-[#E5A93C]">
                {t('common.simulatedBadge')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`rounded-xl p-5 border space-y-2 ${
                  profile?.subscriptionTier !== 'premium'
                    ? 'bg-[#1C1C22] border-[#E5A93C]/45'
                    : 'bg-[#0B0B0E] border-white/10'
                }`}
              >
                <p className="text-sm font-semibold text-[#F5F3EE]">{t('profile.freePlanTitle')}</p>
                <p className="font-display text-2xl font-semibold text-[#F5F3EE]">
                  {t('profile.freePlanPrice')}
                </p>
                <p className="text-xs text-[#A39E93] leading-relaxed">
                  {t('profile.freePlanDesc')}
                </p>
              </div>

              <div
                className={`rounded-xl p-5 border space-y-3 ${
                  profile?.subscriptionTier === 'premium'
                    ? 'bg-[#1C1C22] border-[#E5A93C]/55'
                    : 'bg-[#0B0B0E] border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#F5F3EE]">
                    {t('profile.premiumPlanTitle')}
                  </p>
                  {subscription && (
                    <span className="text-[11px] font-medium text-[#E5A93C]">
                      {subscription.status === 'active'
                        ? t('profile.activeStatus')
                        : t('profile.cancelledStatus')}
                    </span>
                  )}
                </div>
                <p className="font-display text-2xl font-semibold text-[#F3C669]">
                  {t('profile.premiumPlanPrice')}
                </p>
                <p className="text-xs text-[#A39E93] leading-relaxed">
                  {t('profile.premiumPlanDesc')}
                </p>

                {profile?.subscriptionTier === 'premium' ? (
                  <button
                    type="button"
                    disabled={subBusy}
                    onClick={() => void handleCancelMockPremium()}
                    className="w-full min-h-[40px] rounded-xl bg-[#141418] border border-white/15 text-xs font-semibold text-[#F5F3EE] hover:border-rose-400/50 transition-colors"
                  >
                    {t('profile.cancelMock')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={subBusy || !isVerifiedUser}
                    onClick={() => void handleActivateMockPremium()}
                    className="w-full min-h-[40px] rounded-xl bg-[#E5A93C] text-[#0B0B0E] text-xs font-semibold hover:bg-[#F3C669] disabled:opacity-50 transition-colors"
                  >
                    {t('profile.upgradeMock')}
                  </button>
                )}
              </div>
            </div>

            {subMessage && <p className="text-xs text-[#E5A93C]">{subMessage}</p>}
          </section>

          {/* Firestore Database Seeder */}
          <section className="rounded-2xl bg-[#141418] border border-white/[0.08] p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-xl font-semibold text-[#F5F3EE] flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#E5A93C]" aria-hidden="true" />
                  {t('profile.seedHeading')}
                </h2>
                <p className="text-xs text-[#A39E93]">{t('profile.seedSubtitle')}</p>
                <p className="text-xs text-[#78736A]">
                  Current source:{' '}
                  <span className="text-[#F5F3EE]">
                    {catalogSource === 'firestore'
                      ? t('home.catalogSourceFirestore')
                      : 'Local Seed Fallback'}
                  </span>
                </p>
              </div>

              {profile?.role === 'admin' ? (
                <button
                  type="button"
                  disabled={seedBusy}
                  onClick={() => void handleSeedFirestore()}
                  className="min-h-[42px] px-5 rounded-xl bg-[#E5A93C] text-[#0B0B0E] text-xs font-semibold hover:bg-[#F3C669] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {seedBusy ? t('profile.seeding') : t('profile.seedButton')}
                </button>
              ) : (
                <span className="text-xs text-[#8A857B]">{t('profile.seedAdminOnly')}</span>
              )}
            </div>

            {seedMessage && (
              <p className="text-xs text-[#E5A93C] bg-[#0B0B0E] border border-white/10 rounded-xl px-4 py-3">
                {seedMessage}
              </p>
            )}
          </section>

          {/* Danger Zone: Delete Account */}
          <section className="rounded-2xl bg-[#141418] border border-rose-500/20 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                {t('profile.dangerZone')}
              </h2>
              <p className="text-xs text-[#A39E93] max-w-xl">{t('profile.dangerDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="min-h-[40px] px-4 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t('profile.deleteBtn')}
            </button>
          </section>
        </div>
      )}

      {/* Delete Account Confirmation Dialog */}
      {confirmDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('profile.confirmDeleteTitle')}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/10 p-6 space-y-4">
            <h2 className="font-display text-xl font-semibold text-[#F5F3EE]">
              {t('profile.confirmDeleteTitle')}
            </h2>
            <p className="text-sm text-[#A39E93] leading-relaxed">
              {t('profile.confirmDeleteBody')}
            </p>
            {deleteError && <p className="text-xs text-rose-300">{deleteError}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[40px] px-4 rounded-xl bg-[#1C1C22] text-xs font-medium text-[#F5F3EE]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void handleConfirmDelete()}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 disabled:opacity-50"
              >
                {t('profile.confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
