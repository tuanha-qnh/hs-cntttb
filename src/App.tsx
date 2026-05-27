/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, FileText, Search, BarChart3, Cloud, LogOut, Key, CheckCircle, 
  HelpCircle, User as UserIcon, Lock, Menu, X, Landmark, RefreshCw, Save 
} from 'lucide-react';

import { Unit, User, SubscriberRecord, CloudflareConfig } from './types';
import SubscriberEntryModule from './components/SubscriberEntryModule';
import SubscriberLookupModule from './components/SubscriberLookupModule';
import DashboardStatsModule from './components/DashboardStatsModule';
import AdminModule from './components/AdminModule';
import InteractiveGuide from './components/InteractiveGuide';

// ----------------------------------------------------------------------
// INITIAL MOCK DATABASES FOR TESTING & PRESENTATION out of the box
// ----------------------------------------------------------------------

const initialUnits: Unit[] = [
  { id: 'UN_ROOT', name: 'VNPT Quảng Ninh', parentId: null },
  { id: 'UN_HL', name: 'Trung tâm KD Hạ Long', parentId: 'UN_ROOT' },
  { id: 'UN_BC', name: 'Phòng BH Bãi Cháy', parentId: 'UN_HL' },
  { id: 'UN_CP', name: 'Trung tâm KD Cẩm Phả', parentId: 'UN_ROOT' },
];

const initialUsers: User[] = [
  { id: 'admin', username: 'admin', fullName: 'Quản trị viên VNPT', role: 'Admin', unitId: 'UN_ROOT', isFirstLogin: false, status: 'active', password: 'admin' },
  { id: 'tuanha', username: 'tuanha', fullName: 'Trần Tuấn Anh', role: 'User', unitId: 'UN_BC', isFirstLogin: true, status: 'active', password: 'Vnpt@2026' },
];

const initialSubscribers: SubscriberRecord[] = [
  {
    id: 'REC_1',
    phoneNumber: '0912112233',
    fullName: 'NGUYỄN VĂN HẢI',
    idNumber: '014201088999',
    createdAt: '2026-05-25T08:30:00Z',
    createdBy: 'tuanha',
    creatorName: 'Trần Tuấn Anh',
    unitId: 'UN_BC',
    unitName: 'Phòng BH Bãi Cháy',
    imageUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'REC_2',
    phoneNumber: '0913987654',
    fullName: 'LÊ THỊ HOÀNG YẾN',
    idNumber: '025302005432',
    createdAt: '2026-05-26T02:15:00Z',
    createdBy: 'admin',
    creatorName: 'Quản trị viên VNPT',
    unitId: 'UN_ROOT',
    unitName: 'VNPT Quảng Ninh',
    imageUrl: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'REC_3',
    phoneNumber: '0888999888',
    fullName: 'PHẠM MINH ĐỨC',
    idNumber: '030096001234',
    createdAt: '2026-05-26T09:40:00Z',
    createdBy: 'tuanha',
    creatorName: 'Trần Tuấn Anh',
    unitId: 'UN_BC',
    unitName: 'Phòng BH Bãi Cháy',
    imageUrl: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?q=80&w=600&auto=format&fit=crop',
  }
];

