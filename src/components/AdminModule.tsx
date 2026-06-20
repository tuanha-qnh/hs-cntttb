/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Building2, Users, Sliders, ChevronRight, ChevronDown, CheckSquare, Plus, Edit2, Trash2, 
  RotateCcw, Download, FileSpreadsheet, Cloud, Save, CheckCircle, AlertTriangle, Play, RefreshCw,
  Share2, Copy, Activity, Clock
} from 'lucide-react';
import { Unit, User, CloudflareConfig } from '../types';

interface Props {
  units: Unit[];
  users: User[];
  currentUser: User;
  cloudflareConfig: CloudflareConfig;
  onUnitsChange: (newUnits: Unit[]) => void;
  onUsersChange: (newUsers: User[]) => void;
  onConfigChange: (newConfig: CloudflareConfig) => void;
  onSyncLocalToCloud?: () => Promise<void> | void;
}

export default function AdminModule({ 
  units, 
  users, 
  currentUser,
  cloudflareConfig, 
  onUnitsChange, 
  onUsersChange, 
  onConfigChange,
  onSyncLocalToCloud
}: Props) {
  const [activeTab, setActiveTab] = useState<'units' | 'users' | 'sessions' | 'import' | 'cloudflare'>('units');

  // --- CLOUDFLARE SYNC FUNCTIONS ---
  const syncUnitToCloud = async (action: 'create' | 'update' | 'delete', unit: Unit) => {
    if (!cloudflareConfig.enabled || !cloudflareConfig.workerUrl) return;
    try {
      let cleanUrl = cloudflareConfig.workerUrl.trim();
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      const response = await fetch(`${cleanUrl}/api/units`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': cloudflareConfig.apiSecret,
        },
        body: JSON.stringify({ action, unit })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Lỗi HTTP ${response.status}`;
        throw new Error(errorMsg);
      }
    } catch (e: any) {
      console.error('Lỗi đồng bộ Đơn vị lên Cloudflare D1:', e);
      alert(`⚠️ LỖI ĐỒNG BỘ ĐƠN VỊ LÊN CLOUDFLARE!\nChi tiết: ${e.message || e}`);
    }
  };

  const syncUserToCloud = async (action: 'create' | 'update' | 'delete', user: User) => {
    if (!cloudflareConfig.enabled || !cloudflareConfig.workerUrl) return;
    try {
      let cleanUrl = cloudflareConfig.workerUrl.trim();
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      const response = await fetch(`${cleanUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': cloudflareConfig.apiSecret,
        },
        body: JSON.stringify({ action, user })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `Lỗi HTTP ${response.status}`;
        throw new Error(errorMsg);
      }
    } catch (e: any) {
      console.error('Lỗi đồng bộ Người dùng lên Cloudflare D1:', e);
      
      const isMissingColumnError = String(e.message || '').includes('canImportData') || String(e.message || '').includes('no such column');
      
      if (isMissingColumnError) {
        alert(`⚠️ LỖI ĐỒNG BỘ NGƯỜI DÙNG: CHƯA NÂNG CẤP CƠ SỞ DỮ LIỆU CLOUDFLARE D1!\n\n` +
              `Cơ sở dữ liệu của bạn thiếu cột "canImportData". Để phân quyền upload, vui lòng chạy câu lệnh SQL nâng cấp dưới đây trong trang quản trị Cloudflare D1 của bạn:\n\n` +
              `ALTER TABLE users ADD COLUMN canImportData INTEGER NOT NULL DEFAULT 0;\n\n` +
              `Chi tiết lỗi hệ thống: ${e.message}`);
      } else {
        alert(`⚠️ LỖI ĐỒNG BỘ NGƯỜI DÙNG LÊN CLOUDFLARE!\n` +
              `Chi tiết: ${e.message || e}`);
      }
    }
  };

  // --- 1. HOÀN THIỆN KHAI BÁO ĐƠN VỊ (TREE TREE VIEW) ---
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitName, setEditingUnitName] = useState('');
  const [newUnitParentId, setNewUnitParentId] = useState<string | null>(null);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [expandedUnitIds, setExpandedUnitIds] = useState<Record<string, boolean>>({
    'UN_ROOT': true,
    'UN_HL': true
  });

  const toggleExpand = (id: string) => {
    setExpandedUnitIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newUnitCode.trim().toUpperCase();
    const name = newUnitName.trim();
    if (!code) {
      alert('Vui lòng nhập Mã đơn vị.');
      return;
    }
    if (!name) {
      alert('Vui lòng nhập Tên đơn vị.');
      return;
    }

    // Tiêu chí kiểm tra nghiêm ngặt không cho phép trùng mã đơn vị (Primary Key)
    const isDuplicate = units.some(
      u => u.id.toUpperCase() === code || (u.unit_id && u.unit_id.toUpperCase() === code)
    );
    if (isDuplicate) {
      alert(`⚠️ Mã đơn vị "${code}" đã tồn tại trong hệ thống! Vui lòng chọn một mã khác độc bản để đảm bảo dữ liệu không bị trùng lặp.`);
      return;
    }

    const newUnit: Unit = {
      id: code,
      unit_id: code,
      name: name,
      parentId: newUnitParentId
    };
    onUnitsChange([...units, newUnit]);
    setNewUnitName('');
    setNewUnitCode('');
    setNewUnitParentId(null);

    // Sync to Cloudflare D1
    if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
      syncUnitToCloud('create', newUnit);
    }
  };

  const handleStartEditUnit = (unit: Unit) => {
    setEditingUnitId(unit.id);
    setEditingUnitName(unit.name);
  };

  const handleSaveEditUnit = (id: string) => {
    if (!editingUnitName.trim()) return;
    const existingParentId = units.find(u => u.id === id)?.parentId || null;
    const updatedUnit = { id, name: editingUnitName.trim(), parentId: existingParentId };
    onUnitsChange(units.map(u => u.id === id ? updatedUnit : u));
    setEditingUnitId(null);

    // Sync to Cloudflare D1
    if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
      syncUnitToCloud('update', updatedUnit);
    }
  };

  const handleDeleteUnit = (id: string) => {
    if (id === 'UN_ROOT') {
      alert('Không được xóa đơn vị gốc hệ thống.');
      return;
    }
    if (confirm('Bạn có chắc muốn xóa đơn vị này? Các đơn vị con cũng sẽ mất liên kết.')) {
      const unitToDelete = units.find(u => u.id === id);
      const childUnits = units.filter(u => u.parentId === id);
      onUnitsChange(units.filter(u => u.id !== id && u.parentId !== id));

      // Sync to Cloudflare D1
      if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
        if (unitToDelete) syncUnitToCloud('delete', unitToDelete);
        childUnits.forEach(child => syncUnitToCloud('delete', child));
      }
    }
  };

  // Render tree node recursive component
  const renderTreeNode = (parentId: string | null, depth = 0) => {
    const children = units.filter(u => u.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div className={`space-y-1 ${depth > 0 ? 'pl-6 border-l border-slate-200 mt-1 ml-3' : ''}`}>
        {children.map(unit => {
          const isExpanded = expandedUnitIds[unit.id];
          const hasChildren = units.some(u => u.parentId === unit.id);
          const isEditing = editingUnitId === unit.id;

          return (
            <div key={unit.id} className="space-y-1">
              <div className="flex items-center justify-between p-2 hover:bg-slate-100/80 rounded-lg group transition-colors">
                <div className="flex items-center gap-2">
                  {hasChildren ? (
                    <button onClick={() => toggleExpand(unit.id)} className="p-0.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}
                  <Building2 className={`w-4 h-4 ${depth === 0 ? 'text-[#005BAA]' : 'text-cyan-600'}`} />
                  
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingUnitName}
                        onChange={(e) => setEditingUnitName(e.target.value)}
                        className="px-2 py-0.5 text-xs border rounded outline-none w-48 font-sans"
                        autoFocus
                      />
                      <button onClick={() => handleSaveEditUnit(unit.id)} className="px-2 py-0.5 bg-[#005BAA] text-white rounded text-[10px] font-semibold">Lưu</button>
                      <button onClick={() => setEditingUnitId(null)} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold">Hủy</button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-700 font-sans flex items-center gap-1.5 flex-wrap">
                      <span>{unit.name}</span>
                      <span className="text-[9px] font-mono text-slate-400 font-normal bg-slate-100/80 border border-slate-200/50 px-1.5 py-0.5 rounded-md">
                        Mã: {unit.unit_id || unit.id}
                      </span>
                    </span>
                  )}
                </div>

                {!isEditing && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px]">
                    <button
                      onClick={() => {
                        setNewUnitParentId(unit.id);
                        setNewUnitName('');
                      }}
                      className="p-1 text-slate-500 hover:text-[#005BAA] hover:bg-white rounded cursor-pointer"
                      title="Thêm đơn vị con"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStartEditUnit(unit)}
                      className="p-1 text-slate-500 hover:text-cyan-600 hover:bg-white rounded cursor-pointer"
                      title="Sửa tên"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUnit(unit.id)}
                      className="p-1 text-slate-500 hover:text-red-500 hover:bg-white rounded cursor-pointer"
                      title="Xóa đơn vị"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {isExpanded && renderTreeNode(unit.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };


  // --- 2. KHAI BÁO NGƯỜI DÙNG CHUYÊN NGHIỆP ---
  const [adminUserForm, setAdminUserForm] = useState({
    username: '',
    fullName: '',
    role: 'User' as 'Admin' | 'User',
    unitId: 'UN_ROOT',
    canImportData: false
  });

  const [userSearchText, setUserSearchText] = useState('');
  const [userUnitFilter, setUserUnitFilter] = useState('');

  const [sessionSearchText, setSessionSearchText] = useState('');
  const [sessionUnitFilter, setSessionUnitFilter] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserUnitId, setEditUserUnitId] = useState('');
  const [editUserRole, setEditUserRole] = useState<'Admin' | 'User'>('User');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserCanImport, setEditUserCanImport] = useState(false);

  const handleStartEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserFullName(user.fullName);
    setEditUserUnitId(user.unitId);
    setEditUserRole(user.role);
    setEditUserPassword('');
    setEditUserCanImport(!!user.canImportData);
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserFullName.trim()) {
      alert('Vui lòng nhập Họ và tên nhân viên.');
      return;
    }

    const updatedUser: User = {
      ...editingUser,
      fullName: editUserFullName.trim(),
      unitId: editUserUnitId,
      role: editUserRole,
      canImportData: editUserCanImport,
    };

    if (editUserPassword.trim()) {
      updatedUser.password = editUserPassword.trim();
      updatedUser.isFirstLogin = true;
    }

    onUsersChange(users.map(u => u.id === editingUser.id ? updatedUser : u));

    // Sync to Cloudflare D1
    if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
      syncUserToCloud('update', updatedUser);
    }

    alert('Cập nhật thông tin tài khoản thành công!');
    setEditingUser(null);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const { username, fullName, role, unitId, canImportData } = adminUserForm;
    if (!username.trim() || !fullName.trim()) {
      alert('Vui lòng điền đủ Username và Họ tên.');
      return;
    }

    const collision = users.some(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (collision) {
      alert('Tên người dùng đã tồn tại trong hệ thống.');
      return;
    }

    const newUser: User = {
      id: 'USR_' + Date.now(),
      username: username.trim().toLowerCase(),
      fullName: fullName.trim(),
      role,
      unitId,
      isFirstLogin: true, // Requires password change
      status: 'active',
      password: 'Vnpt@2026',
      canImportData
    };

    onUsersChange([...users, newUser]);

    // Sync to Cloudflare D1
    if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
      syncUserToCloud('create', newUser);
    }

    // Save credentials warning in local store or mock output
    alert(`Người dùng mới được thêm thành công!\nMật khẩu tạm thời mặc định: Vnpt@2026\nYêu cầu đổi mật khẩu trong lần đăng nhập đầu tiên.`);

    setAdminUserForm({
      username: '',
      fullName: '',
      role: 'User',
      unitId: 'UN_ROOT',
      canImportData: false
    });
  };

  const handleResetPassword = (userId: string) => {
    if (confirm('Bạn có chắc muốn đặt lại mật khẩu cho thành viên này về lại giá trị mặc định "Vnpt@2026" ?')) {
      const matchedUser = users.find(u => u.id === userId);
      if (matchedUser) {
        const updatedUser = { ...matchedUser, isFirstLogin: true, password: 'Vnpt@2026' };
        onUsersChange(users.map(u => u.id === userId ? updatedUser : u));

        // Sync to Cloudflare D1
        if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
          syncUserToCloud('update', updatedUser);
        }
      }
      alert('Đồng bộ thành công: Mật khẩu đã được gỡ khôi phục về trạng thái ban đầu "Vnpt@2026"!');
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === 'admin') {
      alert('Tài khoản SuperAdmin gốc không được phép xóa.');
      return;
    }
    if (userId === currentUser.id) {
      alert('Bạn không thể tự xóa tài khoản của chính mình.');
      return;
    }
    if (confirm('Bạn có chắc muốn xóa thành viên này ra khỏi danh sách?')) {
      const userToDelete = users.find(u => u.id === userId);
      onUsersChange(users.filter(u => u.id !== userId));

      // Sync to Cloudflare D1
      if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
        if (userToDelete) syncUserToCloud('delete', userToDelete);
      }
    }
  };


  // --- 3. ĐỌC VÀ IMPORT EXCEL / CSV CHUYÊN NGHIỆP ---
  const [csvStatusLogs, setCsvStatusLogs] = useState<string[]>([]);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const fileInputCsvRef = useRef<HTMLInputElement>(null);

  const downloadSampleCsv = () => {
    const csvContent = "\uFEFFMã đơn vị,Họ tên,Username,Quyền\nUN_ROOT,Nguyễn Văn A,nguyenvana,User\nUN_HL,Trần Thị B,tranthib,Admin\nUN_BC,Lê Văn C,levanc,User";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'vinaphone_users_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const importedUsers: User[] = [];
      const logs: string[] = ['Bắt đầu quét tệp tin CSV...'];

      lines.forEach((line, index) => {
        if (index === 0) return; // Skip headers CSV row
        const columns = line.split(',');
        if (columns.length >= 4) {
          const unitId = columns[0].trim();
          const fullName = columns[1].trim();
          const username = columns[2].trim().toLowerCase();
          const role = columns[3].trim() === 'Admin' ? 'Admin' : 'User';

          if (fullName && username) {
            // Check collision
            const exists = users.some(u => u.username.toLowerCase() === username);
            if (!exists) {
              importedUsers.push({
                id: 'USR_CSV_' + Date.now() + '_' + index,
                username,
                fullName,
                role,
                unitId: unitId || 'UN_ROOT',
                isFirstLogin: true,
                status: 'active'
              });
              logs.push(`→ Thêm thành công: ${fullName} (${username}) - Đơn vị: ${unitId}`);
            } else {
              logs.push(`⚠ Bỏ qua (Trung lặp username): ${username}`);
            }
          }
        }
      });

      if (importedUsers.length > 0) {
        onUsersChange([...users, ...importedUsers]);
        logs.push(`Hoàn tất! Đồng bộ thành công ${importedUsers.length} tài khoản mới vào cơ sở dữ liệu.`);

        // Sync to Cloudflare D1
        if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
          importedUsers.forEach(u => syncUserToCloud('create', u));
        }
      } else {
        logs.push('Không có tài khoản mới hợp lệ nào được giải nén.');
      }
      setCsvStatusLogs(logs);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCsvDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setCsvDragActive(true);
    } else {
      setCsvDragActive(false);
    }
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCsvImport(e.dataTransfer.files[0]);
    }
  };


  // --- 4. BỔ SUNG CẤU HÌNH CLOUDFLARE D1 & R2 ---
  const [apiConfigForm, setApiConfigForm] = useState({
    workerUrl: cloudflareConfig.workerUrl || '',
    apiSecret: cloudflareConfig.apiSecret || '',
    enabled: cloudflareConfig.enabled
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleSaveApiSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onConfigChange({
      enabled: apiConfigForm.enabled,
      workerUrl: apiConfigForm.workerUrl.trim(),
      apiSecret: apiConfigForm.apiSecret.trim(),
      status: testResult === 'success' ? 'connected' : 'disconnected',
      lastTested: new Date().toISOString()
    });
    alert('Đã lưu cấu hình hạ tầng kết nối D1 & R2 đám mây!');
  };

  const triggerTestConnection = async () => {
    if (!apiConfigForm.workerUrl) {
      alert('Vui lòng nhập Worker Cloud URL trước khi thử kết nối.');
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    setTestError(null);

    try {
      let cleanUrl = apiConfigForm.workerUrl.trim();
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }

      const response = await fetch(`${cleanUrl}/api/test`, {
        method: 'GET',
        headers: {
          'x-api-secret': apiConfigForm.apiSecret.trim(),
        }
      });

      if (response.ok) {
        const data = await response.json();
        const isConnected = data.status === 'connected' || 
                            data.status === 'Hệ thống kết nối tốt!' || 
                            (data.status && typeof data.status === 'string' && (
                              data.status.toLowerCase().includes('kết nối tốt') || 
                              data.status.toLowerCase().includes('connected')
                            ));
        if (isConnected) {
          setTestResult('success');
        } else {
          setTestResult('failed');
          setTestError('Máy chủ phản hồi thành công nhưng dữ liệu trả về sai cấu trúc hoặc không có trạng thái kết nối hợp lệ.');
        }
      } else {
        setTestResult('failed');
        if (response.status === 401) {
          setTestError('Lỗi 401 Unauthorized: API Secret Token (x-api-secret) không hợp lệ hoặc không khớp với khóa bảo mật trên Cloudflare Worker.');
        } else if (response.status === 404) {
          setTestError('Lỗi 404 Not Found: Không tìm thấy API Endpoint "/api/test" kiểm tra kết nối. Vui lòng cập nhật đầy đủ mã nguồn cho File index.ts của Worker.');
        } else {
          setTestError(`Lỗi kết nối HTTP ${response.status}: ${response.statusText || 'Unknown Error'}`);
        }
      }
    } catch (e: any) {
      setTestResult('failed');
      const msg = e?.message || String(e);
      setTestError(`Hệ thống không thể thực hiện yêu cầu kết nối tới URL (Lỗi: "Failed to fetch"). Nguyên nhân thông dụng nhất:
1. URL Worker không hợp lệ hoặc chưa được Deploy (thử truy cập trực tiếp URL trên Tab mới để kiểm tra).
2. Lỗi CORS Policy trên Trình duyệt: Bạn đang truy cập từ tên miền hiện tại (${window.location.origin}) nhưng CORS ở phía Cloudflare Worker hoặc R2 Bucket chưa cấp phép cho tên miền này.
Chi tiết báo lỗi kỹ thuật: ${msg}`);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Tab select bar */}
      <div className="bg-slate-50 border-b border-slate-200 flex overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('units')}
          className={`px-5 py-3.5 font-bold flex items-center gap-1.5 border-b-2 outline-none cursor-pointer font-sans whitespace-nowrap ${
            activeTab === 'units' ? 'border-[#005BAA] text-[#005BAA] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Quản lý cơ cấu Tổ chức Đơn vị
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3.5 font-bold flex items-center gap-1.5 border-b-2 outline-none cursor-pointer font-sans whitespace-nowrap ${
            activeTab === 'users' ? 'border-[#005BAA] text-[#005BAA] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Khai báo Quản trị Người dùng
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-5 py-3.5 font-bold flex items-center gap-1.5 border-b-2 outline-none cursor-pointer font-sans whitespace-nowrap ${
            activeTab === 'sessions' ? 'border-[#005BAA] text-[#005BAA] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
          Theo dõi Truy cập &amp; Logins
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`px-5 py-3.5 font-bold flex items-center gap-1.5 border-b-2 outline-none cursor-pointer font-sans whitespace-nowrap ${
            activeTab === 'import' ? 'border-[#005BAA] text-[#005BAA] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Import CSV / Excel đồng loạt
        </button>

        <button
          onClick={() => setActiveTab('cloudflare')}
          className={`px-5 py-3.5 font-bold flex items-center gap-1.5 border-b-2 outline-none cursor-pointer font-sans whitespace-nowrap ${
            activeTab === 'cloudflare' ? 'border-[#005BAA] text-[#005BAA] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cloud className="w-4 h-4" />
          Cấu hình CSLD D1 & R2 Storage
        </button>
      </div>

      <div className="p-6">
        {/* TAB 1: BRANCH MANAGEMENT (TREE-VIEW) */}
        {activeTab === 'units' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 bg-slate-50/50 p-5 rounded-xl border border-slate-200">
              <h3 className="text-xs font-bold text-slate-700 uppercase border-b pb-2.5 mb-4 font-sans flex items-center gap-1">
                <Plus className="w-4 h-4 text-[#005BAA]" />
                Đăng ký Đơn vị Hành chính mới
              </h3>

              <form onSubmit={handleAddUnit} className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 font-sans">Chọn cấp đơn vị Cha</span>
                  <select
                    value={newUnitParentId || ''}
                    onChange={(e) => setNewUnitParentId(e.target.value || null)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none font-sans"
                  >
                    <option value="">(Cấp gốc cao nhất - VNPT Quảng Ninh)</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 font-sans">Mã đơn vị (Primary Key - Độc nhất) *</span>
                  <input
                    required
                    type="text"
                    placeholder="Gợi ý: UN_BC, CP_BH, v.v."
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value.replace(/\s+/g, '').toUpperCase())}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none font-mono tracking-wider"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 font-sans">Tên chi nhánh / Đơn vị mới *</span>
                  <input
                    required
                    type="text"
                    placeholder="Ví dụ: Phòng BH Bãi Cháy"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#005BAA] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Tạo đơn vị mới
                </button>
              </form>
            </div>

            <div className="md:col-span-7 space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase border-b pb-2.5 mb-4 flex items-center gap-2 font-sans">
                <Building2 className="w-4 h-4 text-[#005BAA]" />
                Sơ đồ cấu trúc hành chính dạng Cây (Hierarchical Tree)
              </h3>
              
              <div className="p-4 bg-white border rounded-xl max-h-[400px] overflow-y-auto">
                <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg text-xs font-bold font-sans">
                  <Sliders className="w-4 h-4 text-[#005BAA]" />
                  <span>Tổng Tổng Công Ty VNPT - ĐƠN VỊ CHỦ QUẢN</span>
                </div>
                <div className="mt-2 space-y-1">
                  {renderTreeNode(null)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER SETUP */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Create form user */}
            <div className="md:col-span-4 bg-slate-50/50 p-5 rounded-xl border border-slate-200">
              <h3 className="text-xs font-bold text-slate-700 uppercase border-b pb-2.5 mb-4 font-sans flex items-center gap-1">
                <Plus className="w-4 h-4 text-cyan-600" />
                Đăng ký tài khoản Giao dịch viên
              </h3>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 font-sans">Thuộc đơn vị trực thuộc</span>
                  <select
                    value={adminUserForm.unitId}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, unitId: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                  >
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 font-sans">Họ và tên nhân viên *</span>
                  <input
                    required
                    type="text"
                    placeholder="Điền họ tên người dùng"
                    value={adminUserForm.fullName}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, fullName: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 font-sans">Tên đăng nhập (Username) *</span>
                  <input
                    required
                    type="text"
                    placeholder="Ví dụ: tuanha"
                    value={adminUserForm.username}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, username: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 font-sans">Quyền lợi phân cấp</span>
                  <select
                    value={adminUserForm.role}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, role: e.target.value as 'Admin' | 'User' })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                  >
                    <option value="User">Giao dịch viên (User)</option>
                    <option value="Admin">Quản trị viên (Admin)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 py-1 bg-slate-100/50 p-2 rounded-lg border border-slate-200/50">
                  <input
                    type="checkbox"
                    id="canImportData"
                    checked={adminUserForm.canImportData}
                    onChange={(e) => setAdminUserForm({ ...adminUserForm, canImportData: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-[#005BAA] focus:ring-[#005BAA] cursor-pointer"
                  />
                  <label htmlFor="canImportData" className="text-[11px] font-semibold text-slate-700 cursor-pointer font-sans select-none">
                    Quyền khai thác module upload dữ liệu
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#005BAA] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Kích hoạt Người dùng
                </button>
              </form>
            </div>

            {/* List users table */}
            <div className="md:col-span-8 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase border-b pb-2.5 flex items-center gap-2 font-sans">
                <Users className="w-4 h-4 text-[#005BAA]" />
                Danh mục nhân sự khai thác cổng nghiệp vụ
              </h3>

              {/* Công cụ Tìm kiếm và Bộ lọc Đơn vị */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 font-sans">Tìm kiếm tài khoản / họ tên</label>
                  <input
                    type="text"
                    placeholder="Nhập tên hoặc username..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 font-sans">Lọc theo Đơn vị / Phòng ban</label>
                  <select
                    value={userUnitFilter}
                    onChange={(e) => setUserUnitFilter(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                  >
                    <option value="">-- Tất cả phòng ban --</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(() => {
                const filteredUsers = users.filter(u => {
                  const matchSearch = u.username.toLowerCase().includes(userSearchText.toLowerCase()) || 
                                      u.fullName.toLowerCase().includes(userSearchText.toLowerCase());
                  const matchUnit = userUnitFilter ? u.unitId === userUnitFilter : true;
                  return matchSearch && matchUnit;
                });

                return (
                  <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase font-sans border-b border-slate-200/80 tracking-wider">
                          <th className="px-4 py-3">Tài khoản</th>
                          <th className="px-4 py-3">Họ và tên</th>
                          <th className="px-4 py-3">Thuộc Chi nhánh</th>
                          <th className="px-4 py-3">Phân Quyền</th>
                          <th className="px-4 py-3 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-sans">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-sans">
                              Không tìm thấy người dùng nào khớp với bộ lọc.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(u => {
                            const associatedUnit = units.find(item => item.id === u.unitId);
                            return (
                              <tr key={u.id} className="hover:bg-slate-100/30 transition-colors text-slate-700 even:bg-slate-50/20">
                                <td className="px-4 py-3 text-[#005BAA] font-bold font-mono text-xs">{u.username}</td>
                                <td className="px-4 py-3 font-bold text-slate-850">{u.fullName}</td>
                                <td className="px-4 py-3 text-slate-500 font-medium">{associatedUnit ? associatedUnit.name : 'Chưa phân bổ'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] border tracking-wider ${
                                      u.role === 'Admin' ? 'bg-red-50 text-red-650 border-red-100' : 'bg-green-50 text-green-650 border-green-100'
                                    }`}>
                                      {u.role === 'Admin' ? 'ADMIN' : 'GDV (USER)'}
                                    </span>
                                    {(u.canImportData || u.role === 'Admin') && (
                                      <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-indigo-50 text-indigo-650 border border-indigo-100 uppercase tracking-tight">
                                        + Quyền Upload
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleStartEditUser(u)}
                                      className="p-1 px-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-blue-600 rounded-md transition-all cursor-pointer"
                                      title="Chỉnh sửa thông tin tài khoản"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleResetPassword(u.id)}
                                      className="p-1 px-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-orange-600 rounded-md transition-all cursor-pointer"
                                      title="Khôi phục Password mặc định (Vnpt@2026)"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="p-1 px-1.5 hover:bg-red-50 border border-transparent hover:border-red-100 text-red-600 rounded-md transition-all cursor-pointer"
                                      title="Xóa tài khoản"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB SESSIONS: ACCOUNT TRAFFIC MONITORING */}
        {activeTab === 'sessions' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header statistics info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-4">
                <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-600 shrink-0">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Đang trực tuyến</p>
                  <p className="text-xl font-bold font-mono text-emerald-650 leading-tight">
                    {users.filter(u => u.isSessionActive).length} <span className="text-xs font-normal text-slate-500 font-sans">thành viên</span>
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#005BAA]/5 to-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center gap-4">
                <div className="p-2.5 bg-[#005BAA]/10 rounded-lg text-[#005BAA] shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Tổng nhân sự hệ thống</p>
                  <p className="text-xl font-bold font-mono text-slate-800 leading-tight">
                    {users.length} <span className="text-xs font-normal text-slate-500 font-sans">tài khoản</span>
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-4">
                <div className="p-2.5 bg-indigo-100 rounded-lg text-indigo-600 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Tổng lượt đăng nhập tháng</p>
                  <p className="text-xl font-bold font-mono text-indigo-655 leading-tight">
                    {users.reduce((acc, curr) => acc + (curr.loginCountThisMonth || 0), 0)} <span className="text-xs font-normal text-slate-500 font-sans">lượt</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Filter and search tool */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 font-sans">Tìm kiếm tài khoản / họ tên</label>
                <input
                  type="text"
                  placeholder="Nhập tên đăng nhập hoặc họ tên nhân viên..."
                  value={sessionSearchText}
                  onChange={(e) => setSessionSearchText(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 font-sans">Đơn vị / Phòng ban</label>
                <select
                  value={sessionUnitFilter}
                  onChange={(e) => setSessionUnitFilter(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                >
                  <option value="">-- Tất cả bộ phận --</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 font-sans">Trạng thái Truy cập</label>
                <select
                  value={sessionStatusFilter}
                  onChange={(e) => setSessionStatusFilter(e.target.value as any)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                >
                  <option value="all">Tất cả tài khoản</option>
                  <option value="online">🟢 Đang hoạt động (Online)</option>
                  <option value="offline">⚫ Ngoại tuyến (Offline)</option>
                </select>
              </div>
            </div>

            {/* Session tracking table */}
            {(() => {
              const filteredSessions = users.filter(u => {
                const matchSearch = u.username.toLowerCase().includes(sessionSearchText.toLowerCase()) || 
                                    u.fullName.toLowerCase().includes(sessionSearchText.toLowerCase());
                const matchUnit = sessionUnitFilter ? u.unitId === sessionUnitFilter : true;
                const matchStatus = sessionStatusFilter === 'all' 
                  ? true 
                  : sessionStatusFilter === 'online' 
                    ? u.isSessionActive 
                    : !u.isSessionActive;
                return matchSearch && matchUnit && matchStatus;
              });

              const formatDateTime = (isoString?: string) => {
                if (!isoString) return 'Chưa ghi nhận hoạt động';
                try {
                  const d = new Date(isoString);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                  const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                  return `${timeStr} ngày ${dateStr}`;
                } catch {
                  return 'Không xác định';
                }
              };

              return (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50 border-b border-solid border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 font-sans uppercase">
                      Danh sách Giao dịch viên &amp; Phiên truy cập hiện hành
                    </span>
                    <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-100 font-sans select-none animate-pulse">
                      Cập nhật trực tiếp
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/20 text-slate-500 text-[10px] font-bold uppercase font-sans border-b border-slate-200 tracking-wider">
                          <th className="px-5 py-3">Đơn vị</th>
                          <th className="px-5 py-3">Họ và tên</th>
                          <th className="px-5 py-3">User đăng nhập</th>
                          <th className="px-5 py-3 text-center">Đăng nhập trong tháng</th>
                          <th className="px-5 py-3">Hoạt động cuối</th>
                          <th className="px-5 py-3 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-sans">
                        {filteredSessions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-sans italic">
                              Hệ thống không tìm thấy phiên truy cập nào phù hợp với bộ lọc hiện thời.
                            </td>
                          </tr>
                        ) : (
                          filteredSessions.map(u => {
                            const associatedUnit = units.find(item => item.id === u.unitId);
                            return (
                              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                                <td className="px-5 py-3.5 font-sans font-medium text-slate-600">
                                  {associatedUnit ? associatedUnit.name : 'Quản trị VNPT'}
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800">{u.fullName}</span>
                                    <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded-md ${
                                      u.role === 'Admin' 
                                        ? 'bg-red-50 text-red-650 border border-red-100' 
                                        : 'bg-green-50 text-green-650 border border-green-100'
                                    }`}>
                                      {u.role === 'Admin' ? 'ADMIN' : 'USER'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 font-bold font-mono text-[#005BAA] text-xs">
                                  {u.username}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono font-bold bg-indigo-50/50 border border-indigo-100/40 text-xs text-indigo-700">
                                    {u.loginCountThisMonth || 0} lượt
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                                  {formatDateTime(u.lastActiveTime)}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  {u.isSessionActive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold leading-none">
                                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                      Trực tuyến
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-bold leading-none">
                                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                      Ngoại tuyến
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-500 font-sans italic flex items-center gap-1.5 leading-relaxed">
                    <span className="text-emerald-500 font-bold">●</span>
                    Cơ chế an ninh lớp sâu tự động phát hiện phiên nhàn rỗi và cưỡng chế đăng xuất hoàn toàn sau 10 phút không tương tác để ngăn chặn truy cập trái phép.
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 3: MASS CSV IMPORT EXCEL */}
        {activeTab === 'import' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-slate-50/60 p-5 rounded-xl border border-slate-205 flex flex-col md:flex-row items-center justify-between gap-5 col-span-1">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#005BAA]" />
                  Nạp tài khoản hàng loạt bằng Excel / CSV
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-sans max-w-xl">
                  Để nạp nhanh hàng loạt tài khoản người dùng, hãy tải tệp danh sách mẫu CSV tiêu chuẩn, cập nhật thông tin cột đơn vị, họ tên, quyền lực rồi kéo thả nạp trở lại để ghi vào cơ sở dữ liệu.
                </p>
              </div>

              <button
                onClick={downloadSampleCsv}
                className="px-4 py-2 bg-[#005BAA] hover:bg-blue-600 border border-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Tải file mẫu Excel (.CSV)
              </button>
            </div>

            {/* Draggable Drop csv container */}
            <div
              onDragEnter={handleCsvDrag}
              onDragOver={handleCsvDrag}
              onDragLeave={handleCsvDrag}
              onDrop={handleCsvDrop}
              onClick={() => fileInputCsvRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] ${
                csvDragActive ? 'border-[#005BAA] bg-blue-50/20' : 'border-slate-200/90 hover:border-[#005BAA] bg-slate-50/30'
              }`}
            >
              <input
                ref={fileInputCsvRef}
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleCsvImport(e.target.files[0])}
                className="hidden"
              />

              <div className="space-y-2 flex flex-col items-center justify-center">
                <div className="p-3 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                  <FileSpreadsheet className="w-6 h-6 text-[#005BAA]" />
                </div>
                <p className="text-xs font-bold text-slate-800 font-sans">
                  Kéo thả file mẫu CSV / Excel của bạn vào đây hoặc bấm để tải lên
                </p>
                <p className="text-[10px] text-slate-400 font-sans font-medium">
                  Hệ thống tiếp nhận bảng mã UTF-8 định dạng chuẩn và rà soát định danh trùng lập.
                </p>
              </div>
            </div>

            {/* Parsing logic display logs */}
            {csvStatusLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 font-sans">Bộ nhật ký giải nén nhập bảng ghi (LOGS)</h4>
                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
                  {csvStatusLogs.map((log, index) => (
                    <div key={index} className="leading-relaxed">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DATABASE CONNECTION OVERVIEW CONFIG */}
        {activeTab === 'cloudflare' && (
          <div className="space-y-6">
            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 flex items-start gap-3">
              <Cloud className="w-5 h-5 text-[#005BAA] mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-[#005BAA] font-sans">
                  Cơ chế Đồng bộ Hóa Đám Mây Trực Tuyến Độc lập (Cloudflare Serverless)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  Hãy nhập liên kết API Worker được thiết lập từ hướng dẫn "Cầm tay chỉ việc", cùng Auth Secret Key của bạn. Khi kích hoạt tùy chọn này, bất kỳ thao tác tạo hồ sơ hoặc tra cứu, xem ảnh đều được gửi trực tiếp tới máy chủ Cloudflare D1 SQL và R2 Object Storage của bạn, an toàn tuyệt đối.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveApiSettings} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 font-sans flex items-center gap-1">
                    Worker API Deployment Endpoint Base URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://vinaphone-tttb-worker.tuanha-qnh.workers.dev"
                    value={apiConfigForm.workerUrl}
                    onChange={(e) => setApiConfigForm({ ...apiConfigForm, workerUrl: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 font-sans flex items-center gap-1">
                    API Authorization Secret Token (x-api-secret)
                  </label>
                  <input
                    type="password"
                    placeholder="Khóa mật khẩu API định cấu hình trong wrangler.toml"
                    value={apiConfigForm.apiSecret}
                    onChange={(e) => setApiConfigForm({ ...apiConfigForm, apiSecret: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              {/* Status Connection check box */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between border border-slate-200 p-4 bg-slate-50/50 rounded-xl gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3.5 w-3.5">
                      {testResult === 'success' && (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                        </>
                      )}
                      {testResult === 'failed' && (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                        </>
                      )}
                      {testResult === null && (
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-slate-400"></span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 font-sans">Kiểm thử trạng thái mạng: </span>
                      <span className="text-xs font-extrabold font-sans">
                        {testResult === 'success' && (
                          <span className="text-emerald-600 font-bold">ĐÃ THÔNG SUỐT (Liên kết với đám mây sẵn sàng)</span>
                        )}
                        {testResult === 'failed' && (
                          <span className="text-rose-600 font-bold">KẾT NỐI THẤT BẠI (Vui lòng kiểm tra lỗi bên dưới)</span>
                        )}
                        {testResult === null && (
                          <span className="text-slate-500 font-medium">CHƯA PING KIỂM THỬ (Bấm nút bên phải để kiểm thử)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={testingConnection}
                      onClick={triggerTestConnection}
                      className="px-4 py-2 bg-[#005BAA]/10 hover:bg-[#005BAA]/20 text-[#005BAA] font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {testingConnection ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Đang kết nối...
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Ping Test kết nối
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
                      <input
                        id="checkbox-enable-cloudflare"
                        type="checkbox"
                        checked={apiConfigForm.enabled}
                        onChange={(e) => setApiConfigForm({ ...apiConfigForm, enabled: e.target.checked })}
                        className="w-4 h-4 text-[#005BAA] focus:ring-blue-100 border-slate-300 rounded cursor-pointer"
                      />
                      <label htmlFor="checkbox-enable-cloudflare" className="text-xs font-semibold text-slate-700 font-sans select-none cursor-pointer">
                        Chuyển sang Cơ chế Trực tuyến 100%
                      </label>
                    </div>
                  </div>
                </div>

                {testResult === 'failed' && testError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-2 text-left">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs font-sans">
                      <span className="text-base">⚠️</span> LỖI CHI TIẾT KHI KẾT NỐI CLOUDFLARE:
                    </div>
                    <p className="text-xs text-rose-700 whitespace-pre-line font-mono leading-relaxed bg-white/60 p-3 rounded-lg border border-rose-100 overflow-x-auto">
                      {testError}
                    </p>
                    <div className="text-[11px] text-slate-500 leading-relaxed font-sans mt-2">
                      💡 <strong>Mẹo khắc phục quan trọng nhất:</strong> Dự án của bạn đang được truy cập tại địa chỉ nguồn <code className="bg-slate-100 font-mono text-slate-800 px-1 py-0.5 rounded">{window.location.origin}</code>. Vui lòng cập nhật cấu hình <strong>CORS Policy</strong> của Cloudflare R2 Bucket để chắc chắn cho phép tên miền trên truy cập dữ liệu. Bạn có thể xem mã cấu hình CORS chuẩn có trong tab <strong>"Cầm tay chỉ việc / Hướng dẫn setup và mã nguồn Cloudflare"</strong> ở thanh tiêu đề trên cùng.
                    </div>
                  </div>
                )}
              </div>

              {cloudflareConfig.enabled && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 text-left mt-4 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="text-emerald-800 font-bold text-xs flex items-center gap-1.5 font-sans">
                      <Share2 className="w-4 h-4 text-emerald-600" />
                      LIÊN KẾT TỰ ĐỘNG CẤU HÌNH CHO GIAO DỊCH VIÊN KHÁC (BẮT BUỘC ĐỂ ĐỒNG BỘ ĐỒNG NGHIỆP)
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed font-sans">
                      Hãy sao chép liên kết đặc biệt này gửi cho các thành viên trong tổ/đội. Khi họ mở liên kết này trên máy tính khác, trình duyệt của họ sẽ <strong>tự động liên kết mượt mà với cơ sở dữ liệu Cloudflare D1 + tủ lưu trữ R2 toàn hệ thống</strong> và tải toàn bộ tài khoản vừa tạo về máy để đăng nhập tức thì!
                    </p>
                    <div className="bg-white border border-emerald-200 p-2.5 rounded-lg select-all font-mono text-[9px] break-all text-emerald-800 select-all max-h-16 overflow-y-auto w-full">
                      {`${window.location.origin}${window.location.pathname}?workerUrl=${encodeURIComponent(cloudflareConfig.workerUrl)}&apiSecret=${encodeURIComponent(cloudflareConfig.apiSecret)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?workerUrl=${encodeURIComponent(cloudflareConfig.workerUrl)}&apiSecret=${encodeURIComponent(cloudflareConfig.apiSecret)}`;
                      navigator.clipboard.writeText(url);
                      alert('🔑 Đã copy đường dẫn tự động liên kết thành công! Hãy gửi mã này cho Giao dịch viên của bạn để họ mở lên.');
                    }}
                    className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 justify-center w-full md:w-auto"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link Auto-Setup
                  </button>
                </div>
              )}

              {cloudflareConfig.enabled && onSyncLocalToCloud && (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 text-left mt-4 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="space-y-1">
                    <div className="text-indigo-800 font-bold text-xs flex items-center gap-1.5 font-sans">
                      <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin-slow" />
                      CÔNG CỤ ĐỒNG BỘ HÓA DỮ LIỆU CỤC BỘ (LOCAL TO CLOUD MIGRATIVE SYNC)
                    </div>
                    <p className="text-[11px] text-indigo-600/90 leading-relaxed font-sans">
                      Nếu trước đó bạn đã tạo các Đơn vị, Tài khoản nhân sự (bao gồm cả Mật khẩu đã đổi) hoặc lưu các Thuê bao và hình ảnh cục bộ (Local Storage), hãy bấm nút đồng bộ này để đẩy toàn bộ lên cơ sở dữ liệu D1 & tủ chứa R2 đám mây ngay lập tức.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onSyncLocalToCloud}
                    className="shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Đồng bộ Offline → Cloud
                  </button>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t mt-4">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#005BAA] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Ghi Lại Cấu Hình Toàn Hệ Thống
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase font-sans flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-[#005BAA]" />
                Hiệu chỉnh tài khoản
              </h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveEditUser} className="p-5 space-y-4 text-xs">
              <div className="space-y-1 text-left">
                <span className="text-[11px] font-semibold text-slate-500 font-sans">Tên tài khoản (Không thể sửa)</span>
                <input
                  disabled
                  type="text"
                  value={editingUser.username}
                  className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg font-mono outline-none"
                />
              </div>

              <div className="space-y-1 text-left">
                <span className="text-[11px] font-semibold text-slate-500 font-sans">Họ và tên nhân viên *</span>
                <input
                  required
                  type="text"
                  placeholder="Họ và tên"
                  value={editUserFullName}
                  onChange={(e) => setEditUserFullName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                />
              </div>

              <div className="space-y-1 text-left">
                <span className="text-[11px] font-semibold text-slate-500 font-sans">Thuộc đơn vị / Phòng ban</span>
                <select
                  value={editUserUnitId}
                  onChange={(e) => setEditUserUnitId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 text-left">
                <span className="text-[11px] font-semibold text-slate-500 font-sans">Vai trò phân cấp</span>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as 'Admin' | 'User')}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-sans"
                >
                  <option value="User">Giao dịch viên (User)</option>
                  <option value="Admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 py-1.5 bg-slate-100/50 p-2 rounded-lg border border-slate-200/50">
                <input
                  type="checkbox"
                  id="editUserCanImport"
                  checked={editUserCanImport}
                  onChange={(e) => setEditUserCanImport(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#005BAA] focus:ring-[#005BAA] cursor-pointer"
                />
                <label htmlFor="editUserCanImport" className="text-[11px] font-semibold text-slate-750 cursor-pointer font-sans select-none">
                  Quyền khai thác module upload dữ liệu
                </label>
              </div>

              <div className="space-y-1 border-t pt-3 mt-3 text-left">
                <span className="text-[11px] font-semibold text-slate-500 font-sans block">Đặt lại mật khẩu mới (Tùy chọn)</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập tối thiểu 6 ký tự để đổi, hoặc bỏ trống"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Nếu đặt lại, thành viên này sẽ được yêu cầu đổi mật khẩu mới trong lần đăng nhập tới.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t text-xs">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#005BAA] hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
