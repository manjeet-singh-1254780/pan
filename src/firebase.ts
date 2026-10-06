/**
 * PAN Card Apply Web App - Firebase Integration Layer
 * Uses the user's configured Firebase project: digital-dhadi
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, get, child, update, type Database } from 'firebase/database';

export const firebaseConfig = {
  apiKey: "AIzaSyCbmZyklcDmHaubwV8UP3ZlzdNfOREd3rI",
  authDomain: "digital-dhadi.firebaseapp.com",
  databaseURL: "https://digital-dhadi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "digital-dhadi",
  storageBucket: "digital-dhadi.firebasestorage.app",
  messagingSenderId: "65410797101",
  appId: "1:65410797101:web:1e27d26ddb70f04150b2a4"
};

let app: FirebaseApp | null = null;
let db: Database | null = null;
let isFirebaseOnline = false;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  db = getDatabase(app);
  isFirebaseOnline = true;
  console.log('[Firebase] Initialized successfully with project: digital-dhadi');
} catch (err) {
  console.warn('[Firebase] Initialization notice: Falling back to local offline sync store.', err);
  isFirebaseOnline = false;
}

export { app, db, isFirebaseOnline };

/* ============================================================
   DATA MODELS
   ============================================================ */

export interface DocumentItem {
  id: string;
  name: string;
  type: 'identity_proof' | 'address_proof' | 'dob_proof' | 'photo' | 'signature';
  subType?: string;
  url: string; // Base64 data URI or secure storage URL
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  status: 'Pending' | 'Under Review' | 'Verified' | 'Rejected';
  rejectionReason?: string;
  rejectedAt?: string;
  verifiedAt?: string;
}

export interface PANApplication {
  id: string; // e.g. PAN-2026-1001
  userId: string;
  category: 'Individual' | 'HUF';
  applicant: {
    title: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    panCardName: string;
    dob: string;
    gender: 'Male' | 'Female' | 'Transgender';
    fatherName: string;
    motherName?: string;
    parentPreference: 'Father' | 'Mother';
    aadhaarNumber: string;
    nameAsPerAadhaar: string;
  };
  contact: {
    mobile: string;
    email: string;
  };
  address: {
    flat: string;
    premises?: string;
    street: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    sameAsPerm: boolean;
  };
  documents: {
    poi: DocumentItem;
    poa: DocumentItem;
    dob: DocumentItem;
    photo: DocumentItem;
    signature: DocumentItem;
  };
  payment: {
    amount: number;
    baseFee: number;
    serviceFee: number;
    taxes: number;
    status: 'Pending' | 'Processing' | 'Successful' | 'Failed' | 'Refunded';
    method: 'upi' | 'card' | 'netbanking';
    transactionId: string;
    gatewayRef?: string;
    paidAt?: string;
  };
  status: 
    | 'Draft'
    | 'Under Review'
    | 'Documents Approved'
    | 'Payment Confirmed'
    | 'Submitted to Provider'
    | 'Processing'
    | 'Action Required'
    | 'Completed'
    | 'Rejected'
    | 'Cancelled';
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note: string;
    updatedBy: string;
  }>;
  provider: {
    name: string; // e.g. 'Protean / UTIITSL (Sandbox)'
    status: 'Sandbox Mode' | 'Queued' | 'Submitted' | 'Verified' | 'Allotted';
    acknowledgementNumber?: string;
    submissionDate?: string;
    responseDetails?: string;
  };
  internalNotes?: Array<{
    id: string;
    admin: string;
    text: string;
    timestamp: string;
  }>;
  panNumber?: string;
  courierTracking?: string;
  panType?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccount {
  id: string;
  name: string;
  mobile: string;
  email: string;
  passwordHash: string; // Simulated secure hash
  createdAt: string;
  status: 'Active' | 'Blocked';
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string;
  adminReply?: string;
  repliedAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string; // 'all' or specific user ID
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
  createdAt: string;
  actionScreen?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  targetAppId?: string;
  details: string;
}

export interface FeeSettings {
  baseFee: number;
  serviceFee: number;
  taxFee: number;
  totalFee: number;
  updatedAt: string;
}

/* ============================================================
   LOCAL REPOSITORY WITH SEED DATA & REALTIME SYNC
   ============================================================ */

const STORAGE_KEYS = {
  APPLICATIONS: 'pan_app_applications_v1',
  USERS: 'pan_app_users_v1',
  TICKETS: 'pan_app_tickets_v1',
  NOTIFICATIONS: 'pan_app_notifications_v1',
  AUDIT: 'pan_app_audit_v1',
  FEE_SETTINGS: 'pan_app_fee_settings_v1',
  CURRENT_USER: 'pan_app_current_user_v1',
  ADMIN_AUTH: 'pan_app_admin_auth_v1',
};