export default function App() {
  // Loaded reactive databases
  const [units, setUnits] = useState<Unit[]>(() => {
    const saved = localStorage.getItem('vnpt_units');
    return saved ? JSON.parse(saved) : initialUnits;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('vnpt_users');
    return saved ? JSON.parse(saved) : initialUsers;
  });

  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>(() => {
    const saved = localStorage.getItem('vnpt_subscribers');
    return saved ? JSON.parse(saved) : initialSubscribers;
  });

  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig>(() => {
    const saved = localStorage.getItem('vnpt_cloudflare');
    return saved ? JSON.parse(saved) : {
      enabled: false,
      workerUrl: '',
      apiSecret: '',
      status: 'disconnected',
      lastTested: null,
    };
  });

  // Security Auth states
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // User profile password change states for self-service
  const [isSelfPasswordModalOpen, setIsSelfPasswordModalOpen] = useState(false);
  const [selfCurrentPassword, setSelfCurrentPassword] = useState('');
  const [selfNewPassword, setSelfNewPassword] = useState('');
  const [selfConfirmPassword, setSelfConfirmPassword] = useState('');
  const [selfPasswordError, setSelfPasswordError] = useState('');
  const [selfPasswordSuccess, setSelfPasswordSuccess] = useState(false);
  const [passwordChangeRequiredUser, setPasswordChangeRequiredUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('vnpt_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation Panel Views
  const [currentTab, setCurrentTab] = useState<'stats' | 'entry' | 'lookup' | 'guide' | 'admin'>('stats');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Auto Synchronize database edits to localStorage
  useEffect(() => {
    localStorage.setItem('vnpt_units', JSON.stringify(units));
  }, [units]);

  useEffect(() => {
    localStorage.setItem('vnpt_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('vnpt_subscribers', JSON.stringify(subscribers));
  }, [subscribers]);

  useEffect(() => {
    localStorage.setItem('vnpt_cloudflare', JSON.stringify(cloudflareConfig));
  }, [cloudflareConfig]);

  // Load system-wide configurations from full-stack Node server on startup
  useEffect(() => {
    const loadSystemConfig = async () => {
      const hostname = window.location.hostname;
      const hasLocalBackend = 
        hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '0.0.0.0' || 
        hostname.endsWith('.run.app');

      if (!hasLocalBackend) {
        // Pure static client environment (Vercel, GitHub Pages) - skip VPS backend routing
        return;
      }

      try {
        const res = await fetch('/api/system-config');
        if (res.ok) {
          const sysConfig = await res.json();
          if (sysConfig && sysConfig.workerUrl) {
            setCloudflareConfig(sysConfig);
          }
        }
      } catch (err) {
        console.warn('Lỗi load system config từ server VPS:', err);
      }
    };
    loadSystemConfig();
  }, []);

  const handleConfigChange = async (newConfig: CloudflareConfig) => {
    setCloudflareConfig(newConfig);

    const hostname = window.location.hostname;
    const hasLocalBackend = 
      hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      hostname === '0.0.0.0' || 
      hostname.endsWith('.run.app');

    if (!hasLocalBackend) {
      // Avoid making API calls to dynamic ports in pure static environments like Vercel
      return;
    }

    try {
      await fetch('/api/system-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });
    } catch (err) {
      console.error('Không thể lưu cấu hình Cloudflare lên server VPS:', err);
    }
  };

  // Sync session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('vnpt_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('vnpt_current_user');
    }
  }, [currentUser]);

  // Attempt connection sync on load if enabled
  useEffect(() => {
    const syncCloudData = async () => {
      if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
        try {
          let cleanUrl = cloudflareConfig.workerUrl.trim();
          if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
          }
          
          // 1. Đồng bộ danh mục thuê bao (Subscribers)
          const response = await fetch(`${cleanUrl}/api/subscribers`, {
            headers: {
              'x-api-secret': cloudflareConfig.apiSecret,
            }
          });
          if (response.ok) {
            const externalRecords = await response.json();
            if (Array.isArray(externalRecords)) {
              setSubscribers(externalRecords);
            }
          }

          // 2. Đồng bộ danh mục đơn vị (Units)
          const unitsResponse = await fetch(`${cleanUrl}/api/units`, {
            headers: {
              'x-api-secret': cloudflareConfig.apiSecret,
            }
          });
          if (unitsResponse.ok) {
            const externalUnits = await unitsResponse.json();
            if (Array.isArray(externalUnits) && externalUnits.length > 0) {
              setUnits(externalUnits);
            }
          }

          // 3. Đồng bộ danh sách tài khoản (Users)
          const usersResponse = await fetch(`${cleanUrl}/api/users`, {
            headers: {
              'x-api-secret': cloudflareConfig.apiSecret,
            }
          });
          if (usersResponse.ok) {
            const externalUsers = await usersResponse.json();
            if (Array.isArray(externalUsers) && externalUsers.length > 0) {
              // SQLite lưu boolean dạng số 0/1, chuyển đổi ngược về true/false
              const parsedUsers = externalUsers.map((u: any) => ({
                ...u,
                isFirstLogin: u.isFirstLogin === 1 || u.isFirstLogin === true
              }));
              setUsers(parsedUsers);
            }
          }
        } catch (e) {
          console.warn('Lỗi đồng bộ Cloudflare D1 trên cổng xuất: ', e);
        }
      }
    };
    syncCloudData();
  }, [cloudflareConfig]);

  // Handler for single record creation
  const handleRecordCreated = (record: SubscriberRecord) => {
    setSubscribers((prev) => [record, ...prev]);
  };

  // ----------------------------------------------------------------------
  // AUTH PROCEDURES
  // ----------------------------------------------------------------------
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const matchedUser = users.find(
      (u) => u.username.toLowerCase() === usernameInput.trim().toLowerCase()
    );

    if (!matchedUser) {
      setLoginError('Tài khoản người dùng không tồn tại trên hệ thống.');
      return;
    }

    const correctPassword = matchedUser.password || (matchedUser.username === 'admin' ? 'admin' : 'Vnpt@2026');

    // First login check with the default correct password
    if (matchedUser.isFirstLogin && passwordInput === correctPassword) {
      setPasswordChangeRequiredUser(matchedUser);
      return;
    }

    if (passwordInput !== correctPassword) {
      setLoginError('Mật khẩu nhập vào không chính xác.');
      return;
    }

    // Login approval
    setCurrentUser(matchedUser);
    setUsernameInput('');
    setPasswordInput('');
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải bao gồm ít nhất 6 ký tự.');
      return;
    }

    if (newPassword === 'Vnpt@2026') {
      setPasswordError('Mật khẩu mới không được trùng với mật khẩu mặc định.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    // Update user profile password index
    const updatedUsers = users.map((u) =>
      u.id === passwordChangeRequiredUser?.id ? { ...u, isFirstLogin: false, password: newPassword } : u
    );

    setUsers(updatedUsers);

    // Sync to Cloudflare D1
    if (cloudflareConfig.enabled && cloudflareConfig.workerUrl && passwordChangeRequiredUser) {
      try {
        let cleanUrl = cloudflareConfig.workerUrl.trim();
        if (cleanUrl.endsWith('/')) {
          cleanUrl = cleanUrl.slice(0, -1);
        }
        fetch(`${cleanUrl}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': cloudflareConfig.apiSecret,
          },
          body: JSON.stringify({
            action: 'update',
            user: { ...passwordChangeRequiredUser, isFirstLogin: false, password: newPassword }
          })
        }).catch(err => console.error('Lỗi sync user on password change:', err));
      } catch (e) {
        console.warn('Lỗi kết nối đồng bộ:', e);
      }
    }

    setCurrentUser({ ...passwordChangeRequiredUser!, isFirstLogin: false, password: newPassword });
    
    // Clear out
    setPasswordChangeRequiredUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setUsernameInput('');
    setPasswordInput('');
    alert('Mật khẩu mới đã được cập nhật thành công! Trọng lực của tài khoản đã được kích hoạt.');
  };

  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfPasswordError('');
    setSelfPasswordSuccess(false);

    if (!selfCurrentPassword) {
      setSelfPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    const currentCorrectPass = currentUser?.password || (currentUser?.username === 'admin' ? 'admin' : 'Vnpt@2026');
    if (selfCurrentPassword !== currentCorrectPass) {
      setSelfPasswordError('Mật khẩu hiện tại chưa chính xác.');
      return;
    }

    if (selfNewPassword.length < 6) {
      setSelfPasswordError('Mật khẩu mới phải bao gồm ít nhất 6 ký tự.');
      return;
    }

    if (selfNewPassword === 'Vnpt@2026') {
      setSelfPasswordError('Mật khẩu mới không được trùng mật khẩu mặc định.');
      return;
    }

    if (selfNewPassword !== selfConfirmPassword) {
      setSelfPasswordError('Mật khẩu mới xác nhận chưa khớp.');
      return;
    }

    // Update in users array
    const updatedUser = { ...currentUser!, password: selfNewPassword };
    const updatedUsers = users.map((u) => u.id === currentUser?.id ? updatedUser : u);
    setUsers(updatedUsers);
    setCurrentUser(updatedUser);

    // Sync to Cloudflare D1
    if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
      try {
        let cleanUrl = cloudflareConfig.workerUrl.trim();
        if (cleanUrl.endsWith('/')) {
          cleanUrl = cleanUrl.slice(0, -1);
        }
        await fetch(`${cleanUrl}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': cloudflareConfig.apiSecret,
          },
          body: JSON.stringify({
            action: 'update',
            user: updatedUser
          })
        });
      } catch (err) {
        console.error('Lỗi sync user password to cloud:', err);
      }
    }

    setSelfPasswordSuccess(true);
    setSelfCurrentPassword('');
    setSelfNewPassword('');
    setSelfConfirmPassword('');
    setTimeout(() => {
      setIsSelfPasswordModalOpen(false);
      setSelfPasswordSuccess(false);
    }, 1500);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentTab('stats');
  };

  const handleSyncLocalToCloud = async () => {
    if (!cloudflareConfig.enabled || !cloudflareConfig.workerUrl) {
      alert('Chưa kích hoạt hoặc cấu hình Cloudflare. Vui lòng bật Cơ chế Trực tuyến trước!');
      return;
    }

    if (!confirm('Hành động này sẽ tải toàn bộ danh mục Đơn vị, Tài khoản nhân sự và hồ sơ Thuê bao hiện tại của Trình duyệt này lên Cloudflare và đồng bộ hóa. Bạn có chắc chắn muốn tiến hành?')) {
      return;
    }

    try {
      let cleanUrl = cloudflareConfig.workerUrl.trim();
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }

      // 1. Sync units
      let syncUnitsSuccessCount = 0;
      for (const unit of units) {
        try {
          const res = await fetch(`${cleanUrl}/api/units`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-secret': cloudflareConfig.apiSecret,
            },
            body: JSON.stringify({
              action: 'create',
              unit: unit
            })
          });
          if (res.ok) {
            syncUnitsSuccessCount++;
          }
        } catch (unitErr) {
          console.error(`Lỗi sync đơn vị ${unit.name}:`, unitErr);
        }
      }

      // 2. Sync users
      let syncUsersSuccessCount = 0;
      for (const u of users) {
        try {
          const res = await fetch(`${cleanUrl}/api/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-secret': cloudflareConfig.apiSecret,
            },
            body: JSON.stringify({
              action: 'create',
              user: u
            })
          });
          if (res.ok) {
            syncUsersSuccessCount++;
          }
        } catch (userErr) {
          console.error(`Lỗi sync tài khoản ${u.username}:`, userErr);
        }
      }

      // 3. Sync subscribers
      let syncSubsSuccessCount = 0;
      for (const sub of subscribers) {
        try {
          const res = await fetch(`${cleanUrl}/api/subscribers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-secret': cloudflareConfig.apiSecret,
            },
            body: JSON.stringify({
              id: sub.id,
              phoneNumber: sub.phoneNumber,
              fullName: sub.fullName,
              idNumber: sub.idNumber,
              createdAt: sub.createdAt,
              createdBy: sub.createdBy,
              creatorName: sub.creatorName,
              unitId: sub.unitId,
              unitName: sub.unitName,
              imageBase64: sub.imageUrl, // Send existing Base64 or URL
            })
          });
          if (res.ok) {
            syncSubsSuccessCount++;
          }
        } catch (subErr) {
          console.error(`Lỗi sync thuê bao ${sub.phoneNumber}:`, subErr);
        }
      }

      alert(`ĐỒNG BỘ DỮ LIỆU THÀNH CÔNG!
- Đồng bộ đơn vị: ${syncUnitsSuccessCount}/${units.length} phòng ban.
- Đồng bộ tài khoản: ${syncUsersSuccessCount}/${users.length} tài khoản giao dịch viên.
- Đồng bộ thuê bao: ${syncSubsSuccessCount}/${subscribers.length} hồ sơ gốc (ảnh tự động nạp vào R2 Storage).`);

    } catch (err: any) {
      alert('Có lỗi xảy ra trong quá trình đồng bộ: ' + (err.message || err));
    }
  };

  // Translate unit database structure to simple objects map
  const getUnitsNameMap = () => {
    const map: Record<string, string> = {};
    units.forEach((u) => {
      map[u.id] = u.name;
    });
    return map;
  };

  const unitsMap = getUnitsNameMap();
  const currentUnitName = currentUser ? unitsMap[currentUser.unitId] || 'VNPT Quảng Ninh' : 'VNPT Quảng Ninh';

  // ----------------------------------------------------------------------
  // SCENARIO RENDER: LOGIN & RESET SCREENS
  // ----------------------------------------------------------------------

  if (!currentUser) {
    if (passwordChangeRequiredUser) {
      return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden p-6 space-y-6 backdrop-blur-md relative">
            {/* Design accents */}
            <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent"></div>
            <div className="absolute top-0 left-0 w-[1px] h-24 bg-gradient-to-b from-cyan-500 to-transparent"></div>
            
            <div className="text-center space-y-2">
              <div className="bg-[#005BAA]/20 text-cyan-400 p-3 rounded-xl border border-cyan-500/20 inline-flex">
                <Key className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-base font-bold text-white font-sans uppercase tracking-wider">
                Yêu Cầu Thay Đổi Mật Khẩu
              </h2>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Xin chào <strong className="text-cyan-400">{passwordChangeRequiredUser.fullName}</strong>. Vì lý do an toàn bảo mật, bạn bắt buộc phải tạo mật khẩu riêng trong lần đầu đăng nhập.
              </p>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Mật khẩu bảo mật mới *
                </label>
                <input
                  required
                  type="password"
                  placeholder="Nhập tối thiểu 6 ký tự"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                  Xác nhận lại mật khẩu mới *
                </label>
                <input
                  required
                  type="password"
                  placeholder="Điền lại khớp hoàn toàn"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all font-mono"
                />
              </div>

              {passwordError && (
                <p className="text-[11px] text-red-400 font-sans font-medium text-center bg-red-950/30 border border-red-900/40 py-2 rounded-lg">
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#005BAA] hover:bg-blue-600 border border-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
              >
                Cập nhật mật khẩu & Vào hệ thống
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden relative backdrop-blur-sm">
          {/* Tech lines */}
          <div className="absolute top-0 right-0 w-32 h-[1px] bg-gradient-to-l from-[#005BAA] to-transparent"></div>
          <div className="absolute top-0 right-0 w-[1px] h-32 bg-gradient-to-b from-[#005BAA] to-transparent"></div>
          
          {/* Header VNPT Cover */}
          <div className="bg-gradient-to-b from-[#005BAA]/10 to-[#005BAA]/3 border-b border-slate-800 p-6 text-center space-y-2 relative">
            <div className="absolute top-4 right-4 bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800 text-[8px] font-mono tracking-widest uppercase">
              VNPT Portal
            </div>
            <div className="bg-slate-950 p-2.5 rounded-xl inline-flex border border-slate-800 mb-1 shadow-inner">
              <Building2 className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-sm font-extrabold uppercase tracking-widest text-slate-100 font-sans">
              Hệ thống lưu trữ giấy tờ
            </h1>
            <p className="text-[10px] text-slate-400 tracking-wider font-sans leading-relaxed">
              Cập nhật thông tin thuê bao di động VinaPhone
            </p>
          </div>

          {/* Form container */}
          <div className="p-6 space-y-5">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                  Tài khoản Giao dịch viên
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: tuanha / admin"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-[#005BAA] outline-none transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  Mật khẩu hệ thống
                </label>
                <input
                  required
                  type="password"
                  placeholder="Nhập Vnpt@2026 hoặc mật khẩu riêng"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-[#005BAA] outline-none transition-all font-mono"
                />
              </div>

              {loginError && (
                <p className="text-[11px] text-red-400 font-sans font-medium text-center bg-red-950/20 border border-red-900/30 py-2 rounded-lg">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#005BAA] hover:bg-blue-600 border border-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
              >
                Đăng nhập hệ thống
              </button>
            </form>

            <div className="border-t border-slate-800/80 pt-4 text-[10px] text-slate-500 font-sans text-center leading-relaxed">
              Hệ thống nội vụ VNPT dành cho giao dịch viên Quảng Ninh.<br />
              <strong className="text-slate-400">Tài khoản mẫu:</strong> <span className="font-mono text-cyan-400">admin / admin</span> hoặc <span className="font-mono text-cyan-400">tuanha / Vnpt@2026</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // SCENARIO RENDER: MAIN APPLICATION WORKSPACE (Authenticated)
  // ----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-[#005BAA]/10 selection:text-[#005BAA]">
      {/* Navbar Banner top heading */}
      <header className="bg-white border-b border-slate-200/80 shrink-0 sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors lg:hidden cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-[#005BAA] p-2 rounded-xl text-white shadow-sm shadow-[#005BAA]/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs font-extrabold uppercase tracking-widest text-slate-900 font-sans leading-none flex items-center gap-2">
                HỒ SƠ TTTB VINAPHONE
                {cloudflareConfig.enabled && (
                  <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 text-[8px] font-bold rounded-md font-mono uppercase">
                    CLOUD SYNC D1+R2
                  </span>
                )}
              </h1>
              <span className="text-[10px] text-slate-400 font-sans font-medium mt-1 block">
                Tổng Công Ty Dịch Vụ Viễn Thông VNPT - Văn Phòng Quảng Ninh
              </span>
            </div>
          </div>
        </div>

        {/* User Active Information Panel at top right */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block border-r border-slate-200 pr-4">
            <h4 className="text-xs font-bold text-slate-800 font-sans flex items-center gap-1.5 justify-end">
              <UserIcon className="w-3.5 h-3.5 text-[#005BAA]" />
              {currentUser.fullName}
            </h4>
            <span className="text-[10px] text-slate-400 font-sans font-medium mt-0.5 block">
              {currentUnitName} • <span className="font-sans font-bold text-slate-600">{currentUser.role === 'Admin' ? 'Quản trị viên' : 'Giao dịch viên'}</span>
            </span>
          </div>

          <button
            onClick={() => setIsSelfPasswordModalOpen(true)}
            className="px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-all cursor-pointer border border-indigo-100 active:scale-95 flex items-center gap-1.5 text-xs font-bold"
            title="Đổi mật khẩu tài khoản"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Đổi mật khẩu</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100/80 transition-all cursor-pointer border border-red-100 active:scale-95"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main flex layout containing sidebar and modules */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Left Navigation Panel */}
        <aside
          className={`bg-slate-900 border-r border-slate-800 text-white transition-all shrink-0 z-30 flex flex-col duration-200 ${
            sidebarOpen ? 'w-64' : 'w-0 lg:w-20 overflow-hidden'
          }`}
        >
          <div className="flex-1 py-5 flex flex-col justify-between">
            {/* List links */}
            <nav className="space-y-1 px-3">
              <button
                onClick={() => setCurrentTab('stats')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold font-sans transition-all relative cursor-pointer group ${
                  currentTab === 'stats'
                    ? 'bg-[#005BAA] text-white shadow-sm shadow-[#005BAA]/30 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <BarChart3 className={`w-4 h-4 shrink-0 transition-colors ${currentTab === 'stats' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className={`${sidebarOpen ? 'block' : 'hidden md:hidden'}`}>Báo cáo Thống kê (Home)</span>
              </button>

              <button
                onClick={() => setCurrentTab('entry')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold font-sans transition-all relative cursor-pointer group ${
                  currentTab === 'entry'
                    ? 'bg-[#005BAA] text-white shadow-sm shadow-[#005BAA]/30 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <FileText className={`w-4 h-4 shrink-0 transition-colors ${currentTab === 'entry' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className={`${sidebarOpen ? 'block' : 'hidden md:hidden'}`}>Cập nhật TTTB (Nhập liệu)</span>
              </button>

              <button
                onClick={() => setCurrentTab('lookup')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold font-sans transition-all relative cursor-pointer group ${
                  currentTab === 'lookup'
                    ? 'bg-[#005BAA] text-white shadow-sm shadow-[#005BAA]/30 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Search className={`w-4 h-4 shrink-0 transition-colors ${currentTab === 'lookup' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className={`${sidebarOpen ? 'block' : 'hidden md:hidden'}`}>Tra cứu Hồ sơ lưu trữ</span>
              </button>

              <button
                onClick={() => setCurrentTab('guide')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold font-sans transition-all relative cursor-pointer group ${
                  currentTab === 'guide'
                    ? 'bg-[#005BAA] text-white shadow-sm shadow-[#005BAA]/30 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Cloud className={`w-4 h-4 shrink-0 transition-colors ${currentTab === 'guide' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className={`${sidebarOpen ? 'block' : 'hidden md:hidden'}`}>Cẩm tay chỉ việc D1/R2</span>
              </button>

              {/* Guard view for administrator credentials */}
              {currentUser.role === 'Admin' && (
                <div className="pt-5 border-t border-slate-800/80 mt-4 space-y-1">
                  <span className={`text-[9px] uppercase font-bold text-slate-500 px-3.5 block tracking-widest ${
                    sidebarOpen ? 'block' : 'hidden md:hidden'
                  }`}>
                    Hệ Thống Admin
                  </span>
                  
                  <button
                    onClick={() => setCurrentTab('admin')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold font-sans transition-all relative cursor-pointer group ${
                      currentTab === 'admin'
                        ? 'bg-[#005BAA] text-white shadow-sm shadow-[#005BAA]/30 border border-blue-500/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <Users className={`w-4 h-4 shrink-0 transition-colors ${currentTab === 'admin' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    <span className={`${sidebarOpen ? 'block' : 'hidden md:hidden'}`}>Quản trị Hệ thống</span>
                  </button>
                </div>
              )}
            </nav>

            {/* Bottom active state indicator */}
            {sidebarOpen && (
              <div className="px-4 text-[10px] text-slate-500 space-y-1 border-t border-slate-800/80 pt-4 mx-3">
                <p className="font-mono">Date: 2026-05-26</p>
                <p className="font-mono">User: {currentUser.username}</p>
              </div>
            )}
          </div>
        </aside>

        {/* Content Workspace Area scrollable */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
          {/* Main workspace header banner label */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 uppercase font-sans tracking-wide">
                {currentTab === 'stats' && 'BÁO CÁO THỐNG KÊ HOẠT ĐỘNG'}
                {currentTab === 'entry' && 'NHẬP LIỆU CẬP NHẬT THÔNG TIN THUÊ BAO'}
                {currentTab === 'lookup' && 'KHO TRA CỨU HỒ SƠ LƯU TRỮ'}
                {currentTab === 'guide' && 'HƯỚNG DẪN CẤU HÌNH CLOUDFLARE TOÀN DIỆN'}
                {currentTab === 'admin' && 'QUẢN TRỊ HẠ TẦNG & TỔ CHỨC ĐƠN VỊ'}
              </h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                {currentTab === 'stats' && 'Biểu đồ hoạt động và phân rã khối lượng giấy tờ của các điểm bán hàng.'}
                {currentTab === 'entry' && 'Đăng biên nhận, điền thông tin và kéo thả phiếu yêu cầu cập nhật lên CDN.'}
                {currentTab === 'lookup' && 'Tra cứu nhanh số thuê bao chính chủ hoặc giấy tờ CCCD của khách hàng.'}
                {currentTab === 'guide' && 'Quản lý an toàn dữ liệu đầu cuối sử dụng Serverless Cloudflare miễn phí.'}
                {currentTab === 'admin' && 'Khai báo phòng GD con, nạp danh sách CTV bằng Excel, đổi cấu hình mạng.'}
              </p>
            </div>

            {/* Top helper synchronization indicators warnings */}
            {!cloudflareConfig.enabled && (
              <div className="text-right text-xs bg-amber-50 border border-amber-200/70 text-amber-800 rounded-xl px-4 py-2.5 max-w-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-sans leading-tight text-[11px]">
                  Chế độ <b>Mô phỏng Ngoại tuyến (Offline)</b>. Thiết lập hạ tầng Cloudflare D1 & R2 ở mục quản trị để kết nối online.
                </span>
              </div>
            )}
          </div>

          {/* Load corresponding dynamic components */}
          <div className="space-y-6">
            {currentTab === 'stats' && (
              <DashboardStatsModule records={subscribers} units={unitsMap} />
            )}

            {currentTab === 'entry' && (
              <SubscriberEntryModule 
                cloudflareConfig={cloudflareConfig} 
                onRecordCreated={handleRecordCreated}
                currentUser={{
                  id: currentUser.id,
                  fullName: currentUser.fullName,
                  unitId: currentUser.unitId,
                  nameUnit: currentUnitName,
                }}
              />
            )}

            {currentTab === 'lookup' && (
              <SubscriberLookupModule records={subscribers} />
            )}

            {currentTab === 'guide' && (
              <InteractiveGuide />
            )}

            {currentTab === 'admin' && (
              <AdminModule
                units={units}
                users={users}
                currentUser={currentUser}
                cloudflareConfig={cloudflareConfig}
                onUnitsChange={setUnits}
                onUsersChange={setUsers}
                onConfigChange={handleConfigChange}
                onSyncLocalToCloud={handleSyncLocalToCloud}
              />
            )}
          </div>
        </main>
      </div>

      {/* Persistent global footer credits */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-[10px] text-slate-400 font-sans flex flex-col md:flex-row items-center justify-between gap-2 shrink-0">
        <div>
          Bản quyền © 2026 <strong>VNPT Quảng Ninh</strong>. Thiết kế chuẩn Responsive đa phương diện.
        </div>
        <div className="flex items-center gap-4">
          <span>Kênh hỗ trợ nghiệp vụ: Tổng đài 18001091</span>
          <span>Phiên bản: 1.0.8 Cloudflare-Integrated</span>
        </div>
      </footer>

      {/* Self Password Change Modal */}
      {isSelfPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs font-sans px-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl w-full max-w-md animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#005BAA]" />
                <h3 className="font-bold text-slate-800 text-sm">Đổi Mật Khẩu Cá Nhân</h3>
              </div>
              <button 
                onClick={() => {
                  setIsSelfPasswordModalOpen(false);
                  setSelfPasswordError('');
                  setSelfPasswordSuccess(false);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selfPasswordSuccess ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-xs font-bold text-emerald-600">Đổi mật khẩu thành công!</p>
                <p className="text-[11px] text-slate-400">Đang đồng bộ hóa lên hệ thống dữ liệu...</p>
              </div>
            ) : (
              <form onSubmit={handleSelfPasswordChange} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Tài khoản</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser?.username}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg font-bold text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu hiện tại"
                    value={selfCurrentPassword}
                    onChange={(e) => setSelfCurrentPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-350 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA]"
                  />
                </div>

                <div className="space-y-1 border-t pt-3 border-slate-100">
                  <label className="text-[11px] font-bold text-slate-600">Mật khẩu mới</label>
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={selfNewPassword}
                    onChange={(e) => setSelfNewPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-350 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={selfConfirmPassword}
                    onChange={(e) => setSelfConfirmPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-350 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA]"
                  />
                </div>

                {selfPasswordError && (
                  <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 leading-relaxed">
                    ⚠️ {selfPasswordError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t pt-3 border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSelfPasswordModalOpen(false);
                      setSelfPasswordError('');
                      setSelfPasswordSuccess(false);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold cursor-pointer transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#005BAA] hover:bg-[#004B8C] text-white rounded-lg font-bold cursor-pointer transition flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
