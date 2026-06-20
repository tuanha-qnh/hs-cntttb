/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Unit {
  id: string;
  unit_id?: string;
  name: string;
  parentId: string | null;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'Admin' | 'User';
  unitId: string;
  isFirstLogin: boolean;
  status: 'active' | 'inactive';
  password?: string;
  canImportData?: boolean;
  user_guest?: boolean;
  loginCountThisMonth?: number;
  lastActiveTime?: string;
  isSessionActive?: boolean;
}

export interface SubscriberRecord {
  id: string;
  phoneNumber: string;
  fullName: string;
  idNumber: string;
  createdAt: string;
  createdBy: string;
  creatorName: string;
  unitId: string;
  unitName: string;
  imageUrl: string; // Base64 or Cloudflare R2 public URL
}

export interface CloudflareConfig {
  enabled: boolean;
  workerUrl: string;
  apiSecret: string;
  status: 'disconnected' | 'connected' | 'error';
  lastTested: string | null;
}

export interface DashboardStats {
  totalRecords: number;
  recordsToday: number;
  recordsByUnit: { [unitId: string]: number };
}