// High fidelity sample preview document images (SVG Data URIs)
export const SAMPLE_DOCS = {
  aadhaar: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380" style="background:%23ffffff;font-family:sans-serif;"><rect x="10" y="10" width="580" height="360" rx="16" fill="%23ffffff" stroke="%23f97316" stroke-width="4"/><rect x="10" y="10" width="580" height="60" rx="16" fill="%23f97316"/><text x="300" y="48" fill="%23ffffff" font-size="20" font-weight="bold" text-anchor="middle">GOVERNMENT OF INDIA - UNIQUE IDENTIFICATION AUTHORITY</text><rect x="40" y="90" width="100" height="120" rx="8" fill="%23e2e8f0" stroke="%23cbd5e1"/><text x="90" y="155" fill="%23475569" font-size="14" text-anchor="middle">PHOTO</text><text x="160" y="115" fill="%230f172a" font-size="16" font-weight="bold">Ramesh Kumar</text><text x="160" y="140" fill="%23475569" font-size="13">DOB: 15/08/1995</text><text x="160" y="165" fill="%23475569" font-size="13">Gender: Male / PUM</text><text x="160" y="195" fill="%230f172a" font-size="18" font-family="monospace" font-weight="bold">XXXX XXXX 9012</text><rect x="10" y="320" width="580" height="50" rx="16" fill="%2315803d"/><text x="300" y="352" fill="%23ffffff" font-size="15" font-weight="bold" text-anchor="middle">Mera Aadhaar, Meri Pehchan (Sample Proof)</text></svg>`,
  photo: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="350" viewBox="0 0 300 350" style="background:%23f8fafc;font-family:sans-serif;"><rect width="300" height="350" fill="%23e0e7ff"/><circle cx="150" cy="120" r="60" fill="%236366f1"/><path d="M60 300 C60 210, 240 210, 240 300 Z" fill="%234338ca"/><circle cx="150" cy="115" r="45" fill="%23fed7aa"/><text x="150" y="335" font-size="14" font-weight="bold" fill="%23312e81" text-anchor="middle">APPLICANT PHOTOGRAPH</text></svg>`,
  signature: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="150" viewBox="0 0 400 150" style="background:%23ffffff;font-family:sans-serif;"><rect width="400" height="150" fill="%23ffffff" stroke="%23e2e8f0"/><path d="M 40 80 Q 90 20, 130 90 T 200 70 T 260 95 Q 310 40, 360 85" fill="none" stroke="%230f172a" stroke-width="4" stroke-linecap="round"/><text x="200" y="135" font-size="12" fill="%2394a3b8" text-anchor="middle">Verified Specimen Signature</text></svg>`,
};

