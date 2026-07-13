export type Role = 'Super Admin' | 'Admin' | 'Office Staff' | 'Site Incharge' | 'Munshi';

export type AppView = 'dashboard' | 'project' | 'munshi_entry' | 'mobile_home' | 'mobile_settings' | 'create_project' | 'user_management' | 'attendance' | 'payment_dashboard' | 'user_manual' | 'recycle_bin' | 'approval_requests' | 'audit_logs' | 'document_ledger' | 'site_photos' | 'subcontractor_view';

export interface BaseRecord {
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface Company extends BaseRecord {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: string;
}

export interface User extends BaseRecord {
  id: string;
  tenantId?: string;
  name: string;
  role: Role;
  phone: string;
  pin: string;
  assignedProjects: string[]; // Project IDs
  status: 'Active' | 'Inactive' | 'Deleted';
  pettyCashBalance?: number;
  photo?: string;
  addressProof?: string;
  canViewSubcontractors?: boolean;
  preferences?: {
    language?: 'en' | 'hi';
    projectBalances?: Record<string, number>;
  };
}

export interface ExpenseBreakdown {
  material: number;
  consumedMaterial?: number;
  shifting: number;
  labor: number;
  machinery: number;
  misc: number;
}

export interface ReceiptEntry extends BaseRecord {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface ExpenseEntry extends BaseRecord {
  id: string;
  category: 'material' | 'consumed_material' | 'shifting' | 'labor' | 'machinery' | 'misc';
  date: string;
  itemName: string;
  quantity: string;
  rate: number;
  amount: number;
  vendor?: string;
  vehicleNo?: string;
  vendorQuantity?: number;
  vendorUnit?: string;
  vendorRate?: number;
  conversionFactor?: number;
  hasInvoice?: boolean;
  photo?: string;
  livePhoto?: string;
  description?: string;
  entryLatitude?: number;
  entryLongitude?: number;
  submittedBy?: string;
  submittedById?: string;
  submittedByRole?: Role;
  status?: 'Pending Approval' | 'Approved' | 'Rejected' | 'Deleted';
  rejectionReason?: string;
  paidBy?: 'petty_cash' | 'office' | 'unpaid' | 'used';
  shifterName?: string;
}

export interface AdvanceEntry extends BaseRecord {
  id: string;
  date: string;
  userId: string;
  userName: string;
  userRole: Role;
  amount: number;
  note: string;
  proofPhoto?: string;
}

export interface DocumentEntry extends BaseRecord {
  rejectionReason?: string;
  id: string;
  name: string;
  data: string;
  type: string;
  uploadedAt: string;
  description?: string;
  uploadedBy?: string;
  uploadedById?: string;
  status?: 'Pending Approval' | 'Approved' | 'Rejected' | 'Deleted';
}

export interface SitePhoto extends BaseRecord {
  rejectionReason?: string;
  id: string;
  name: string;
  data: string;
  type: string;
  uploadedAt: string;
  description?: string; // keeping for backward compatibility
  remarks?: string;
  uploadedBy?: string;
  uploadedById?: string;
  status?: 'Pending Approval' | 'Approved' | 'Rejected' | 'Deleted';
  category?: 'Progress Photo' | 'Before Work' | 'During Work' | 'After Completion' | 'Issue / Damage';
  latitude?: number;
  longitude?: number;
  dateTaken?: string;
}

export interface SubcontractorProgress extends BaseRecord {
  id: string;
  date: string;
  quantity: number;
  reportedBy: string;
}

export interface SubcontractorPayment extends BaseRecord {
  id: string;
  date: string;
  amount: number;
  note: string;
  paidBy: string;
}

export interface Subcontractor extends BaseRecord {
  id: string;
  name: string;
  phone: string;
  workDescription: string;
  rate: number;
  unit: string;
  estimatedQuantity?: number;
  progress: SubcontractorProgress[];
  payments: SubcontractorPayment[];
  isArchived?: boolean;
}

export interface LaborAttendance extends BaseRecord {
  date: string;
  status: string; // 'P' | 'A' | 'H'
  advance: number;
}

export interface LaborEntry extends BaseRecord {
  id: string;
  name: string;
  type: string;
  customType?: string;
  rate: number;
  phone?: string;
  address?: string;
  photo?: string;
  attendance?: LaborAttendance[];
  status?: string;
  advance?: string;
  createdBy?: string;
  isArchived?: boolean;
  approvalStatus?: 'Pending Approval' | 'Approved' | 'Rejected' | 'Deleted';
}

export interface SupplierPayment extends BaseRecord {
  id: string;
  date: string;
  vendorName: string;
  amount: number;
  note: string;
  paidBy: string;
  submittedBy?: string;
  submittedById?: string;
  submittedByRole?: Role;
  status?: 'Pending Approval' | 'Approved' | 'Rejected' | 'Deleted';
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  isMilestone?: boolean;
  milestoneData?: Milestone;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  completedAt?: string;
}

export interface Project extends BaseRecord {
  id: string;
  tenantId?: string;
  name: string;
  department: string;
  scheme: string;
  location: string;
  latitude?: number;
  longitude?: number;
  geofencingEnabled?: boolean;
  woValue: number;
  received: number;
  receiptsHistory?: ReceiptEntry[];
  expenseItems?: ExpenseEntry[];
  advanceHistory?: AdvanceEntry[];
  documents?: DocumentEntry[];
  sitePhotos?: SitePhoto[];
  labors?: LaborEntry[];
  subcontractors?: Subcontractor[];
  supplierPayments?: SupplierPayment[];
  activityLogs?: ActivityLog[];
  milestones?: Milestone[];
  expenses: ExpenseBreakdown;
  status: 'Active' | 'Completed' | 'Upcoming' | 'Deleted';
  incharge: string;
}

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  time: string;
  projectId?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface RecycleBinItem {
  id: string;
  projectId?: string;
  itemType: string;
  itemName: string;
  itemData: any;
  deletedBy: string;
  deletedAt: string;
  deleteReason: string;
}

export interface ApprovalRequest {
  id: string;
  projectId?: string;
  module: string;
  recordId: string;
  itemName: string;
  action: 'Create' | 'Edit' | 'Delete';
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedBy: string;
  requestedById: string;
  requestedByRole?: string;
  requestedAt: string;
  reason?: string;
  oldData?: any;
  newData?: any;
}

export interface AppAuditLog {
  id: string;
  projectId?: string;
  module: string;
  recordId: string;
  action: 'Create' | 'Update Request' | 'Update Approved' | 'Update Rejected' | 'Create Approved' | 'Create Rejected' | 'Delete Request' | 'Delete Approved' | 'Delete Rejected' | 'Restore' | 'Archive' | 'Permanent Delete' | 'Login' | 'Logout';
  user: string;
  role: string;
  timestamp: string;
  oldValues?: any;
  newValues?: any;
  device?: string;
  ipAddress?: string;
  reason?: string;
}

export interface AppState {
  currentTenantId?: string;
  currentTenantName?: string;
  currentUser: User | null;
  currentRole: Role;
  currentView: AppView;
  selectedProjectId: string | null;
  entryTab?: 'material' | 'logistics' | 'labor' | 'machinery' | 'misc' | 'shifting' | 'petty_cash';
  projects: Project[];
  users: User[];
  notifications: Notification[];
  toasts?: ToastMessage[];
  searchQuery?: string;
  language?: 'en' | 'hi';
  isSynced?: boolean;
  hasAdmin?: boolean;
  recycleBin?: RecycleBinItem[];
  approvalRequests?: ApprovalRequest[];
  auditLogs?: AppAuditLog[];
}
