'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { updateProfile, changePassword, setup2FA, verify2FA, disable2FA } from '@/lib/api';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  // 2FA state
  const [twoFASetup, setTwoFASetup] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [setting2FA, setSetting2FA] = useState(false);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
      });
      await refreshUser();
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwData.newPassword !== pwData.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingPw(true);
    try {
      await changePassword({
        currentPassword: pwData.currentPassword,
        newPassword: pwData.newPassword,
      });
      setPwData({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  }

  async function handleSetup2FA() {
    setSetting2FA(true);
    try {
      const data = await setup2FA();
      setTwoFASetup(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to setup 2FA');
    } finally {
      setSetting2FA(false);
    }
  }

  async function handleVerify2FA() {
    setSetting2FA(true);
    try {
      await verify2FA(twoFACode);
      setTwoFASetup(null);
      setTwoFACode('');
      await refreshUser();
      toast.success('2FA enabled');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally {
      setSetting2FA(false);
    }
  }

  async function handleDisable2FA() {
    setSetting2FA(true);
    try {
      await disable2FA(disableCode);
      setDisableCode('');
      await refreshUser();
      toast.success('2FA disabled');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally {
      setSetting2FA(false);
    }
  }

  if (!user) return null;

  const inputClass = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-500 focus:border-transparent";

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Profile Section */}
      <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
            <input
              type="text"
              required
              minLength={2}
              value={profileData.firstName}
              onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
            <input
              type="text"
              required
              minLength={2}
              value={profileData.lastName}
              onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">{user.email}</p>
        <button
          type="submit"
          disabled={savingProfile}
          className="w-full py-2.5 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 transition-colors disabled:opacity-50"
        >
          {savingProfile ? 'Saving...' : 'Update Profile'}
        </button>
      </form>

      {/* Change Password */}
      <form onSubmit={handlePasswordChange} className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Password</h2>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Password</label>
            <input
              type="password"
              required
              value={pwData.currentPassword}
              onChange={(e) => setPwData({ ...pwData, currentPassword: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={pwData.newPassword}
              onChange={(e) => setPwData({ ...pwData, newPassword: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={pwData.confirm}
              onChange={(e) => setPwData({ ...pwData, confirm: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={savingPw}
          className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {savingPw ? 'Changing...' : 'Change Password'}
        </button>
      </form>

      {/* 2FA Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Two-Factor Authentication</h2>
        {user.twoFactorEnabled ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-pitch-500" />
              <p className="text-sm text-pitch-700 font-medium">2FA is enabled</p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter code to disable"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className={inputClass}
              />
              <button
                onClick={handleDisable2FA}
                disabled={!disableCode || setting2FA}
                className="w-full py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {setting2FA ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          </div>
        ) : twoFASetup ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Scan the QR code with your authenticator app:</p>
            <div className="flex justify-center">
              <img src={twoFASetup.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 rounded-xl" />
            </div>
            <p className="text-xs text-gray-400 text-center break-all font-mono bg-gray-50 p-3 rounded-xl">
              {twoFASetup.secret}
            </p>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setTwoFASetup(null); setTwoFACode(''); }}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify2FA}
                disabled={!twoFACode || setting2FA}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-pitch-600 rounded-xl hover:bg-pitch-700 disabled:opacity-50 transition-colors"
              >
                {setting2FA ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Add an extra layer of security to your account with two-factor authentication.
            </p>
            <button
              onClick={handleSetup2FA}
              disabled={setting2FA}
              className="w-full py-2.5 bg-pitch-600 text-white text-sm font-semibold rounded-xl hover:bg-pitch-700 transition-colors disabled:opacity-50"
            >
              {setting2FA ? 'Setting up...' : 'Set Up 2FA'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