// Seed initial applications so Admin & User have a rich, interactive experience out-of-the-box
const INITIAL_APPLICATIONS: PANApplication[] = [
  {
    id: 'PAN-2026-1001',
    userId: 'user-001',
    category: 'Individual',
    applicant: {
      title: 'Shri',
      firstName: 'Ramesh',
      middleName: 'Chandra',
      lastName: 'Kumar',
      panCardName: 'RAMESH CHANDRA KUMAR',
      dob: '1995-08-15',
      gender: 'Male',
      fatherName: 'Suresh Kumar',
      motherName: 'Sunita Devi',
      parentPreference: 'Father',
      aadhaarNumber: '987654329012',
      nameAsPerAadhaar: 'Ramesh Kumar',
    },
    contact: {
      mobile: '9876543210',
      email: 'ramesh.kumar@example.com',
    },
    address: {
      flat: 'Flat No. 402, Shivam Enclave',
      premises: 'Sector 14',
      street: 'Main Market Road',
      locality: 'Rohini',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110085',
      country: 'India',
      sameAsPerm: true,
    },
    documents: {
      poi: {
        id: 'doc-poi-1',
        name: 'Aadhaar Card',
        type: 'identity_proof',
        subType: 'Aadhaar Card issued by UIDAI',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'aadhaar_card_ramesh.pdf',
        fileSize: '412 KB',
        uploadedAt: '2026-09-27 10:30 AM',
        status: 'Under Review',
      },
      poa: {
        id: 'doc-poa-1',
        name: 'Aadhaar Card',
        type: 'address_proof',
        subType: 'Aadhaar Card issued by UIDAI',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'address_proof_aadhaar.pdf',
        fileSize: '412 KB',
        uploadedAt: '2026-09-27 10:30 AM',
        status: 'Under Review',
      },
      dob: {
        id: 'doc-dob-1',
        name: 'Aadhaar Card',
        type: 'dob_proof',
        subType: 'Aadhaar Card issued by UIDAI',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'dob_proof.pdf',
        fileSize: '412 KB',
        uploadedAt: '2026-09-27 10:30 AM',
        status: 'Under Review',
      },
      photo: {
        id: 'doc-photo-1',
        name: 'Applicant Photograph',
        type: 'photo',
        url: SAMPLE_DOCS.photo,
        fileName: 'applicant_passport_photo.jpg',
        fileSize: '95 KB',
        uploadedAt: '2026-09-27 10:32 AM',
        status: 'Under Review',
      },
      signature: {
        id: 'doc-sig-1',
        name: 'Applicant Signature',
        type: 'signature',
        url: SAMPLE_DOCS.signature,
        fileName: 'applicant_signature.png',
        fileSize: '54 KB',
        uploadedAt: '2026-09-27 10:33 AM',
        status: 'Under Review',
      },
    },
    payment: {
      amount: 157,
      baseFee: 107,
      serviceFee: 50,
      taxes: 0,
      status: 'Successful',
      method: 'upi',
      transactionId: 'TXN-98234821',
      gatewayRef: 'UPI-REF-88492019',
      paidAt: '2026-09-27 10:35 AM',
    },
    status: 'Under Review',
    statusHistory: [
      {
        status: 'Draft',
        timestamp: '2026-09-27 10:15 AM',
        note: 'Application draft created by user',
        updatedBy: 'Ramesh Kumar (User)',
      },
      {
        status: 'Payment Confirmed',
        timestamp: '2026-09-27 10:35 AM',
        note: 'Payment of ₹157 received successfully via UPI',
        updatedBy: 'System / Gateway',
      },
      {
        status: 'Under Review',
        timestamp: '2026-09-27 10:36 AM',
        note: 'Application submitted into facilitation queue for document inspection',
        updatedBy: 'System',
      },
    ],
    provider: {
      name: 'Sandbox / Demo Simulation',
      status: 'Sandbox Mode',
      submissionDate: '2026-09-27 10:36 AM',
      responseDetails: 'Demo Mode — Not yet connected to live Income Tax provider.',
    },
    internalNotes: [
      {
        id: 'note-1',
        admin: 'admin@digitalportal.in',
        text: 'Aadhaar identity and address details match the UIDAI card preview.',
        timestamp: '2026-09-27 10:45 AM',
      },
    ],
    createdAt: '2026-09-27 10:36 AM',
    updatedAt: '2026-09-27 10:36 AM',
  },
  {
    id: 'PAN-2026-1002',
    userId: 'user-002',
    category: 'Individual',
    applicant: {
      title: 'Smt',
      firstName: 'Pooja',
      middleName: '',
      lastName: 'Sharma',
      panCardName: 'POOJA SHARMA',
      dob: '1998-04-12',
      gender: 'Female',
      fatherName: 'Rajendra Sharma',
      parentPreference: 'Father',
      aadhaarNumber: '887766554433',
      nameAsPerAadhaar: 'Pooja Sharma',
    },
    contact: {
      mobile: '9812345678',
      email: 'pooja.sharma@example.com',
    },
    address: {
      flat: 'House 12, Gali No. 4',
      street: 'Gandhi Nagar',
      locality: 'Civil Lines',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302006',
      country: 'India',
      sameAsPerm: true,
    },
    documents: {
      poi: {
        id: 'doc-poi-2',
        name: 'Voter ID',
        type: 'identity_proof',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'voter_id_pooja.pdf',
        fileSize: '320 KB',
        uploadedAt: '2026-09-26 03:10 PM',
        status: 'Verified',
        verifiedAt: '2026-09-26 04:00 PM',
      },
      poa: {
        id: 'doc-poa-2',
        name: 'Electricity Bill',
        type: 'address_proof',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'electricity_bill.pdf',
        fileSize: '290 KB',
        uploadedAt: '2026-09-26 03:10 PM',
        status: 'Verified',
        verifiedAt: '2026-09-26 04:00 PM',
      },
      dob: {
        id: 'doc-dob-2',
        name: 'Birth Certificate',
        type: 'dob_proof',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'birth_cert.pdf',
        fileSize: '410 KB',
        uploadedAt: '2026-09-26 03:10 PM',
        status: 'Verified',
        verifiedAt: '2026-09-26 04:00 PM',
      },
      photo: {
        id: 'doc-photo-2',
        name: 'Photograph',
        type: 'photo',
        url: SAMPLE_DOCS.photo,
        fileName: 'pooja_photo.jpg',
        fileSize: '88 KB',
        uploadedAt: '2026-09-26 03:12 PM',
        status: 'Verified',
        verifiedAt: '2026-09-26 04:00 PM',
      },
      signature: {
        id: 'doc-sig-2',
        name: 'Signature',
        type: 'signature',
        url: SAMPLE_DOCS.signature,
        fileName: 'pooja_sig.png',
        fileSize: '46 KB',
        uploadedAt: '2026-09-26 03:12 PM',
        status: 'Verified',
        verifiedAt: '2026-09-26 04:00 PM',
      },
    },
    payment: {
      amount: 157,
      baseFee: 107,
      serviceFee: 50,
      taxes: 0,
      status: 'Successful',
      method: 'card',
      transactionId: 'TXN-77382910',
      paidAt: '2026-09-26 03:15 PM',
    },
    status: 'Documents Approved',
    statusHistory: [
      {
        status: 'Under Review',
        timestamp: '2026-09-26 03:15 PM',
        note: 'Application submitted',
        updatedBy: 'System',
      },
      {
        status: 'Documents Approved',
        timestamp: '2026-09-26 04:00 PM',
        note: 'All 5 identity and address documents verified by Senior Document Officer',
        updatedBy: 'Admin (Staff)',
      },
    ],
    provider: {
      name: 'Sandbox / Demo Simulation',
      status: 'Queued',
      submissionDate: '2026-09-26 04:05 PM',
    },
    createdAt: '2026-09-26 03:15 PM',
    updatedAt: '2026-09-26 04:00 PM',
  },
  {
    id: 'PAN-2026-1003',
    userId: 'user-003',
    category: 'Individual',
    applicant: {
      title: 'Kumari',
      firstName: 'Anita',
      lastName: 'Verma',
      panCardName: 'ANITA VERMA',
      dob: '2001-11-20',
      gender: 'Female',
      fatherName: 'Mahesh Verma',
      parentPreference: 'Father',
      aadhaarNumber: '776655443322',
      nameAsPerAadhaar: 'Anita Verma',
    },
    contact: {
      mobile: '9845012345',
      email: 'anita.verma@example.com',
    },
    address: {
      flat: 'Plot 45',
      street: 'Indira Nagar',
      locality: 'Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      country: 'India',
      sameAsPerm: true,
    },
    documents: {
      poi: {
        id: 'doc-poi-3',
        name: 'Aadhaar Card',
        type: 'identity_proof',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'blurred_aadhaar.jpg',
        fileSize: '150 KB',
        uploadedAt: '2026-09-25 11:20 AM',
        status: 'Rejected',
        rejectionReason: 'Document is blurred and Aadhaar number digits are not legible. Please upload a clear photo or PDF.',
        rejectedAt: '2026-09-25 01:15 PM',
      },
      poa: {
        id: 'doc-poa-3',
        name: 'Bank Statement',
        type: 'address_proof',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'bank_stmt.pdf',
        fileSize: '310 KB',
        uploadedAt: '2026-09-25 11:20 AM',
        status: 'Verified',
      },
      dob: {
        id: 'doc-dob-3',
        name: '10th Marksheet',
        type: 'dob_proof',
        url: SAMPLE_DOCS.aadhaar,
        fileName: 'marksheet.pdf',
        fileSize: '290 KB',
        uploadedAt: '2026-09-25 11:20 AM',
        status: 'Verified',
      },
      photo: {
        id: 'doc-photo-3',
        name: 'Photograph',
        type: 'photo',
        url: SAMPLE_DOCS.photo,
        fileName: 'photo.jpg',
        fileSize: '92 KB',
        uploadedAt: '2026-09-25 11:20 AM',
        status: 'Verified',
      },
      signature: {
        id: 'doc-sig-3',
        name: 'Signature',
        type: 'signature',
        url: SAMPLE_DOCS.signature,
        fileName: 'sig.png',
        fileSize: '51 KB',
        uploadedAt: '2026-09-25 11:20 AM',
        status: 'Verified',
      },
    },
    payment: {
      amount: 157,
      baseFee: 107,
      serviceFee: 50,
      taxes: 0,
      status: 'Successful',
      method: 'upi',
      transactionId: 'TXN-44910283',
      paidAt: '2026-09-25 11:22 AM',
    },
    status: 'Action Required',
    statusHistory: [
      {
        status: 'Under Review',
        timestamp: '2026-09-25 11:25 AM',
        note: 'Submitted',
        updatedBy: 'System',
      },
      {
        status: 'Action Required',
        timestamp: '2026-09-25 01:15 PM',
        note: 'Proof of Identity rejected: Document is blurred and Aadhaar number digits are not legible. Re-upload requested.',
        updatedBy: 'Admin (Officer 02)',
      },
    ],
    provider: {
      name: 'Sandbox / Demo Simulation',
      status: 'Sandbox Mode',
    },
    createdAt: '2026-09-25 11:25 AM',
    updatedAt: '2026-09-25 01:15 PM',
  },
];

const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user-001',
    name: 'Ramesh Kumar',
    mobile: '9876543210',
    email: 'ramesh.kumar@example.com',
    passwordHash: 'User@123',
    createdAt: '2026-09-20',
    status: 'Active',
  },
  {
    id: 'user-002',
    name: 'Pooja Sharma',
    mobile: '9812345678',
    email: 'pooja.sharma@example.com',
    passwordHash: 'User@123',
    createdAt: '2026-09-22',
    status: 'Active',
  },
  {
    id: 'user-003',
    name: 'Anita Verma',
    mobile: '9845012345',
    email: 'anita.verma@example.com',
    passwordHash: 'User@123',
    createdAt: '2026-09-23',
    status: 'Active',
  },
];

const INITIAL_FEE: FeeSettings = {
  baseFee: 107,
  serviceFee: 50,
  taxFee: 0,
  totalFee: 157, // Default is strictly ₹157
  updatedAt: '2026-09-28',
};

const INITIAL_AUDIT: AuditLogItem[] = [
  {
    id: 'audit-1',
    timestamp: '2026-09-28 09:30 AM',
    admin: 'admin@digitalportal.in',
    action: 'System Initialization',
    details: 'PAN Facilitation portal booted with Firebase configuration.',
  },
  {
    id: 'audit-2',
    timestamp: '2026-09-27 10:45 AM',
    admin: 'admin@digitalportal.in',
    action: 'Document Inspected',
    targetAppId: 'PAN-2026-1001',
    details: 'Viewed Aadhaar POI document for applicant Ramesh Kumar.',
  },
  {
    id: 'audit-3',
    timestamp: '2026-09-25 01:15 PM',
    admin: 'admin@digitalportal.in',
    action: 'Document Rejected',
    targetAppId: 'PAN-2026-1003',
    details: 'Marked POI as Rejected. Reason: Blurred copy. Re-upload request dispatched.',
  },
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    userId: 'user-001',
    title: 'Payment Received',
    message: 'Your PAN application fee of ₹157 was received successfully (TXN-98234821).',
    type: 'success',
    read: false,
    createdAt: '2026-09-27 10:35 AM',
    actionScreen: 'screen-applications',
  },
  {
    id: 'notif-2',
    userId: 'user-001',
    title: 'Documents Under Review',
    message: 'Your uploaded identity proofs are currently being verified by an authorized officer.',
    type: 'info',
    read: false,
    createdAt: '2026-09-27 10:36 AM',
    actionScreen: 'screen-track',
  },
  {
    id: 'notif-3',
    userId: 'user-003',
    title: 'Action Required: Re-upload Proof',
    message: 'Your Identity Proof was rejected (Blurred image). Tap to upload a clearer copy now.',
    type: 'alert',
    read: false,
    createdAt: '2026-09-25 01:15 PM',
    actionScreen: 'screen-documents',
  },
];

/* ============================================================
   DATA ACCESS LAYER (DUAL SYNC: FIREBASE + LOCAL REPOSITORY)
   ============================================================ */

export function sanitizeApplication(raw: any, fallbackId?: string): PANApplication {
  if (!raw || typeof raw !== 'object') {
    raw = {};
  }
  const id = raw.id || fallbackId || `PAN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const applicant = raw.applicant && typeof raw.applicant === 'object' ? raw.applicant : {};
  const contact = raw.contact && typeof raw.contact === 'object' ? raw.contact : {};
  const address = raw.address && typeof raw.address === 'object' ? raw.address : {};
  const documents = raw.documents && typeof raw.documents === 'object' ? raw.documents : {};
  const payment = raw.payment && typeof raw.payment === 'object' ? raw.payment : {};

  return {
    id,
    userId: raw.userId || 'user-001',
    category: raw.category || 'Individual',
    applicant: {
      title: applicant.title || 'Shri',
      firstName: applicant.firstName || 'Applicant',
      middleName: applicant.middleName || '',
      lastName: applicant.lastName || '',
      panCardName: applicant.panCardName || `${applicant.firstName || 'APPLICANT'} ${applicant.lastName || ''}`.trim(),
      dob: applicant.dob || '1995-01-01',
      gender: applicant.gender || 'Male',
      fatherName: applicant.fatherName || 'Father',
      motherName: applicant.motherName || '',
      parentPreference: applicant.parentPreference || 'Father',
      aadhaarNumber: applicant.aadhaarNumber || '987654329012',
      nameAsPerAadhaar: applicant.nameAsPerAadhaar || `${applicant.firstName || 'Applicant'} ${applicant.lastName || ''}`.trim(),
    },
    contact: {
      mobile: contact.mobile || '9876543210',
      email: contact.email || 'applicant@example.com',
    },
    address: {
      flat: address.flat || 'Flat No. 101',
      premises: address.premises || '',
      street: address.street || 'Station Road',
      locality: address.locality || 'Civil Lines',
      city: address.city || 'Delhi',
      state: address.state || 'Delhi',
      pincode: address.pincode || '110001',
      country: address.country || 'India',
      sameAsPerm: address.sameAsPerm !== false,
    },
    documents: {
      poi: documents.poi || { id: 'd-poi', name: 'Identity Proof', type: 'identity_proof', url: SAMPLE_DOCS.aadhaar, fileName: 'aadhaar.pdf', fileSize: '350 KB', uploadedAt: '', status: 'Under Review' },
      poa: documents.poa || { id: 'd-poa', name: 'Address Proof', type: 'address_proof', url: SAMPLE_DOCS.aadhaar, fileName: 'address.pdf', fileSize: '320 KB', uploadedAt: '', status: 'Under Review' },
      dob: documents.dob || { id: 'd-dob', name: 'DOB Proof', type: 'dob_proof', url: SAMPLE_DOCS.aadhaar, fileName: 'dob.pdf', fileSize: '300 KB', uploadedAt: '', status: 'Under Review' },
      photo: documents.photo || { id: 'd-photo', name: 'Photograph', type: 'photo', url: SAMPLE_DOCS.photo, fileName: 'photo.jpg', fileSize: '85 KB', uploadedAt: '', status: 'Under Review' },
      signature: documents.signature || { id: 'd-sig', name: 'Signature', type: 'signature', url: SAMPLE_DOCS.signature, fileName: 'signature.png', fileSize: '45 KB', uploadedAt: '', status: 'Under Review' },
    },
    payment: {
      amount: typeof payment.amount === 'number' ? payment.amount : 157,
      baseFee: typeof payment.baseFee === 'number' ? payment.baseFee : 107,
      serviceFee: typeof payment.serviceFee === 'number' ? payment.serviceFee : 50,
      taxes: typeof payment.taxes === 'number' ? payment.taxes : 0,
      status: payment.status || 'Successful',
      method: payment.method || 'upi',
      transactionId: payment.transactionId || `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
      gatewayRef: payment.gatewayRef || '',
      paidAt: payment.paidAt || '',
    },
    status: raw.status || 'Under Review',
    statusHistory: Array.isArray(raw.statusHistory) && raw.statusHistory.length > 0 ? raw.statusHistory : [
      { status: raw.status || 'Under Review', timestamp: raw.createdAt || new Date().toLocaleString(), note: 'Application loaded', updatedBy: 'System' }
    ],
    provider: raw.provider && typeof raw.provider === 'object' ? raw.provider : {
      name: 'Sandbox / Demo Simulation',
      status: 'Sandbox Mode',
    },
    internalNotes: Array.isArray(raw.internalNotes) ? raw.internalNotes : [],
    panNumber: raw.panNumber || undefined,
    courierTracking: raw.courierTracking || undefined,
    panType: raw.panType || 'Physical PAN Card + e-PAN Card',
    source: raw.source || 'Web / Mobile Portal',
    createdAt: raw.createdAt || new Date().toLocaleString(),
    updatedAt: raw.updatedAt || new Date().toLocaleString(),
  };
}

class DataRepository {
  private applications: PANApplication[] = [];
  private users: UserAccount[] = [];
  private tickets: SupportTicket[] = [];
  private notifications: AppNotification[] = [];
  private auditLogs: AuditLogItem[] = [];
  private feeSettings: FeeSettings = INITIAL_FEE;
  private currentUser: UserAccount | null = null;
  private isAdminLoggedIn = false;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Load from localStorage if present
    const rawApps = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    if (rawApps) {
      try {
        const parsed = JSON.parse(rawApps);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.applications = parsed.map(p => sanitizeApplication(p));
        } else {
          this.applications = INITIAL_APPLICATIONS.map(p => sanitizeApplication(p));
        }
      } catch {
        this.applications = INITIAL_APPLICATIONS.map(p => sanitizeApplication(p));
      }
    } else {
      this.applications = INITIAL_APPLICATIONS.map(p => sanitizeApplication(p));
      this.saveApplications();
    }

    const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (rawUsers) {
      try { this.users = JSON.parse(rawUsers); } catch { this.users = INITIAL_USERS; }
    } else {
      this.users = INITIAL_USERS;
      this.saveUsers();
    }

    const rawTickets = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (rawTickets) {
      try { this.tickets = JSON.parse(rawTickets); } catch { this.tickets = []; }
    } else {
      this.tickets = [];
    }

    const rawNotifs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (rawNotifs) {
      try { this.notifications = JSON.parse(rawNotifs); } catch { this.notifications = INITIAL_NOTIFICATIONS; }
    } else {
      this.notifications = INITIAL_NOTIFICATIONS;
      this.saveNotifications();
    }

    const rawAudit = localStorage.getItem(STORAGE_KEYS.AUDIT);
    if (rawAudit) {
      try { this.auditLogs = JSON.parse(rawAudit); } catch { this.auditLogs = INITIAL_AUDIT; }
    } else {
      this.auditLogs = INITIAL_AUDIT;
      this.saveAudit();
    }

    const rawFee = localStorage.getItem(STORAGE_KEYS.FEE_SETTINGS);
    if (rawFee) {
      try { this.feeSettings = JSON.parse(rawFee); } catch { this.feeSettings = INITIAL_FEE; }
    } else {
      this.feeSettings = INITIAL_FEE;
      this.saveFeeSettings();
    }

    const rawCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (rawCurrentUser) {
      try { this.currentUser = JSON.parse(rawCurrentUser); } catch { this.currentUser = null; }
    } else {
      // Set default demo user logged in for effortless testing
      this.currentUser = this.users[0];
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
    }

    this.isAdminLoggedIn = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';

    // 2. Attempt background sync with Firebase RTDB
    this.syncFromFirebase();
  }

  // Sync with Firebase RTDB
  private async syncFromFirebase() {
    if (!db) return;
    try {
      const dbRef = ref(db);
      const snapshot = await get(child(dbRef, 'applications'));
      if (snapshot.exists()) {
        const remoteApps = snapshot.val();
        if (remoteApps && typeof remoteApps === 'object') {
          const appList: PANApplication[] = [];
          for (const [key, val] of Object.entries(remoteApps)) {
            if (val && typeof val === 'object') {
              appList.push(sanitizeApplication(val, key));
            }
          }
          if (appList.length > 0) {
            this.applications = appList;
            this.saveApplications();
            console.log('[Firebase RTDB] Synced applications successfully.');
          }
        }
      } else {
        // Push initial applications to Firebase RTDB
        await this.syncToFirebase('applications', this.applications);
      }
    } catch (e) {
      console.warn('[Firebase RTDB] Remote sync not available (or restricted rules); local active store working flawlessly.', e);
    }
  }

  private async syncToFirebase(path: string, data: any) {
    if (!db) return;
    try {
      const targetRef = ref(db, path);
      await set(targetRef, data);
    } catch (e) {
      // Silent catch so UI never breaks
    }
  }

  // Applications
  public getApplications(): PANApplication[] {
    return this.applications.map(a => sanitizeApplication(a));
  }

  public getApplicationById(id: string): PANApplication | undefined {
    const found = this.applications.find(a => a && a.id && a.id.toLowerCase() === id.toLowerCase());
    return found ? sanitizeApplication(found) : undefined;
  }

  public getUserApplications(userId: string): PANApplication[] {
    return this.applications
      .filter(a => a && a.userId === userId)
      .map(a => sanitizeApplication(a));
  }

  public saveNewApplication(appInput: PANApplication): void {
    const app = sanitizeApplication(appInput);
    const existingIndex = this.applications.findIndex(a => a && a.id === app.id);
    if (existingIndex >= 0) {
      this.applications[existingIndex] = app;
    } else {
      this.applications.unshift(app);
    }
    this.saveApplications();
    this.syncToFirebase(`applications/${app.id}`, app);

    const fName = app.applicant?.firstName || 'Applicant';
    const lName = app.applicant?.lastName || '';
    const amt = app.payment?.amount ?? 157;
    this.logAudit(
      'Application Created',
      `New application submitted for ${fName} ${lName} (Fee: ₹${amt})`,
      app.id
    );
  }

  public updateApplication(appInput: PANApplication, adminActor = 'Admin'): void {
    const app = sanitizeApplication(appInput);
    const idx = this.applications.findIndex(a => a && a.id === app.id);
    if (idx >= 0) {
      this.applications[idx] = { ...app, updatedAt: new Date().toLocaleString() };
      this.saveApplications();
      this.syncToFirebase(`applications/${app.id}`, this.applications[idx]);
    }
  }

  public updateApplicationStatus(appId: string, newStatus: PANApplication['status'], note: string, adminActor = 'Admin'): void {
    const app = this.getApplicationById(appId);
    if (app) {
      app.status = newStatus;
      app.updatedAt = new Date().toLocaleString();
      app.statusHistory.unshift({
        status: newStatus,
        timestamp: new Date().toLocaleString(),
        note: note || `Status updated to ${newStatus}`,
        updatedBy: adminActor,
      });

      this.updateApplication(app, adminActor);

      // Notify the user
      this.addNotification({
        id: `notif-${Date.now()}`,
        userId: app.userId,
        title: `Application Status: ${newStatus}`,
        message: note || `Your PAN Application ${app.id} status was changed to ${newStatus}.`,
        type: newStatus === 'Action Required' ? 'alert' : newStatus === 'Completed' ? 'success' : 'info',
        read: false,
        createdAt: new Date().toLocaleString(),
        actionScreen: newStatus === 'Action Required' ? 'screen-documents' : 'screen-track',
      });

      this.logAudit('Status Changed', `Status updated to ${newStatus}. Note: ${note}`, appId);
    }
  }

  public updateDocumentStatus(
    appId: string,
    docKey: keyof PANApplication['documents'],
    status: DocumentItem['status'],
    reason = '',
    adminActor = 'Admin'
  ): void {
    const app = this.getApplicationById(appId);
    if (app && app.documents[docKey]) {
      const doc = app.documents[docKey];
      doc.status = status;
      if (status === 'Verified') {
        doc.verifiedAt = new Date().toLocaleString();
        delete doc.rejectionReason;
      } else if (status === 'Rejected') {
        doc.rejectedAt = new Date().toLocaleString();
        doc.rejectionReason = reason || 'Document was rejected by verification officer.';
        app.status = 'Action Required'; // Escalate application status so user is notified
      }

      this.updateApplication(app, adminActor);

      this.logAudit(
        status === 'Verified' ? 'Document Verified' : 'Document Rejected',
        `${doc.name} (${docKey}) marked as ${status}${reason ? `. Reason: ${reason}` : ''}`,
        appId
      );

      if (status === 'Rejected') {
        this.addNotification({
          id: `notif-${Date.now()}`,
          userId: app.userId,
          title: `Document Rejected: ${doc.name}`,
          message: `Your uploaded ${doc.name} was rejected: "${reason}". Please tap here to re-upload.`,
          type: 'alert',
          read: false,
          createdAt: new Date().toLocaleString(),
          actionScreen: 'screen-documents',
        });
      }
    }
  }

  public reuploadDocument(
    appId: string,
    docKey: keyof PANApplication['documents'],
    fileUrl: string,
    fileName: string,
    fileSize: string
  ): void {
    const app = this.getApplicationById(appId);
    if (app && app.documents[docKey]) {
      const doc = app.documents[docKey];
      doc.url = fileUrl;
      doc.fileName = fileName;
      doc.fileSize = fileSize;
      doc.uploadedAt = new Date().toLocaleString();
      doc.status = 'Under Review';
      delete doc.rejectionReason;
      delete doc.rejectedAt;

      // Check if any other doc is still rejected; if none, return app status to Under Review
      const remainingRejected = Object.values(app.documents).some(d => d.status === 'Rejected');
      if (!remainingRejected) {
        app.status = 'Under Review';
      }

      this.updateApplication(app, 'Applicant');
      this.logAudit('Document Re-uploaded', `New file uploaded for ${doc.name} (${fileName})`, appId);
    }
  }

  // Internal Notes
  public addInternalNote(appId: string, text: string, admin = 'admin@digitalportal.in'): void {
    const app = this.getApplicationById(appId);
    if (app) {
      if (!app.internalNotes) app.internalNotes = [];
      const noteItem = {
        id: `note-${Date.now()}`,
        admin,
        text,
        timestamp: new Date().toLocaleString(),
      };
      app.internalNotes.unshift(noteItem);
      this.updateApplication(app, admin);
      this.logAudit('Internal Note Added', `Added note: "${text.slice(0, 45)}..."`, appId, admin);
    }
  }

  // Provider Status
  public updateProviderStatus(appId: string, status: PANApplication['provider']['status'], refNo?: string, details?: string): void {
    const app = this.getApplicationById(appId);
    if (app) {
      app.provider.status = status;
      if (refNo) app.provider.acknowledgementNumber = refNo;
      if (details) app.provider.responseDetails = details;
      app.provider.submissionDate = new Date().toLocaleString();
      this.updateApplication(app, 'Admin');
      this.logAudit('Provider Status Updated', `Status changed to ${status}${refNo ? ` (Ref: ${refNo})` : ''}`, appId);
    }
  }

  // Assign PAN Number & Courier Tracking
  public assignPanDetails(appId: string, panNumber: string, courierTracking?: string, ackNumber?: string, adminActor = 'Admin (Officer)'): boolean {
    const app = this.getApplicationById(appId);
    if (!app) return false;
    app.panNumber = panNumber.trim().toUpperCase();
    if (courierTracking) app.courierTracking = courierTracking.trim().toUpperCase();
    if (ackNumber) app.provider.acknowledgementNumber = ackNumber.trim();
    app.status = 'Completed';
    app.provider.status = 'Allotted';
    app.updatedAt = new Date().toLocaleString();
    app.statusHistory.unshift({
      status: 'Completed',
      timestamp: new Date().toLocaleString(),
      note: `PAN Allotted: ${app.panNumber}${courierTracking ? `, Speed Post Tracking: ${courierTracking}` : ''}`,
      updatedBy: adminActor,
    });
    this.updateApplication(app, adminActor);
    this.logAudit('PAN Allotted', `Assigned PAN ${app.panNumber}, Consignment: ${courierTracking || 'N/A'}`, appId, adminActor);
    this.addNotification({
      id: `notif-${Date.now()}`,
      userId: app.userId,
      title: 'PAN Card Allotted & Dispatched!',
      message: `Congratulations! Your Permanent Account Number (${app.panNumber}) has been generated and dispatched by Speed Post.`,
      type: 'success',
      read: false,
      createdAt: new Date().toLocaleString(),
    });
    return true;
  }

  // Update Applicant, Contact, or Address Details (Admin Correction)
  public updateApplicantDetails(
    appId: string,
    applicantUpdates: Partial<PANApplication['applicant']>,
    contactUpdates?: Partial<PANApplication['contact']>,
    addressUpdates?: Partial<PANApplication['address']>,
    adminActor = 'Admin (Officer)'
  ): boolean {
    const app = this.getApplicationById(appId);
    if (!app) return false;
    if (applicantUpdates) {
      app.applicant = { ...app.applicant, ...applicantUpdates };
    }
    if (contactUpdates) {
      app.contact = { ...app.contact, ...contactUpdates };
    }
    if (addressUpdates) {
      app.address = { ...app.address, ...addressUpdates };
    }
    app.updatedAt = new Date().toLocaleString();
    app.statusHistory.unshift({
      status: app.status,
      timestamp: new Date().toLocaleString(),
      note: `Applicant details corrected by ${adminActor}`,
      updatedBy: adminActor,
    });
    this.updateApplication(app, adminActor);
    this.logAudit('Applicant Details Corrected', `Details updated for ${appId}`, appId, adminActor);
    return true;
  }

  // Update Payment Status & Txn ID
  public updatePaymentInfo(appId: string, status: PANApplication['payment']['status'], transactionId?: string, adminActor = 'Admin (Accounts)'): boolean {
    const app = this.getApplicationById(appId);
    if (!app) return false;
    app.payment.status = status;
    if (transactionId) app.payment.transactionId = transactionId.trim();
    app.updatedAt = new Date().toLocaleString();
    app.statusHistory.unshift({
      status: app.status,
      timestamp: new Date().toLocaleString(),
      note: `Payment status updated to ${status} (Txn: ${app.payment.transactionId})`,
      updatedBy: adminActor,
    });
    this.updateApplication(app, adminActor);
    this.logAudit('Payment Updated', `Payment marked ${status} for ${appId}`, appId, adminActor);
    return true;
  }

  // Users
  public getUsers(): UserAccount[] {
    return [...this.users];
  }

  public getUserById(id: string): UserAccount | undefined {
    return this.users.find(u => u.id === id);
  }

  public getUserByEmailOrMobile(identifier: string): UserAccount | undefined {
    const idf = identifier.trim().toLowerCase();
    return this.users.find(u => u.email.toLowerCase() === idf || u.mobile === idf);
  }

  public registerUser(name: string, mobile: string, email: string, password: string): UserAccount {
    const newUser: UserAccount = {
      id: `user-${Date.now().toString().slice(-5)}`,
      name,
      mobile,
      email,
      passwordHash: password, // For demo evaluation
      createdAt: new Date().toISOString().split('T')[0],
      status: 'Active',
    };
    this.users.push(newUser);
    this.saveUsers();
    this.currentUser = newUser;
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    this.syncToFirebase(`users/${newUser.id}`, newUser);
    return newUser;
  }

  public setCurrentUser(user: UserAccount | null): void {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  public getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  // Admin Auth
  public setAdminLoggedIn(val: boolean): void {
    this.isAdminLoggedIn = val;
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, val ? 'true' : 'false');
    if (val) {
      this.logAudit('Admin Login', 'Authorized admin signed into management console.');
    }
  }

  public isAdmin(): boolean {
    return this.isAdminLoggedIn;
  }

  // Fee Settings
  public getFeeSettings(): FeeSettings {
    return { ...this.feeSettings };
  }

  public updateFeeSettings(base: number, service: number, tax: number): FeeSettings {
    const total = base + service + tax;
    this.feeSettings = {
      baseFee: base,
      serviceFee: service,
      taxFee: tax,
      totalFee: total,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    this.saveFeeSettings();
    this.syncToFirebase('settings/fee', this.feeSettings);
    this.logAudit('Fee Settings Updated', `Configured total fee set to ₹${total} (Base: ₹${base}, Svc: ₹${service}, Tax: ₹${tax})`);
    return this.feeSettings;
  }

  // Notifications
  public getNotifications(userId?: string): AppNotification[] {
    if (!userId) return [...this.notifications];
    return this.notifications.filter(n => n.userId === 'all' || n.userId === userId);
  }

  public addNotification(notif: AppNotification): void {
    this.notifications.unshift(notif);
    this.saveNotifications();
  }

  public markNotificationsRead(userId: string): void {
    this.notifications.forEach(n => {
      if (n.userId === 'all' || n.userId === userId) {
        n.read = true;
      }
    });
    this.saveNotifications();
  }

  // Support Tickets
  public getTickets(userId?: string): SupportTicket[] {
    if (userId) {
      return this.tickets.filter(t => t.userId === userId);
    }
    return [...this.tickets];
  }

  public createTicket(userId: string, userName: string, subject: string, message: string): SupportTicket {
    const ticket: SupportTicket = {
      id: `TCK-${Date.now().toString().slice(-4)}`,
      userId,
      userName,
      subject,
      message,
      status: 'Open',
      createdAt: new Date().toLocaleString(),
    };
    this.tickets.unshift(ticket);
    this.saveTickets();
    return ticket;
  }

  public replyTicket(ticketId: string, reply: string): void {
    const t = this.tickets.find(item => item.id === ticketId);
    if (t) {
      t.adminReply = reply;
      t.status = 'Resolved';
      t.repliedAt = new Date().toLocaleString();
      this.saveTickets();
    }
  }

  // Audit Logs
  public getAuditLogs(): AuditLogItem[] {
    return [...this.auditLogs];
  }

  public logAudit(action: string, details: string, targetAppId?: string, admin = 'admin@digitalportal.in'): void {
    const entry: AuditLogItem = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      admin,
      action,
      targetAppId,
      details,
    };
    this.auditLogs.unshift(entry);
    this.saveAudit();
  }

  // Internal Persist Helpers
  private saveApplications() {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(this.applications));
  }

  private saveUsers() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
  }

  private saveTickets() {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(this.tickets));
  }

  private saveNotifications() {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.notifications));
  }

  private saveAudit() {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(this.auditLogs));
  }

  private saveFeeSettings() {
    localStorage.setItem(STORAGE_KEYS.FEE_SETTINGS, JSON.stringify(this.feeSettings));
  }
}

export const repo = new DataRepository();
