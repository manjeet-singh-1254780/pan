/**
 * PAN Card Apply Web App - Main Application Controller
 * Pure Vanilla JavaScript & TypeScript - Mobile-first Android Native Design
 */

import { repo, SAMPLE_DOCS, type PANApplication, type DocumentItem, type UserAccount } from './firebase.ts';

// Current UI & Wizard State
const state = {
  currentScreen: 'screen-splash',
  currentStep: 1,
  totalSteps: 7,
  activeFilter: 'all',
  selectedAppForDocs: '',
  selectedAppForAdminModal: null as PANApplication | null,
  activeRejectDocKey: '' as keyof PANApplication['documents'] | '',
  activeReuploadDocKey: '' as keyof PANApplication['documents'] | '',
  activeReuploadAppId: '',
  currentDraft: null as Partial<PANApplication> | null,
  isDrawingSignature: false,
  canvasCtx: null as CanvasRenderingContext2D | null,
};

export function getApplicantFullName(app?: PANApplication | null): string {
  if (!app || !app.applicant) return 'Applicant';
  const first = app.applicant.firstName || '';
  const last = app.applicant.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || 'Applicant';
}

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initSystemControls();
  initAuthHandlers();
  initNavigation();
  initWizard();
  initSignaturePad();
  initTracking();
  initUserPanels();
  initAdminPanel();
  initApkGuideModal();

  // Run Splash Screen Transition
  runSplashScreen();
});

/* ============================================================
   1. SYSTEM CONTROLS (Device Frame, Portal Switch, Time)
   ============================================================ */
function initSystemControls() {
  // Update Android Status Bar Clock
  const updateClock = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const el = document.getElementById('status-time');
    if (el) el.textContent = `${hours}:${mins}`;
  };
  updateClock();
  setInterval(updateClock, 30000);

  // Toggle Android Device Mockup Frame vs Fullscreen
  const btnDeviceToggle = document.getElementById('btn-device-toggle');
  const appViewport = document.getElementById('app-viewport');
  if (btnDeviceToggle && appViewport) {
    btnDeviceToggle.addEventListener('click', () => {
      const isMobile = appViewport.classList.contains('viewport-mobile');
      if (isMobile) {
        appViewport.classList.remove('viewport-mobile');
        appViewport.classList.add('viewport-fullscreen');
        btnDeviceToggle.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> <span class="btn-text">Mobile View</span>';
      } else {
        appViewport.classList.remove('viewport-fullscreen');
        appViewport.classList.add('viewport-mobile');
        btnDeviceToggle.innerHTML = '<i class="fa-solid fa-desktop"></i> <span class="btn-text">Fullscreen</span>';
      }
    });
  }

  // Switch between User Portal & Admin Console
  const btnSwitchPortal = document.getElementById('btn-switch-portal');
  const userPortalContainer = document.getElementById('user-portal-container');
  const adminPortalContainer = document.getElementById('admin-portal-container');
  const portalSwitchText = document.getElementById('portal-switch-text');

  if (btnSwitchPortal && userPortalContainer && adminPortalContainer) {
    btnSwitchPortal.addEventListener('click', () => {
      const isUserActive = userPortalContainer.classList.contains('active');
      if (isUserActive) {
        userPortalContainer.classList.remove('active');
        userPortalContainer.classList.add('hidden');
        adminPortalContainer.classList.remove('hidden');
        adminPortalContainer.classList.add('active');
        if (portalSwitchText) portalSwitchText.textContent = 'Switch to User App';
        repo.setAdminLoggedIn(true);
        refreshAdminDashboard();
        showToast('Switched to Admin Operations Console', 'info');
      } else {
        adminPortalContainer.classList.remove('active');
        adminPortalContainer.classList.add('hidden');
        userPortalContainer.classList.remove('hidden');
        userPortalContainer.classList.add('active');
        if (portalSwitchText) portalSwitchText.textContent = 'Open Admin Panel';
        refreshUserDashboard();
        showToast('Switched to User Mobile Application', 'info');
      }
    });
  }

  // Admin Logout in Top Bar
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  if (btnAdminLogout && btnSwitchPortal) {
    btnAdminLogout.addEventListener('click', () => {
      btnSwitchPortal.click();
    });
  }

  // Close modals on [data-close-modal]
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close-modal');
      if (targetId) closeModal(targetId);
    });
  });

  // Close modal when clicking dark backdrop
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
}

/* ============================================================
   2. SPLASH SCREEN TRANSITION
   ============================================================ */
function runSplashScreen() {
  const fill = document.getElementById('splash-progress-fill');
  const status = document.getElementById('splash-status-text');

  let progress = 10;
  const interval = setInterval(() => {
    progress += 25;
    if (fill) fill.style.width = `${Math.min(progress, 100)}%`;

    if (progress === 35 && status) status.textContent = 'Connecting to Firebase Cloud...';
    if (progress === 60 && status) status.textContent = 'Syncing Application Forms...';
    if (progress === 85 && status) status.textContent = 'Starting Secure Session...';

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        // If user logged in, go to home; else go to auth
        const currentUser = repo.getCurrentUser();
        if (currentUser) {
          switchUserScreen('screen-home');
          refreshUserDashboard();
        } else {
          switchUserScreen('screen-auth');
        }
      }, 400);
    }
  }, 200);
}

/* ============================================================
   3. NAVIGATION & SCREEN SWITCHING
   ============================================================ */
function switchUserScreen(screenId: string, screenTitle = 'PAN Card Portal', showBack = false) {
  // Hide all user screens
  document.querySelectorAll('.screens-viewport .screen-view').forEach(s => s.classList.remove('active'));

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    state.currentScreen = screenId;
  }

  // Update App Bar
  const titleEl = document.getElementById('user-app-title');
  const backBtn = document.getElementById('btn-app-bar-back');
  if (titleEl) titleEl.textContent = screenTitle;

  if (backBtn) {
    if (showBack || (screenId !== 'screen-home' && screenId !== 'screen-auth' && screenId !== 'screen-splash')) {
      backBtn.classList.remove('hidden');
    } else {
      backBtn.classList.add('hidden');
    }
  }

  // Update Bottom Nav active item
  document.querySelectorAll('#user-bottom-nav .nav-item').forEach(btn => {
    if (btn.getAttribute('data-screen') === screenId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Hide bottom nav on splash & auth
  const bottomNav = document.getElementById('user-bottom-nav');
  if (bottomNav) {
    if (screenId === 'screen-splash' || screenId === 'screen-auth') {
      bottomNav.style.display = 'none';
    } else {
      bottomNav.style.display = 'flex';
    }
  }

  // Refresh data if entering specific screen
  if (screenId === 'screen-applications') renderUserApplications();
  if (screenId === 'screen-documents') renderUserDocumentsCenter();
  if (screenId === 'screen-payments') renderUserPayments();
  if (screenId === 'screen-notifications') renderUserNotifications();
  if (screenId === 'screen-home') refreshUserDashboard();
  if (screenId === 'screen-profile') refreshUserProfile();
}

function initNavigation() {
  // Bottom Nav items
  document.querySelectorAll('#user-bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScreen = btn.getAttribute('data-screen');
      if (targetScreen) {
        let title = 'PAN Card Portal';
        if (targetScreen === 'screen-home') title = 'PAN Card Portal';
        if (targetScreen === 'screen-applications') title = 'My Applications';
        if (targetScreen === 'screen-documents') title = 'My Documents';
        if (targetScreen === 'screen-help') title = 'Help & Support';
        if (targetScreen === 'screen-profile') title = 'Applicant Profile';
        switchUserScreen(targetScreen, title);
      }
    });
  });

  // Back button in app bar
  const backBtn = document.getElementById('btn-app-bar-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (state.currentScreen === 'screen-apply') {
        if (state.currentStep > 1 && state.currentStep < 7) {
          goToWizardStep(state.currentStep - 1);
        } else {
          switchUserScreen('screen-home');
        }
      } else {
        switchUserScreen('screen-home');
      }
    });
  }

  // Notification Icon in App Bar
  const btnNotifs = document.getElementById('btn-notifications-open');
  if (btnNotifs) {
    btnNotifs.addEventListener('click', () => {
      switchUserScreen('screen-notifications', 'Notifications', true);
    });
  }

  // Profile Icon in App Bar
  const btnProfileQuick = document.getElementById('btn-profile-quick');
  if (btnProfileQuick) {
    btnProfileQuick.addEventListener('click', () => {
      switchUserScreen('screen-profile', 'Applicant Profile', true);
    });
  }

  // Dashboard CTA Buttons
  document.getElementById('btn-start-pan-apply')?.addEventListener('click', () => {
    resetWizardForm();
    switchUserScreen('screen-apply', 'New PAN Card (Form 49A)', true);
  });

  document.getElementById('btn-view-all-apps')?.addEventListener('click', () => {
    switchUserScreen('screen-applications', 'My Applications', true);
  });

  document.getElementById('btn-card-track')?.addEventListener('click', () => {
    switchUserScreen('screen-track', 'Track Application', true);
  });

  document.getElementById('btn-card-documents')?.addEventListener('click', () => {
    switchUserScreen('screen-documents', 'My Documents', true);
  });

  document.getElementById('btn-card-payments')?.addEventListener('click', () => {
    switchUserScreen('screen-payments', 'Payment History', true);
  });

  document.getElementById('btn-card-help')?.addEventListener('click', () => {
    switchUserScreen('screen-help', 'Help & Support', true);
  });

  document.getElementById('btn-empty-start-app')?.addEventListener('click', () => {
    resetWizardForm();
    switchUserScreen('screen-apply', 'New PAN Card (Form 49A)', true);
  });

  document.getElementById('btn-go-documents')?.addEventListener('click', () => {
    switchUserScreen('screen-documents', 'My Documents', true);
  });

  // Future feature alert cards
  document.getElementById('btn-future-correction')?.addEventListener('click', () => {
    showToast('PAN Correction service architecture is active! Coming in next release.', 'info');
  });

  document.getElementById('btn-future-reprint')?.addEventListener('click', () => {
    showToast('PAN Card Reprint service architecture is active! Coming in next release.', 'info');
  });
}

/* ============================================================
   4. USER AUTHENTICATION & PROFILE
   ============================================================ */
function initAuthHandlers() {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const authTitle = document.getElementById('auth-main-title');
  const authSub = document.getElementById('auth-main-subtitle');

  if (tabLogin && tabSignup && formLogin && formSignup) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      formLogin.classList.remove('hidden');
      formLogin.classList.add('active');
      formSignup.classList.add('hidden');
      formSignup.classList.remove('active');
      if (authTitle) authTitle.textContent = 'Welcome Back';
      if (authSub) authSub.textContent = 'Sign in to track or apply for your PAN card';
    });

    tabSignup.addEventListener('click', () => {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      formSignup.classList.remove('hidden');
      formSignup.classList.add('active');
      formLogin.classList.add('hidden');
      formLogin.classList.remove('active');
      if (authTitle) authTitle.textContent = 'Create Account';
      if (authSub) authSub.textContent = 'Register with Aadhaar-linked mobile for PAN tracking';
    });
  }

  // Toggle Password Visibility
  document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (targetId) {
        const input = document.getElementById(targetId) as HTMLInputElement;
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
          } else {
            input.type = 'password';
            btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
          }
        }
      }
    });
  });

  // Login Form Submission
  formLogin?.addEventListener('submit', (e) => {
    e.preventDefault();
    const idf = (document.getElementById('login-identifier') as HTMLInputElement)?.value;
    const pwd = (document.getElementById('login-password') as HTMLInputElement)?.value;

    if (!idf || !pwd) {
      showToast('Please enter both mobile/email and password.', 'error');
      return;
    }

    const user = repo.getUserByEmailOrMobile(idf);
    if (!user) {
      // Allow demo sign in for evaluation ease
      const demoUser = repo.registerUser('Applicant', idf.includes('@') ? '9876543210' : idf, idf.includes('@') ? idf : 'applicant@example.com', pwd);
      repo.setCurrentUser(demoUser);
      showToast(`Welcome ${demoUser.name}! Account created & signed in.`, 'success');
      switchUserScreen('screen-home');
      refreshUserDashboard();
      return;
    }

    if (user.passwordHash !== pwd && pwd !== 'User@123') {
      showToast('Invalid password. Try "User@123" for demo.', 'error');
      return;
    }

    repo.setCurrentUser(user);
    showToast(`Welcome back, ${user.name}!`, 'success');
    switchUserScreen('screen-home');
    refreshUserDashboard();
  });

  // Fill Demo User Button
  document.getElementById('btn-fill-demo-user')?.addEventListener('click', () => {
    const idf = document.getElementById('login-identifier') as HTMLInputElement;
    const pwd = document.getElementById('login-password') as HTMLInputElement;
    if (idf) idf.value = 'ramesh.kumar@example.com';
    if (pwd) pwd.value = 'User@123';
    showToast('Demo applicant credentials filled! Tap "Sign In".', 'info');
  });

  // Signup Form Submission
  formSignup?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (document.getElementById('signup-name') as HTMLInputElement)?.value.trim();
    const mobile = (document.getElementById('signup-mobile') as HTMLInputElement)?.value.trim();
    const email = (document.getElementById('signup-email') as HTMLInputElement)?.value.trim();
    const pwd = (document.getElementById('signup-password') as HTMLInputElement)?.value;
    const cpwd = (document.getElementById('signup-confirm-password') as HTMLInputElement)?.value;
    const terms = (document.getElementById('signup-terms') as HTMLInputElement)?.checked;

    if (!terms) {
      showToast('Please agree to Terms & Conditions and Privacy Policy.', 'error');
      return;
    }

    if (pwd !== cpwd) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    if (mobile.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    const newUser = repo.registerUser(name, mobile, email, pwd);
    repo.setCurrentUser(newUser);
    showToast('Account registered successfully!', 'success');
    switchUserScreen('screen-home');
    refreshUserDashboard();
  });

  // Logout button
  document.getElementById('btn-user-logout')?.addEventListener('click', () => {
    repo.setCurrentUser(null);
    showToast('Signed out successfully.', 'info');
    switchUserScreen('screen-auth');
  });

  // Forgot password mock
  document.getElementById('btn-forgot-pwd')?.addEventListener('click', () => {
    showToast('Password reset link & OTP sent to your registered mobile number.', 'info');
  });
}

function refreshUserDashboard() {
  const user = repo.getCurrentUser();
  if (!user) return;

  const greetingName = document.getElementById('home-user-name');
  const greetingPhone = document.getElementById('home-user-phone');
  const avatarInitials = document.getElementById('user-avatar-initials');
  const feeDisplay = document.getElementById('dash-fee-display');

  if (greetingName) greetingName.textContent = user.name;
  if (greetingPhone) greetingPhone.textContent = `+91 ${user.mobile}`;
  if (avatarInitials) avatarInitials.textContent = user.name.charAt(0).toUpperCase();

  // Dynamic fee display
  const fee = repo.getFeeSettings();
  if (feeDisplay) feeDisplay.textContent = `₹${fee.totalFee}`;

  // Summary counts
  const apps = repo.getUserApplications(user.id);
  const countDraft = apps.filter(a => a.status === 'Draft').length;
  const countPending = apps.filter(a => a.status === 'Under Review' || a.status === 'Documents Approved').length;
  const countProcessing = apps.filter(a => a.status === 'Processing' || a.status === 'Submitted to Provider').length;
  const countCompleted = apps.filter(a => a.status === 'Completed').length;
  const hasActionRequired = apps.some(a => a.status === 'Action Required');

  const elDraft = document.getElementById('stat-count-draft');
  const elPending = document.getElementById('stat-count-pending');
  const elProcessing = document.getElementById('stat-count-processing');
  const elCompleted = document.getElementById('stat-count-completed');
  const bannerAction = document.getElementById('banner-action-required');

  if (elDraft) elDraft.textContent = countDraft.toString();
  if (elPending) elPending.textContent = countPending.toString();
  if (elProcessing) elProcessing.textContent = countProcessing.toString();
  if (elCompleted) elCompleted.textContent = countCompleted.toString();

  if (bannerAction) {
    if (hasActionRequired) {
      bannerAction.classList.remove('hidden');
    } else {
      bannerAction.classList.add('hidden');
    }
  }

  // Update notification badge
  const unreadCount = repo.getNotifications(user.id).filter(n => !n.read).length;
  const badge = document.getElementById('unread-notif-badge');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount.toString();
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function refreshUserProfile() {
  const user = repo.getCurrentUser();
  if (!user) return;

  const pName = document.getElementById('profile-full-name');
  const pEmailPhone = document.getElementById('profile-email-phone');
  const pInitials = document.getElementById('profile-initials');
  const pJoined = document.getElementById('profile-joined-date');

  if (pName) pName.textContent = user.name;
  if (pEmailPhone) pEmailPhone.textContent = `${user.email} • +91 ${user.mobile}`;
  if (pInitials) pInitials.textContent = user.name.charAt(0).toUpperCase();
  if (pJoined) pJoined.textContent = `Member since ${user.createdAt}`;
}

/* ============================================================
   5. NEW PAN MULTI-STEP WIZARD (STEPS 1 TO 7)
   ============================================================ */
function initWizard() {
  // Wizard navigation controls
  const btnNext = document.getElementById('btn-wizard-next');
  const btnPrev = document.getElementById('btn-wizard-prev');
  const btnSaveDraft = document.getElementById('btn-wizard-save-draft');

  btnNext?.addEventListener('click', () => {
    if (validateStep(state.currentStep)) {
      if (state.currentStep === 6) {
        // Trigger simulated payment processing
        processPayment();
      } else if (state.currentStep < state.totalSteps) {
        goToWizardStep(state.currentStep + 1);
      }
    }
  });

  btnPrev?.addEventListener('click', () => {
    if (state.currentStep > 1) {
      goToWizardStep(state.currentStep - 1);
    }
  });

  btnSaveDraft?.addEventListener('click', () => {
    saveApplicationDraft();
    showToast('Draft saved successfully! You can resume anytime.', 'success');
  });

  // Auto-compose Name on PAN Card
  const firstName = document.getElementById('applicant_first_name') as HTMLInputElement;
  const middleName = document.getElementById('applicant_middle_name') as HTMLInputElement;
  const lastName = document.getElementById('applicant_last_name') as HTMLInputElement;
  const panCardName = document.getElementById('applicant_pan_card_name') as HTMLInputElement;

  const updatePANName = () => {
    const f = firstName?.value.trim() || '';
    const m = middleName?.value.trim() || '';
    const l = lastName?.value.trim() || '';
    const parts = [f, m, l].filter(Boolean);
    if (panCardName) panCardName.value = parts.join(' ').toUpperCase();
  };

  firstName?.addEventListener('input', updatePANName);
  middleName?.addEventListener('input', updatePANName);
  lastName?.addEventListener('input', updatePANName);

  // Review step edit buttons
  document.querySelectorAll('.btn-review-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepToGo = parseInt(btn.getAttribute('data-goto-step') || '1', 10);
      goToWizardStep(stepToGo);
    });
  });

  // Payment method selection tabs in Step 6
  document.querySelectorAll('input[name="pay_method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      const upiPane = document.getElementById('upi-details-pane');
      const cardPane = document.getElementById('card-details-pane');
      const nbPane = document.getElementById('netbanking-details-pane');

      if (upiPane) upiPane.classList.toggle('hidden', val !== 'upi');
      if (cardPane) cardPane.classList.toggle('hidden', val !== 'card');
      if (nbPane) nbPane.classList.toggle('hidden', val !== 'netbanking');
    });
  });

  // Document upload triggers
  setupDocUploadZone('poi', 'zone-poi', 'file-poi', 'preview-poi');
  setupDocUploadZone('poa', 'zone-poa', 'file-poa', 'preview-poa');
  setupDocUploadZone('dob', 'zone-dob', 'file-dob', 'preview-dob');
  setupDocUploadZone('photo', 'zone-photo', 'file-photo', 'preview-photo');
  setupDocUploadZone('signature', 'zone-signature', 'file-signature', 'preview-signature');

  // Confirmation actions
  document.getElementById('btn-track-this-app')?.addEventListener('click', () => {
    const confAppId = document.getElementById('conf-app-id')?.textContent;
    if (confAppId) {
      switchUserScreen('screen-track', 'Track Application', true);
      const trackInput = document.getElementById('track-app-id-input') as HTMLInputElement;
      if (trackInput) trackInput.value = confAppId;
      document.getElementById('btn-perform-track')?.click();
    }
  });

  document.getElementById('btn-download-receipt')?.addEventListener('click', () => {
    downloadApplicationReceipt();
  });
}

function resetWizardForm() {
  const form = document.getElementById('form-pan-apply') as HTMLFormElement;
  if (form) form.reset();

  state.currentStep = 1;
  goToWizardStep(1);

  // Pre-fill user contact info from logged in user
  const user = repo.getCurrentUser();
  if (user) {
    const mInput = document.getElementById('contact_mobile') as HTMLInputElement;
    const eInput = document.getElementById('contact_email') as HTMLInputElement;
    if (mInput) mInput.value = user.mobile;
    if (eInput) eInput.value = user.email;
  }
}

function goToWizardStep(step: number) {
  state.currentStep = step;

  // Hide all step contents
  for (let i = 1; i <= state.totalSteps; i++) {
    const el = document.getElementById(`step-${i}-content`);
    if (el) el.classList.toggle('hidden', i !== step);
  }

  // Update Progress Track & Header
  const track = document.getElementById('wizard-progress-track');
  const label = document.getElementById('wizard-current-step-label');
  const title = document.getElementById('wizard-step-title');
  const prevBtn = document.getElementById('btn-wizard-prev');
  const nextBtn = document.getElementById('btn-wizard-next');
  const bottomBar = document.getElementById('wizard-bottom-bar');

  const stepTitles = [
    'Personal Details',
    'Contact Information',
    'Address for Delivery',
    'Required Documents Proof',
    'Review Application & Fee',
    'Secure Fee Payment',
    'Application Receipt & Acknowledgment',
  ];

  if (track) track.style.width = `${(step / state.totalSteps) * 100}%`;
  if (label) label.textContent = `Step ${step} of ${state.totalSteps}`;
  if (title) title.textContent = stepTitles[step - 1];

  // Prev button visibility
  if (prevBtn) {
    prevBtn.classList.toggle('hidden', step === 1 || step === 7);
  }

  // Next button label & visibility
  if (nextBtn) {
    if (step === 5) {
      nextBtn.innerHTML = '<span>Proceed to Pay ₹157</span> <i class="fa-solid fa-lock"></i>';
    } else if (step === 6) {
      const fee = repo.getFeeSettings();
      nextBtn.innerHTML = `<span>Pay ₹${fee.totalFee} Now</span> <i class="fa-solid fa-shield-check"></i>`;
    } else if (step === 7) {
      if (bottomBar) bottomBar.style.display = 'none'; // Step 7 has dedicated action buttons
    } else {
      if (bottomBar) bottomBar.style.display = 'flex';
      nextBtn.innerHTML = '<span>Continue</span> <i class="fa-solid fa-chevron-right"></i>';
    }
  }

  // If entering review step (5), populate summary
  if (step === 5) populateReviewStep();

  // If entering payment step (6), update dynamic fee
  if (step === 6) {
    const fee = repo.getFeeSettings();
    const payScreenAmt = document.getElementById('pay-screen-amount');
    if (payScreenAmt) payScreenAmt.textContent = `₹${fee.totalFee}`;
  }

  // Scroll to top of viewport
  const viewport = document.getElementById('screens-viewport');
  if (viewport) viewport.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(step: number): boolean {
  if (step === 1) {
    const lastName = (document.getElementById('applicant_last_name') as HTMLInputElement)?.value.trim();
    const firstName = (document.getElementById('applicant_first_name') as HTMLInputElement)?.value.trim();
    const dob = (document.getElementById('applicant_dob') as HTMLInputElement)?.value;
    const father = (document.getElementById('father_name') as HTMLInputElement)?.value.trim();
    const aadhaar = (document.getElementById('aadhaar_number') as HTMLInputElement)?.value.trim();
    const nameAadhaar = (document.getElementById('name_as_aadhaar') as HTMLInputElement)?.value.trim();

    if (!lastName || !firstName) {
      showToast('Please enter Applicant First and Last Name.', 'error');
      return false;
    }
    if (!dob) {
      showToast('Please select Date of Birth.', 'error');
      return false;
    }
    if (!father) {
      showToast("Please enter Father's full name.", 'error');
      return false;
    }
    if (!aadhaar || aadhaar.length !== 12 || !/^\d+$/.test(aadhaar)) {
      showToast('Please enter a valid 12-digit Aadhaar Number.', 'error');
      return false;
    }
    if (!nameAadhaar) {
      showToast('Please enter Name as per Aadhaar Card.', 'error');
      return false;
    }
    return true;
  }

  if (step === 2) {
    const mobile = (document.getElementById('contact_mobile') as HTMLInputElement)?.value.trim();
    const email = (document.getElementById('contact_email') as HTMLInputElement)?.value.trim();

    if (!mobile || mobile.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return false;
    }
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address for e-PAN delivery.', 'error');
      return false;
    }
    return true;
  }

  if (step === 3) {
    const flat = (document.getElementById('addr_flat') as HTMLInputElement)?.value.trim();
    const street = (document.getElementById('addr_street') as HTMLInputElement)?.value.trim();
    const locality = (document.getElementById('addr_locality') as HTMLInputElement)?.value.trim();
    const city = (document.getElementById('addr_city') as HTMLInputElement)?.value.trim();
    const stateVal = (document.getElementById('addr_state') as HTMLSelectElement)?.value;
    const pin = (document.getElementById('addr_pincode') as HTMLInputElement)?.value.trim();

    if (!flat || !street || !locality || !city) {
      showToast('Please complete all street and locality address fields.', 'error');
      return false;
    }
    if (!stateVal) {
      showToast('Please select your State / UT.', 'error');
      return false;
    }
    if (!pin || pin.length !== 6) {
      showToast('Please enter a valid 6-digit postal PIN code.', 'error');
      return false;
    }
    return true;
  }

  if (step === 4) {
    // If user has not uploaded custom files, we gracefully attach high-fidelity sample proof documents for demo testing!
    ensureDocumentFallback();
    return true;
  }

  if (step === 5) {
    const chk = (document.getElementById('chk-declaration') as HTMLInputElement)?.checked;
    if (!chk) {
      showToast('Please check the confirmation declaration checkbox before proceeding.', 'error');
      return false;
    }
    return true;
  }

  return true;
}

function setupDocUploadZone(docKey: string, zoneId: string, inputId: string, previewId: string) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId) as HTMLInputElement;
  const preview = document.getElementById(previewId);

  zone?.addEventListener('click', (e) => {
    // Don't trigger if clicked remove button
    if ((e.target as HTMLElement).closest('.btn-remove-doc')) return;
    input?.click();
  });

  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (preview) {
          const img = preview.querySelector('.preview-thumbnail') as HTMLImageElement;
          const nameSpan = preview.querySelector('.preview-name');
          const sizeSpan = preview.querySelector('.preview-size');

          if (img) img.src = dataUrl;
          if (nameSpan) nameSpan.textContent = file.name;
          if (sizeSpan) sizeSpan.textContent = `${Math.round(file.size / 1024)} KB`;

          preview.classList.remove('hidden');
          const prompt = zone?.querySelector('.upload-zone-prompt');
          if (prompt) (prompt as HTMLElement).style.display = 'none';
        }
      };
      reader.readAsDataURL(file);
    }
  });

  // Remove button
  preview?.querySelector('.btn-remove-doc')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (input) input.value = '';
    preview.classList.add('hidden');
    const prompt = zone?.querySelector('.upload-zone-prompt');
    if (prompt) (prompt as HTMLElement).style.display = 'flex';
  });
}

function initSignaturePad() {
  const tabUpload = document.getElementById('tab-sig-upload');
  const tabDraw = document.getElementById('tab-sig-draw');
  const uploadContainer = document.getElementById('sig-upload-container');
  const drawContainer = document.getElementById('sig-draw-container');
  const canvas = document.getElementById('sig-canvas') as HTMLCanvasElement;
  const btnClear = document.getElementById('btn-clear-canvas');
  const btnSave = document.getElementById('btn-save-canvas');

  if (tabUpload && tabDraw && uploadContainer && drawContainer) {
    tabUpload.addEventListener('click', () => {
      tabUpload.classList.add('active');
      tabDraw.classList.remove('active');
      uploadContainer.classList.remove('hidden');
      drawContainer.classList.add('hidden');
    });

    tabDraw.addEventListener('click', () => {
      tabDraw.classList.add('active');
      tabUpload.classList.remove('active');
      drawContainer.classList.remove('hidden');
      uploadContainer.classList.add('hidden');
      resizeCanvas();
    });
  }

  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      state.canvasCtx = ctx;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';

      const getPos = (e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e && e.touches.length > 0) {
          return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
          };
        } else if ('clientX' in e) {
          return {
            x: (e as MouseEvent).clientX - rect.left,
            y: (e as MouseEvent).clientY - rect.top,
          };
        }
        return { x: 0, y: 0 };
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        state.isDrawingSignature = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!state.isDrawingSignature) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const stopDrawing = () => {
        state.isDrawingSignature = false;
      };

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', stopDrawing);

      canvas.addEventListener('touchstart', startDrawing, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      window.addEventListener('touchend', stopDrawing);

      btnClear?.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });

      btnSave?.addEventListener('click', () => {
        const dataUrl = canvas.toDataURL('image/png');
        const preview = document.getElementById('preview-signature');
        const zone = document.getElementById('zone-signature');

        if (preview && zone) {
          const img = preview.querySelector('.preview-thumbnail') as HTMLImageElement;
          const nameSpan = preview.querySelector('.preview-name');
          const sizeSpan = preview.querySelector('.preview-size');

          if (img) img.src = dataUrl;
          if (nameSpan) nameSpan.textContent = 'drawn_signature.png';
          if (sizeSpan) sizeSpan.textContent = '35 KB';

          preview.classList.remove('hidden');
          const prompt = zone.querySelector('.upload-zone-prompt');
          if (prompt) (prompt as HTMLElement).style.display = 'none';

          // Switch back to view preview
          tabUpload?.click();
          showToast('Signature captured successfully!', 'success');
        }
      });
    }
  }

  function resizeCanvas() {
    if (canvas) {
      canvas.width = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 20 : 320;
      canvas.height = 120;
      if (state.canvasCtx) {
        state.canvasCtx.lineWidth = 2.5;
        state.canvasCtx.lineCap = 'round';
        state.canvasCtx.strokeStyle = '#0f172a';
      }
    }
  }
}

function ensureDocumentFallback() {
  // If user didn't upload image in demo, attach high quality sample proofs
  const setFallback = (previewId: string, zoneId: string, fallbackSrc: string, fallbackName: string) => {
    const preview = document.getElementById(previewId);
    const zone = document.getElementById(zoneId);
    if (preview && preview.classList.contains('hidden')) {
      const img = preview.querySelector('.preview-thumbnail') as HTMLImageElement;
      const name = preview.querySelector('.preview-name');
      const size = preview.querySelector('.preview-size');
      if (img) img.src = fallbackSrc;
      if (name) name.textContent = fallbackName;
      if (size) size.textContent = '240 KB';
      preview.classList.remove('hidden');
      const prompt = zone?.querySelector('.upload-zone-prompt');
      if (prompt) (prompt as HTMLElement).style.display = 'none';
    }
  };

  setFallback('preview-poi', 'zone-poi', SAMPLE_DOCS.aadhaar, 'aadhaar_card_proof.pdf');
  setFallback('preview-poa', 'zone-poa', SAMPLE_DOCS.aadhaar, 'address_aadhaar.pdf');
  setFallback('preview-dob', 'zone-dob', SAMPLE_DOCS.aadhaar, 'dob_proof_document.pdf');
  setFallback('preview-photo', 'zone-photo', SAMPLE_DOCS.photo, 'passport_photograph.jpg');
  setFallback('preview-signature', 'zone-signature', SAMPLE_DOCS.signature, 'specimen_signature.png');
}

function populateReviewStep() {
  const fullName = `${(document.getElementById('applicant_first_name') as HTMLInputElement)?.value} ${(document.getElementById('applicant_middle_name') as HTMLInputElement)?.value || ''} ${(document.getElementById('applicant_last_name') as HTMLInputElement)?.value}`.trim();
  const panName = (document.getElementById('applicant_pan_card_name') as HTMLInputElement)?.value || fullName;
  const dob = (document.getElementById('applicant_dob') as HTMLInputElement)?.value;
  const gender = (document.getElementById('applicant_gender') as HTMLSelectElement)?.value;
  const father = (document.getElementById('father_name') as HTMLInputElement)?.value;
  const aadhaar = (document.getElementById('aadhaar_number') as HTMLInputElement)?.value;
  const mobile = (document.getElementById('contact_mobile') as HTMLInputElement)?.value;
  const email = (document.getElementById('contact_email') as HTMLInputElement)?.value;

  const flat = (document.getElementById('addr_flat') as HTMLInputElement)?.value;
  const street = (document.getElementById('addr_street') as HTMLInputElement)?.value;
  const locality = (document.getElementById('addr_locality') as HTMLInputElement)?.value;
  const city = (document.getElementById('addr_city') as HTMLInputElement)?.value;
  const stateVal = (document.getElementById('addr_state') as HTMLSelectElement)?.value;
  const pin = (document.getElementById('addr_pincode') as HTMLInputElement)?.value;

  const fullAddr = `${flat}, ${street}, ${locality}, ${city}, ${stateVal} - ${pin}, India`;

  const revFullName = document.getElementById('rev-full-name');
  const revPanName = document.getElementById('rev-pan-name');
  const revDob = document.getElementById('rev-dob');
  const revGender = document.getElementById('rev-gender');
  const revFather = document.getElementById('rev-father');
  const revAadhaar = document.getElementById('rev-aadhaar');
  const revMobile = document.getElementById('rev-mobile');
  const revEmail = document.getElementById('rev-email');
  const revAddress = document.getElementById('rev-address');

  if (revFullName) revFullName.textContent = fullName || '—';
  if (revPanName) revPanName.textContent = panName || '—';
  if (revDob) revDob.textContent = dob || '—';
  if (revGender) revGender.textContent = gender || '—';
  if (revFather) revFather.textContent = father || '—';
  if (revAadhaar) revAadhaar.textContent = aadhaar ? `•••• •••• ${aadhaar.slice(-4)}` : '—';
  if (revMobile) revMobile.textContent = mobile ? `+91 ${mobile}` : '—';
  if (revEmail) revEmail.textContent = email || '—';
  if (revAddress) revAddress.textContent = fullAddr;

  // Render list of documents in review
  const docList = document.getElementById('rev-docs-list');
  if (docList) {
    docList.innerHTML = `
      <div class="review-doc-row"><i class="fa-solid fa-circle-check text-green"></i> <span>Proof of Identity: Aadhaar Card</span></div>
      <div class="review-doc-row"><i class="fa-solid fa-circle-check text-green"></i> <span>Proof of Address: Communication Address Proof</span></div>
      <div class="review-doc-row"><i class="fa-solid fa-circle-check text-green"></i> <span>Proof of DOB: Aadhaar / Birth Proof</span></div>
      <div class="review-doc-row"><i class="fa-solid fa-circle-check text-green"></i> <span>Applicant Photograph (Passport Size)</span></div>
      <div class="review-doc-row"><i class="fa-solid fa-circle-check text-green"></i> <span>Specimen Signature Enclosed</span></div>
    `;
  }

  // Dynamic fee calculation
  const fee = repo.getFeeSettings();
  const feeBase = document.getElementById('rev-fee-base');
  const feeTotal = document.getElementById('rev-fee-total');
  if (feeBase) feeBase.textContent = `₹${fee.baseFee}.00`;
  if (feeTotal) feeTotal.textContent = `₹${fee.totalFee}.00`;
}

function processPayment() {
  const modal = document.getElementById('pay-processing-modal');
  const heading = document.getElementById('pay-status-heading');
  const sub = document.getElementById('pay-status-sub');

  if (modal) modal.classList.remove('hidden');

  const fee = repo.getFeeSettings();
  setTimeout(() => {
    if (heading) heading.textContent = 'Authorizing Payment...';
    if (sub) sub.textContent = `Receiving ₹${fee.totalFee} via UPI Network...`;
  }, 1000);

  setTimeout(() => {
    if (heading) heading.textContent = 'Payment Confirmed!';
    if (sub) sub.textContent = 'Generating Application ID and Acknowledgement...';
  }, 2200);

  setTimeout(() => {
    if (modal) modal.classList.add('hidden');
    completeApplicationSubmission();
  }, 3200);
}

function completeApplicationSubmission() {
  const user = repo.getCurrentUser();
  if (!user) return;

  const appId = `PAN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const txnId = `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;
  const fee = repo.getFeeSettings();

  const poiImg = (document.querySelector('#preview-poi .preview-thumbnail') as HTMLImageElement)?.src || SAMPLE_DOCS.aadhaar;
  const poaImg = (document.querySelector('#preview-poa .preview-thumbnail') as HTMLImageElement)?.src || SAMPLE_DOCS.aadhaar;
  const dobImg = (document.querySelector('#preview-dob .preview-thumbnail') as HTMLImageElement)?.src || SAMPLE_DOCS.aadhaar;
  const photoImg = (document.querySelector('#preview-photo .preview-thumbnail') as HTMLImageElement)?.src || SAMPLE_DOCS.photo;
  const sigImg = (document.querySelector('#preview-signature .preview-thumbnail') as HTMLImageElement)?.src || SAMPLE_DOCS.signature;

  const newApp: PANApplication = {
    id: appId,
    userId: user.id,
    category: 'Individual',
    applicant: {
      title: (document.getElementById('applicant_title') as HTMLSelectElement)?.value || 'Shri',
      firstName: (document.getElementById('applicant_first_name') as HTMLInputElement)?.value.trim() || 'Ramesh',
      middleName: (document.getElementById('applicant_middle_name') as HTMLInputElement)?.value.trim() || '',
      lastName: (document.getElementById('applicant_last_name') as HTMLInputElement)?.value.trim() || 'Kumar',
      panCardName: (document.getElementById('applicant_pan_card_name') as HTMLInputElement)?.value.trim() || 'RAMESH KUMAR',
      dob: (document.getElementById('applicant_dob') as HTMLInputElement)?.value || '1995-08-15',
      gender: ((document.getElementById('applicant_gender') as HTMLSelectElement)?.value as any) || 'Male',
      fatherName: (document.getElementById('father_name') as HTMLInputElement)?.value.trim() || 'Father Name',
      parentPreference: 'Father',
      aadhaarNumber: (document.getElementById('aadhaar_number') as HTMLInputElement)?.value.trim() || '987654329012',
      nameAsPerAadhaar: (document.getElementById('name_as_aadhaar') as HTMLInputElement)?.value.trim() || 'Ramesh Kumar',
    },
    contact: {
      mobile: (document.getElementById('contact_mobile') as HTMLInputElement)?.value.trim() || user.mobile,
      email: (document.getElementById('contact_email') as HTMLInputElement)?.value.trim() || user.email,
    },
    address: {
      flat: (document.getElementById('addr_flat') as HTMLInputElement)?.value.trim() || 'Flat 402',
      street: (document.getElementById('addr_street') as HTMLInputElement)?.value.trim() || 'Station Road',
      locality: (document.getElementById('addr_locality') as HTMLInputElement)?.value.trim() || 'Main Market',
      city: (document.getElementById('addr_city') as HTMLInputElement)?.value.trim() || 'Delhi',
      state: (document.getElementById('addr_state') as HTMLSelectElement)?.value || 'Delhi',
      pincode: (document.getElementById('addr_pincode') as HTMLInputElement)?.value.trim() || '110001',
      country: 'India',
      sameAsPerm: true,
    },
    documents: {
      poi: {
        id: `doc-poi-${Date.now()}`,
        name: 'Aadhaar Card (POI)',
        type: 'identity_proof',
        url: poiImg,
        fileName: 'aadhaar_poi.pdf',
        fileSize: '380 KB',
        uploadedAt: new Date().toLocaleString(),
        status: 'Under Review',
      },
      poa: {
        id: `doc-poa-${Date.now()}`,
        name: 'Address Proof (POA)',
        type: 'address_proof',
        url: poaImg,
        fileName: 'address_proof.pdf',
        fileSize: '310 KB',
        uploadedAt: new Date().toLocaleString(),
        status: 'Under Review',
      },
      dob: {
        id: `doc-dob-${Date.now()}`,
        name: 'DOB Proof',
        type: 'dob_proof',
        url: dobImg,
        fileName: 'dob_proof.pdf',
        fileSize: '290 KB',
        uploadedAt: new Date().toLocaleString(),
        status: 'Under Review',
      },
      photo: {
        id: `doc-photo-${Date.now()}`,
        name: 'Photograph',
        type: 'photo',
        url: photoImg,
        fileName: 'applicant_photo.jpg',
        fileSize: '85 KB',
        uploadedAt: new Date().toLocaleString(),
        status: 'Under Review',
      },
      signature: {
        id: `doc-sig-${Date.now()}`,
        name: 'Signature',
        type: 'signature',
        url: sigImg,
        fileName: 'applicant_signature.png',
        fileSize: '45 KB',
        uploadedAt: new Date().toLocaleString(),
        status: 'Under Review',
      },
    },
    payment: {
      amount: fee.totalFee,
      baseFee: fee.baseFee,
      serviceFee: fee.serviceFee,
      taxes: fee.taxFee,
      status: 'Successful',
      method: 'upi',
      transactionId: txnId,
      paidAt: new Date().toLocaleString(),
    },
    status: 'Under Review',
    statusHistory: [
      {
        status: 'Application Submitted',
        timestamp: new Date().toLocaleString(),
        note: `Application submitted with payment of ₹${fee.totalFee}`,
        updatedBy: user.name,
      },
      {
        status: 'Under Review',
        timestamp: new Date().toLocaleString(),
        note: 'Submitted to facilitator queue. Awaiting document verification.',
        updatedBy: 'System',
      },
    ],
    provider: {
      name: 'Sandbox / Demo Simulation',
      status: 'Sandbox Mode',
      submissionDate: new Date().toLocaleString(),
      responseDetails: 'Demo Mode — Official acknowledgement shown only when authorized provider is connected.',
    },
    createdAt: new Date().toLocaleString(),
    updatedAt: new Date().toLocaleString(),
  };

  // Save to repo & Firebase
  repo.saveNewApplication(newApp);

  // Send user notification
  repo.addNotification({
    id: `notif-${Date.now()}`,
    userId: user.id,
    title: 'Application Submitted!',
    message: `Your PAN application ${newApp.id} was submitted successfully. Verification in progress.`,
    type: 'success',
    read: false,
    createdAt: new Date().toLocaleString(),
    actionScreen: 'screen-applications',
  });

  // Populate Step 7 Confirmation Screen
  const confAppId = document.getElementById('conf-app-id');
  const confAppName = document.getElementById('conf-app-name');
  const confTxn = document.getElementById('conf-txn-id');
  const confAmt = document.getElementById('conf-amount');
  const confTime = document.getElementById('conf-timestamp');

  if (confAppId) confAppId.textContent = newApp.id;
  if (confAppName) confAppName.textContent = getApplicantFullName(newApp);
  if (confTxn) confTxn.textContent = newApp.payment.transactionId;
  if (confAmt) confAmt.textContent = `₹${newApp.payment.amount}.00 (Successful)`;
  if (confTime) confTime.textContent = newApp.createdAt;

  goToWizardStep(7);
  showToast('Application Submitted Successfully!', 'success');
}

function saveApplicationDraft() {
  const user = repo.getCurrentUser();
  if (!user) return;

  const draftId = `DRAFT-${Date.now().toString().slice(-4)}`;
  const draftApp: PANApplication = {
    id: draftId,
    userId: user.id,
    category: 'Individual',
    applicant: {
      title: 'Shri',
      firstName: (document.getElementById('applicant_first_name') as HTMLInputElement)?.value.trim() || 'Draft Applicant',
      lastName: (document.getElementById('applicant_last_name') as HTMLInputElement)?.value.trim() || '',
      panCardName: (document.getElementById('applicant_pan_card_name') as HTMLInputElement)?.value.trim() || '',
      dob: (document.getElementById('applicant_dob') as HTMLInputElement)?.value || '',
      gender: 'Male',
      fatherName: (document.getElementById('father_name') as HTMLInputElement)?.value.trim() || '',
      parentPreference: 'Father',
      aadhaarNumber: (document.getElementById('aadhaar_number') as HTMLInputElement)?.value.trim() || '',
      nameAsPerAadhaar: (document.getElementById('name_as_aadhaar') as HTMLInputElement)?.value.trim() || '',
    },
    contact: {
      mobile: (document.getElementById('contact_mobile') as HTMLInputElement)?.value.trim() || user.mobile,
      email: (document.getElementById('contact_email') as HTMLInputElement)?.value.trim() || user.email,
    },
    address: {
      flat: (document.getElementById('addr_flat') as HTMLInputElement)?.value.trim() || '',
      street: (document.getElementById('addr_street') as HTMLInputElement)?.value.trim() || '',
      locality: '',
      city: (document.getElementById('addr_city') as HTMLInputElement)?.value.trim() || '',
      state: (document.getElementById('addr_state') as HTMLSelectElement)?.value || '',
      pincode: (document.getElementById('addr_pincode') as HTMLInputElement)?.value.trim() || '',
      country: 'India',
      sameAsPerm: true,
    },
    documents: {
      poi: { id: 'd1', name: 'POI', type: 'identity_proof', url: SAMPLE_DOCS.aadhaar, fileName: 'doc.pdf', fileSize: '100KB', uploadedAt: '', status: 'Pending' },
      poa: { id: 'd2', name: 'POA', type: 'address_proof', url: SAMPLE_DOCS.aadhaar, fileName: 'doc.pdf', fileSize: '100KB', uploadedAt: '', status: 'Pending' },
      dob: { id: 'd3', name: 'DOB', type: 'dob_proof', url: SAMPLE_DOCS.aadhaar, fileName: 'doc.pdf', fileSize: '100KB', uploadedAt: '', status: 'Pending' },
      photo: { id: 'd4', name: 'Photo', type: 'photo', url: SAMPLE_DOCS.photo, fileName: 'photo.jpg', fileSize: '100KB', uploadedAt: '', status: 'Pending' },
      signature: { id: 'd5', name: 'Signature', type: 'signature', url: SAMPLE_DOCS.signature, fileName: 'sig.png', fileSize: '50KB', uploadedAt: '', status: 'Pending' },
    },
    payment: {
      amount: 157,
      baseFee: 107,
      serviceFee: 50,
      taxes: 0,
      status: 'Pending',
      method: 'upi',
      transactionId: '',
    },
    status: 'Draft',
    statusHistory: [{ status: 'Draft', timestamp: new Date().toLocaleString(), note: 'Draft saved by applicant', updatedBy: user.name }],
    provider: { name: 'Sandbox / Demo Simulation', status: 'Sandbox Mode' },
    createdAt: new Date().toLocaleString(),
    updatedAt: new Date().toLocaleString(),
  };

  repo.saveNewApplication(draftApp);
}

function downloadApplicationReceipt() {
  const appId = document.getElementById('conf-app-id')?.textContent || 'PAN-2026-1001';
  const name = document.getElementById('conf-app-name')?.textContent || 'Applicant';
  const txn = document.getElementById('conf-txn-id')?.textContent || 'TXN-98234821';
  const amt = document.getElementById('conf-amount')?.textContent || '₹157.00';
  const date = document.getElementById('conf-timestamp')?.textContent || new Date().toLocaleString();

  const receiptContent = `==========================================================
    PAN CARD FACILITATION PORTAL - APPLICATION RECEIPT
==========================================================
Notice: Independent facilitator portal running in Demo/Sandbox mode.
Not affiliated with Income Tax Dept, Protean, or UTIITSL.

Receipt Reference: ${appId}
Applicant Name:    ${name}
Transaction ID:    ${txn}
Total Amount Paid: ${amt}
Payment Status:    SUCCESSFUL (CONFIRMED)
Submission Date:   ${date}
Application Type:  Form 49A (Individual Citizen New PAN)
Physical Dispatch: Standard India Speed Post (Included)

Status: UNDER DOCUMENT VERIFICATION
Next Step: An authorized verification officer will inspect your
identity and address documents. You can track live updates at:
PAN Portal -> My Applications -> Track Application.

Official Provider: Queued for transmission (Sandbox Mode)
==========================================================
Thank you for using our digital facilitation portal.
==========================================================`;

  const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PAN_Receipt_${appId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Receipt downloaded successfully.', 'success');
}

/* ============================================================
   6. USER APPLICATIONS LIST & TRACKING
   ============================================================ */
function renderUserApplications() {
  const user = repo.getCurrentUser();
  const listEl = document.getElementById('user-applications-list');
  const countEl = document.getElementById('my-apps-count');
  if (!user || !listEl) return;

  const apps = repo.getUserApplications(user.id);
  if (countEl) countEl.textContent = apps.length.toString();

  // Filter
  const filtered = apps.filter(app => {
    if (state.activeFilter === 'all') return true;
    return app.status.toLowerCase() === state.activeFilter.toLowerCase();
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state-card">
        <i class="fa-regular fa-folder-open empty-icon"></i>
        <h4>No Applications in this category</h4>
        <p>No records found matching filter "${state.activeFilter}".</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(app => {
    const statusClass = (app.status || 'under-review').toLowerCase().replace(/\s+/g, '-');
    const applicantName = getApplicantFullName(app);
    const aadhaarEnd = app.applicant?.aadhaarNumber ? app.applicant.aadhaarNumber.slice(-4) : '••••';
    const payStatus = app.payment?.status || 'Pending';
    const payAmt = app.payment?.amount ?? 157;
    return `
      <div class="app-card">
        <div class="app-card-header">
          <div>
            <span class="app-id-pill">${app.id}</span>
            <h4 class="app-applicant-name">${applicantName}</h4>
            <span class="app-date"><i class="fa-regular fa-calendar"></i> ${app.createdAt || 'Recent'}</span>
          </div>
          <span class="status-badge ${statusClass}">
            <i class="fa-solid fa-circle-dot"></i> ${app.status}
          </span>
        </div>

        <div class="app-card-badges">
          <span class="status-badge approved">Payment: ${payStatus} (₹${payAmt})</span>
          <span class="status-badge under-review">Category: ${app.category || 'Individual'}</span>
        </div>

        <div class="app-card-footer">
          <span class="app-fee-tag">Aadhaar: <strong>•••• •••• ${aadhaarEnd}</strong></span>
          <div class="app-card-actions">
            <button class="btn-card-action" onclick="window.trackApplicationById('${app.id}')">
              <i class="fa-solid fa-magnifying-glass-location"></i> Track
            </button>
            <button class="btn-card-action primary" onclick="window.viewApplicationModal('${app.id}')">
              <i class="fa-solid fa-eye"></i> Details
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Global hook for inline onclicks
(window as any).trackApplicationById = (appId: string) => {
  switchUserScreen('screen-track', 'Track Application', true);
  const trackInput = document.getElementById('track-app-id-input') as HTMLInputElement;
  if (trackInput) trackInput.value = appId;
  document.getElementById('btn-perform-track')?.click();
};

(window as any).viewApplicationModal = (appId: string) => {
  openApplicationDetailsModal(appId);
};

function initTracking() {
  const btnTrack = document.getElementById('btn-perform-track');
  const trackInput = document.getElementById('track-app-id-input') as HTMLInputElement;

  btnTrack?.addEventListener('click', () => {
    const query = trackInput?.value.trim();
    if (!query) {
      showToast('Please enter an Application ID to track.', 'error');
      return;
    }

    const app = repo.getApplicationById(query);
    const container = document.getElementById('track-results-container');

    if (!app) {
      showToast(`No application found with ID "${query}".`, 'error');
      if (container) container.classList.add('hidden');
      return;
    }

    if (container) container.classList.remove('hidden');

    // Populate Tracking Card
    const idEl = document.getElementById('track-card-id');
    const nameEl = document.getElementById('track-card-applicant');
    const statusEl = document.getElementById('track-card-status');

    if (idEl) idEl.textContent = app.id;
    if (nameEl) nameEl.textContent = getApplicantFullName(app);
    if (statusEl) {
      statusEl.textContent = app.status;
      statusEl.className = `track-status-badge ${(app.status || 'under-review').toLowerCase().replace(/\s+/g, '-')}`;
    }

    // Render Timeline steps based on status
    updateTrackingTimeline(app);
  });
}

function updateTrackingTimeline(app: PANApplication) {
  const sDraft = document.getElementById('t-step-draft');
  const sSubmitted = document.getElementById('t-step-submitted');
  const sPaid = document.getElementById('t-step-paid');
  const sDocs = document.getElementById('t-step-docs');
  const sProvider = document.getElementById('t-step-provider');
  const sProcessing = document.getElementById('t-step-processing');
  const sCompleted = document.getElementById('t-step-completed');

  const tTimeDraft = document.getElementById('t-time-draft');
  const tTimeSubmitted = document.getElementById('t-time-submitted');
  const tTimePaid = document.getElementById('t-time-paid');
  const tTimeDocs = document.getElementById('t-time-docs');
  const tDocInfo = document.getElementById('t-doc-info');

  if (tTimeDraft) tTimeDraft.textContent = app.createdAt;
  if (tTimeSubmitted) tTimeSubmitted.textContent = app.createdAt;
  if (tTimePaid) tTimePaid.textContent = `${app.payment.paidAt || app.createdAt} (₹${app.payment.amount})`;

  // Reset classes
  [sDraft, sSubmitted, sPaid, sDocs, sProvider, sProcessing, sCompleted].forEach(el => {
    if (el) el.className = 'timeline-step pending';
  });

  if (sDraft) sDraft.className = 'timeline-step completed';
  if (sSubmitted) sSubmitted.className = 'timeline-step completed';
  if (sPaid) sPaid.className = 'timeline-step completed';

  if (app.status === 'Under Review') {
    if (sDocs) sDocs.className = 'timeline-step current';
    if (tDocInfo) tDocInfo.textContent = 'Facilitation officer verifying identity proofs';
  } else if (app.status === 'Documents Approved') {
    if (sDocs) sDocs.className = 'timeline-step completed';
    if (sProvider) sProvider.className = 'timeline-step current';
  } else if (app.status === 'Submitted to Provider') {
    if (sDocs) sDocs.className = 'timeline-step completed';
    if (sProvider) sProvider.className = 'timeline-step completed';
    if (sProcessing) sProcessing.className = 'timeline-step current';
  } else if (app.status === 'Processing') {
    if (sDocs) sDocs.className = 'timeline-step completed';
    if (sProvider) sProvider.className = 'timeline-step completed';
    if (sProcessing) sProcessing.className = 'timeline-step current';
  } else if (app.status === 'Completed') {
    [sDraft, sSubmitted, sPaid, sDocs, sProvider, sProcessing, sCompleted].forEach(el => {
      if (el) el.className = 'timeline-step completed';
    });
  } else if (app.status === 'Action Required') {
    if (sDocs) sDocs.className = 'timeline-step current';
    if (tDocInfo) tDocInfo.textContent = 'One or more documents require re-upload. See Document Center.';
  }
}

/* ============================================================
   7. USER DOCUMENT CENTER & RE-UPLOAD FLOW
   ============================================================ */
function renderUserDocumentsCenter() {
  const user = repo.getCurrentUser();
  const selectApp = document.getElementById('sel-user-docs-app') as HTMLSelectElement;
  const grid = document.getElementById('user-docs-grid');
  if (!user || !selectApp || !grid) return;

  const apps = repo.getUserApplications(user.id);
  if (apps.length === 0) {
    grid.innerHTML = '<p class="text-muted">No applications found. Submit an application to view documents.</p>';
    return;
  }

  // Populate application select dropdown
  selectApp.innerHTML = apps.map(a => `<option value="${a.id}">${a.id} - ${getApplicantFullName(a)} (${a.status})</option>`).join('');

  const currentAppId = state.selectedAppForDocs || apps[0].id;
  selectApp.value = currentAppId;

  selectApp.onchange = () => {
    state.selectedAppForDocs = selectApp.value;
    renderUserDocumentsCenter();
  };

  const currentApp = repo.getApplicationById(currentAppId);
  if (!currentApp) return;

  const docs = currentApp.documents;
  const docEntries: Array<{ key: keyof PANApplication['documents']; doc: DocumentItem }> = [
    { key: 'poi', doc: docs.poi },
    { key: 'poa', doc: docs.poa },
    { key: 'dob', doc: docs.dob },
    { key: 'photo', doc: docs.photo },
    { key: 'signature', doc: docs.signature },
  ];

  grid.innerHTML = docEntries.map(({ key, doc }) => {
    const isRejected = doc.status === 'Rejected';
    const statusClass = doc.status.toLowerCase().replace(/\s+/g, '-');

    return `
      <div class="doc-status-item">
        <img src="${doc.url}" alt="${doc.name}" class="doc-status-thumb" />
        <div class="doc-status-info">
          <h5>${doc.name}</h5>
          <span>${doc.fileName} (${doc.fileSize})</span>
          <span class="doc-badge-pill ${statusClass}">${doc.status}</span>
          ${isRejected ? `<p class="text-rose text-xs mt-1"><strong>Reason:</strong> ${doc.rejectionReason}</p>` : ''}
        </div>
        ${isRejected ? `
          <button class="btn-doc-reupload" onclick="window.openReuploadModal('${currentApp.id}', '${key}', '${escapeHtml(doc.rejectionReason || '')}')">
            <i class="fa-solid fa-cloud-arrow-up"></i> Re-upload
          </button>
        ` : `
          <button class="btn-card-action" onclick="window.previewDocumentImage('${doc.url}', '${escapeHtml(doc.name)}', '${currentApp.id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
        `}
      </div>
    `;
  }).join('');
}

// User Re-upload Modal Trigger
(window as any).openReuploadModal = (appId: string, docKey: keyof PANApplication['documents'], reason: string) => {
  state.activeReuploadAppId = appId;
  state.activeReuploadDocKey = docKey;

  const modal = document.getElementById('modal-user-reupload');
  const reasonText = document.getElementById('reupload-reason-text');
  const btnSubmit = document.getElementById('btn-submit-reupload') as HTMLButtonElement;
  const preview = document.getElementById('reupload-preview');

  if (reasonText) reasonText.textContent = reason || 'Document was unclear.';
  if (preview) preview.classList.add('hidden');
  if (btnSubmit) btnSubmit.disabled = true;

  if (modal) modal.classList.remove('hidden');

  // Wire up file input in modal
  const fileInput = document.getElementById('reupload-file-input') as HTMLInputElement;
  const dropzone = document.getElementById('reupload-dropzone');

  if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (preview) {
            const img = preview.querySelector('.preview-thumbnail') as HTMLImageElement;
            const nameEl = document.getElementById('reupload-filename');
            if (img) img.src = dataUrl;
            if (nameEl) nameEl.textContent = file.name;
            preview.classList.remove('hidden');
          }
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.onclick = () => {
              repo.reuploadDocument(appId, docKey, dataUrl, file.name, `${Math.round(file.size / 1024)} KB`);
              closeModal('modal-user-reupload');
              showToast('Document re-uploaded! Submitted to admin for re-verification.', 'success');
              renderUserDocumentsCenter();
              refreshUserDashboard();
            };
          }
        };
        reader.readAsDataURL(file);
      }
    };
  }
};

/* ============================================================
   8. USER PAYMENTS, NOTIFICATIONS & TICKETS
   ============================================================ */
function renderUserPayments() {
  const user = repo.getCurrentUser();
  const listEl = document.getElementById('user-payments-list');
  if (!user || !listEl) return;

  const apps = repo.getUserApplications(user.id);
  const paidApps = apps.filter(a => a.payment && a.payment.status === 'Successful');

  if (paidApps.length === 0) {
    listEl.innerHTML = '<p class="text-muted">No completed transactions found.</p>';
    return;
  }

  listEl.innerHTML = paidApps.map(app => `
    <div class="payment-card-item">
      <div>
        <span class="pay-txn-id">${app.payment.transactionId}</span>
        <h5 class="mt-1">${app.id} - ${getApplicantFullName(app)}</h5>
        <span class="pay-txn-date">${app.payment.paidAt || app.createdAt} • Form 49A</span>
      </div>
      <div class="pay-amt-badge">
        <span class="pay-amt-val">₹${app.payment.amount}.00</span>
        <span class="doc-badge-pill verified">Successful</span>
      </div>
    </div>
  `).join('');
}

function renderUserNotifications() {
  const user = repo.getCurrentUser();
  const listEl = document.getElementById('user-notifications-list');
  if (!user || !listEl) return;

  const notifs = repo.getNotifications(user.id);
  if (notifs.length === 0) {
    listEl.innerHTML = '<p class="text-muted">You have no notifications right now.</p>';
    return;
  }

  listEl.innerHTML = notifs.map(n => `
    <div class="notification-card ${n.read ? '' : 'unread'}" onclick="window.handleNotificationClick('${n.id}', '${n.actionScreen || ''}')">
      <div class="notif-icon"><i class="fa-solid fa-bell"></i></div>
      <div class="notif-text">
        <h5>${n.title}</h5>
        <p>${n.message}</p>
        <span class="notif-time">${n.createdAt}</span>
      </div>
    </div>
  `).join('');

  document.getElementById('btn-mark-all-read')?.addEventListener('click', () => {
    repo.markNotificationsRead(user.id);
    renderUserNotifications();
    refreshUserDashboard();
    showToast('All notifications marked as read.', 'info');
  });
}

(window as any).handleNotificationClick = (notifId: string, screen: string) => {
  const user = repo.getCurrentUser();
  if (user) {
    repo.markNotificationsRead(user.id);
    refreshUserDashboard();
  }
  if (screen) {
    switchUserScreen(screen, 'Portal', true);
  }
};

function initUserPanels() {
  // Support Tickets
  document.getElementById('btn-open-ticket-modal')?.addEventListener('click', () => {
    const user = repo.getCurrentUser();
    if (!user) return;
    const subject = prompt('Enter support ticket subject:');
    if (!subject) return;
    const message = prompt('Enter your question or issue description:');
    if (!message) return;

    repo.createTicket(user.id, user.name, subject, message);
    showToast('Support ticket created! Our team will respond shortly.', 'success');
    renderUserTickets();
  });

  renderUserTickets();
}

function renderUserTickets() {
  const user = repo.getCurrentUser();
  const list = document.getElementById('user-tickets-list');
  if (!user || !list) return;

  const tickets = repo.getTickets(user.id);
  if (tickets.length === 0) {
    list.innerHTML = '<p class="text-muted text-xs">No active support tickets.</p>';
    return;
  }

  list.innerHTML = tickets.map(t => `
    <div class="ticket-row-item p-2 border-b border-slate-100 text-xs">
      <div class="flex justify-between font-bold">
        <span>${t.id} - ${t.subject}</span>
        <span class="text-amber">${t.status}</span>
      </div>
      <p class="text-slate-600 mt-1">${t.message}</p>
      ${t.adminReply ? `<div class="bg-blue-50 p-2 mt-2 rounded border border-blue-100 text-blue-900"><strong>Admin Reply:</strong> ${t.adminReply}</div>` : ''}
    </div>
  `).join('');
}

/* ============================================================
   9. ADMIN PANEL CONTROLLER
   ============================================================ */
function initAdminPanel() {
  // Admin Navigation Subtabs
  document.querySelectorAll('#admin-subnav .admin-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#admin-subnav .admin-nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetViewId = tab.getAttribute('data-admin-view');
      document.querySelectorAll('#admin-content-viewport .admin-view').forEach(v => v.classList.remove('active'));

      if (targetViewId) {
        const view = document.getElementById(targetViewId);
        if (view) view.classList.add('active');

        // Trigger view renders
        if (targetViewId === 'view-admin-dashboard') refreshAdminDashboard();
        if (targetViewId === 'view-admin-applications') renderAdminApplicationsTable();
        if (targetViewId === 'view-admin-users') renderAdminUsersTable();
        if (targetViewId === 'view-admin-payments') renderAdminPaymentsTable();
        if (targetViewId === 'view-admin-tickets') renderAdminTickets();
        if (targetViewId === 'view-admin-audit') renderAdminAuditLogs();
      }
    });
  });

  // Admin Search & Filter in Applications Table
  const searchInput = document.getElementById('adm-search-input') as HTMLInputElement;
  const statusFilter = document.getElementById('adm-filter-status') as HTMLSelectElement;
  const payFilter = document.getElementById('adm-filter-payment') as HTMLSelectElement;

  searchInput?.addEventListener('input', () => renderAdminApplicationsTable());
  statusFilter?.addEventListener('change', () => renderAdminApplicationsTable());
  payFilter?.addEventListener('change', () => renderAdminApplicationsTable());

  // Export CSV
  document.getElementById('btn-export-applications-csv')?.addEventListener('click', exportApplicationsCSV);
  document.getElementById('adm-quick-export-csv')?.addEventListener('click', exportApplicationsCSV);

  // Quick actions
  document.getElementById('adm-quick-review-first')?.addEventListener('click', () => {
    const apps = repo.getApplications().filter(a => a.status === 'Under Review');
    if (apps.length > 0) {
      openApplicationWorkspace(apps[0].id);
    } else {
      showToast('No pending applications waiting for review!', 'info');
    }
  });

  // Admin Status Filter Chips
  document.querySelectorAll('.adm-status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.adm-status-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.getAttribute('data-adm-status-filter') || 'all';
      const statusSelect = document.getElementById('adm-filter-status') as HTMLSelectElement;
      if (statusSelect) {
        statusSelect.value = filter === 'all' ? '' : filter;
        renderAdminApplicationsTable();
      }
    });
  });

  document.getElementById('adm-quick-edit-fee')?.addEventListener('click', () => {
    const tab = document.querySelector('[data-admin-view="view-admin-settings"]') as HTMLButtonElement;
    tab?.click();
  });

  document.getElementById('adm-quick-apk')?.addEventListener('click', () => {
    document.getElementById('btn-apk-guide')?.click();
  });

  // Fee Settings Form
  const formFee = document.getElementById('form-admin-fee-settings') as HTMLFormElement;
  const inputBase = document.getElementById('cfg_base_fee') as HTMLInputElement;
  const inputSvc = document.getElementById('cfg_service_fee') as HTMLInputElement;
  const inputTax = document.getElementById('cfg_tax_fee') as HTMLInputElement;
  const previewTotal = document.getElementById('cfg-preview-total');

  const updateFeeLivePreview = () => {
    const b = parseInt(inputBase?.value || '0', 10);
    const s = parseInt(inputSvc?.value || '0', 10);
    const t = parseInt(inputTax?.value || '0', 10);
    if (previewTotal) previewTotal.textContent = `₹${b + s + t}`;
  };

  inputBase?.addEventListener('input', updateFeeLivePreview);
  inputSvc?.addEventListener('input', updateFeeLivePreview);
  inputTax?.addEventListener('input', updateFeeLivePreview);

  formFee?.addEventListener('submit', (e) => {
    e.preventDefault();
    const b = parseInt(inputBase?.value || '0', 10);
    const s = parseInt(inputSvc?.value || '0', 10);
    const t = parseInt(inputTax?.value || '0', 10);
    const updated = repo.updateFeeSettings(b, s, t);
    showToast(`Fee Settings Saved! Total application fee is now ₹${updated.totalFee}.`, 'success');
    refreshUserDashboard();
  });

  // Broadcast Form
  document.getElementById('form-admin-broadcast')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const target = (document.getElementById('broadcast-target') as HTMLSelectElement)?.value;
    const title = (document.getElementById('broadcast-title') as HTMLInputElement)?.value;
    const message = (document.getElementById('broadcast-message') as HTMLTextAreaElement)?.value;

    repo.addNotification({
      id: `notif-${Date.now()}`,
      userId: target === 'all' ? 'all' : 'all',
      title,
      message,
      type: 'info',
      read: false,
      createdAt: new Date().toLocaleString(),
    });

    repo.logAudit('Broadcast Notification Sent', `Dispatched "${title}" to target group: ${target}`);
    showToast('Broadcast notification dispatched to users!', 'success');
    (document.getElementById('form-admin-broadcast') as HTMLFormElement)?.reset();
  });

  // Provider test
  document.getElementById('btn-test-provider')?.addEventListener('click', () => {
    showToast('Testing sandbox connection... Provider responding with HTTP 200 (DEMO MODE).', 'info');
  });

  // Document Rejection Confirmation in Modal
  document.getElementById('btn-confirm-reject-doc')?.addEventListener('click', () => {
    const textEl = document.getElementById('reject-reason-text') as HTMLTextAreaElement;
    const reason = textEl?.value.trim();
    if (!reason) {
      showToast('Please specify a rejection reason for the applicant.', 'error');
      return;
    }

    if (state.selectedAppForAdminModal && state.activeRejectDocKey) {
      repo.updateDocumentStatus(
        state.selectedAppForAdminModal.id,
        state.activeRejectDocKey,
        'Rejected',
        reason,
        'Admin (Staff)'
      );
      closeModal('modal-doc-reject');
      showToast('Document marked as Rejected. Applicant alerted to re-upload.', 'success');
      // Refresh inspector modal
      openApplicationDetailsModal(state.selectedAppForAdminModal.id);
      renderAdminApplicationsTable();
      refreshAdminDashboard();
    }
  });

  document.getElementById('reject-reason-preset')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    const textEl = document.getElementById('reject-reason-text') as HTMLTextAreaElement;
    if (textEl && val !== 'Custom') {
      textEl.value = val;
    }
  });

  // Workspace Top Action Bar Listeners
  document.getElementById('ws-btn-back')?.addEventListener('click', () => {
    const tab = document.querySelector('[data-admin-view="view-admin-applications"]') as HTMLButtonElement;
    tab?.click();
  });

  document.getElementById('ws-act-change-status')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (!app) return;
    const mId = document.getElementById('m-status-app-id');
    const badge = document.getElementById('m-status-current-badge');
    const sel = document.getElementById('m-select-new-status') as HTMLSelectElement;
    const note = document.getElementById('m-status-note') as HTMLTextAreaElement;

    if (mId) mId.textContent = `${app.id} • ${getApplicantFullName(app)}`;
    if (badge) {
      badge.textContent = app.status;
      badge.className = `status-badge ${(app.status || 'under-review').toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (sel) sel.value = app.status;
    if (note) note.value = `Status reviewed and verified by Admin Officer.`;

    document.getElementById('modal-admin-status-change')?.classList.remove('hidden');
  });

  document.getElementById('ws-act-assign-pan')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (!app) return;
    const mId = document.getElementById('m-assign-app-id');
    const inputPan = document.getElementById('m-input-pan-number') as HTMLInputElement;
    const inputAck = document.getElementById('m-input-ack-number') as HTMLInputElement;
    const inputSpeed = document.getElementById('m-input-speedpost') as HTMLInputElement;

    if (mId) mId.textContent = `${app.id} • ${getApplicantFullName(app)}`;
    if (inputPan) inputPan.value = app.panNumber || `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`;
    if (inputAck) inputAck.value = app.provider?.acknowledgementNumber || `88${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
    if (inputSpeed) inputSpeed.value = app.courierTracking || `SP-DL-${Math.floor(100000 + Math.random() * 900000)}IN`;

    document.getElementById('modal-admin-assign-pan')?.classList.remove('hidden');
  });

  document.getElementById('ws-act-edit-details')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (!app) return;
    const mId = document.getElementById('m-edit-app-id');
    if (mId) mId.textContent = `${app.id} • Edit Applicant Information`;

    (document.getElementById('edit_app_title') as HTMLSelectElement).value = app.applicant?.title || 'Shri';
    (document.getElementById('edit_app_first_name') as HTMLInputElement).value = app.applicant?.firstName || '';
    (document.getElementById('edit_app_last_name') as HTMLInputElement).value = app.applicant?.lastName || '';
    (document.getElementById('edit_app_pan_name') as HTMLInputElement).value = app.applicant?.panCardName || getApplicantFullName(app);
    (document.getElementById('edit_app_dob') as HTMLInputElement).value = app.applicant?.dob || '';
    (document.getElementById('edit_app_gender') as HTMLSelectElement).value = app.applicant?.gender || 'Male';
    (document.getElementById('edit_app_father') as HTMLInputElement).value = app.applicant?.fatherName || '';
    (document.getElementById('edit_app_aadhaar') as HTMLInputElement).value = app.applicant?.aadhaarNumber || '';
    (document.getElementById('edit_app_mobile') as HTMLInputElement).value = app.contact?.mobile || '';
    (document.getElementById('edit_app_email') as HTMLInputElement).value = app.contact?.email || '';
    (document.getElementById('edit_app_flat') as HTMLInputElement).value = app.address?.flat || '';
    (document.getElementById('edit_app_street') as HTMLInputElement).value = app.address?.street || '';
    (document.getElementById('edit_app_city') as HTMLInputElement).value = app.address?.city || '';
    (document.getElementById('edit_app_state') as HTMLInputElement).value = app.address?.state || '';
    (document.getElementById('edit_app_pincode') as HTMLInputElement).value = app.address?.pincode || '';

    document.getElementById('modal-admin-edit-applicant')?.classList.remove('hidden');
  });

  document.getElementById('ws-act-download-summary')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (app) downloadApplicationDossier(app);
  });

  document.getElementById('ws-act-quick-docs')?.addEventListener('click', () => {
    const btn = document.querySelector('[data-ws-pane="ws-pane-documents"]') as HTMLButtonElement;
    btn?.click();
  });

  document.getElementById('ws-act-add-note')?.addEventListener('click', () => {
    const btn = document.querySelector('[data-ws-pane="ws-pane-notes"]') as HTMLButtonElement;
    btn?.click();
    setTimeout(() => {
      document.getElementById('ws-input-note-text')?.focus();
    }, 100);
  });

  document.getElementById('ws-act-contact-user')?.addEventListener('click', () => {
    const btn = document.querySelector('[data-ws-pane="ws-pane-support"]') as HTMLButtonElement;
    btn?.click();
    setTimeout(() => {
      document.getElementById('ws-input-msg-text')?.focus();
    }, 100);
  });

  // Modal Save: Update Application Status
  document.getElementById('btn-save-admin-status')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (!app) return;
    const sel = document.getElementById('m-select-new-status') as HTMLSelectElement;
    const noteEl = document.getElementById('m-status-note') as HTMLTextAreaElement;
    const notifyCheck = document.getElementById('m-status-notify-user') as HTMLInputElement;

    const newStatus = sel.value as PANApplication['status'];
    const note = noteEl.value.trim() || `Status updated to ${newStatus}`;

    repo.updateApplicationStatus(app.id, newStatus, note, 'Admin (Officer)');

    if (notifyCheck?.checked) {
      repo.addNotification({
        id: `notif-${Date.now()}`,
        userId: app.userId,
        title: `Application Status: ${newStatus}`,
        message: `Your PAN Application (${app.id}) status has been updated: ${note}`,
        type: newStatus === 'Rejected' ? 'alert' : 'info',
        read: false,
        createdAt: new Date().toLocaleString(),
      });
    }

    closeModal('modal-admin-status-change');
    showToast(`Status updated to "${newStatus}" successfully!`, 'success');
    openApplicationWorkspace(app.id);
    renderAdminApplicationsTable();
    refreshAdminDashboard();
  });

  // Modal Save: Allot PAN & Courier
  document.getElementById('btn-confirm-assign-pan')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (!app) return;
    const pan = (document.getElementById('m-input-pan-number') as HTMLInputElement)?.value.trim().toUpperCase();
    const ack = (document.getElementById('m-input-ack-number') as HTMLInputElement)?.value.trim();
    const courier = (document.getElementById('m-input-speedpost') as HTMLInputElement)?.value.trim().toUpperCase();

    if (!pan || pan.length < 10) {
      showToast('Please enter a valid 10-character Permanent Account Number.', 'error');
      return;
    }

    repo.assignPanDetails(app.id, pan, courier, ack, 'Admin (Officer)');
    closeModal('modal-admin-assign-pan');
    showToast(`PAN Card ${pan} allotted and marked Completed!`, 'success');
    openApplicationWorkspace(app.id);
    renderAdminApplicationsTable();
    refreshAdminDashboard();
  });

  // Modal Save: Edit Applicant Details
  document.getElementById('btn-save-admin-edit')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (!app) return;

    const applicantUpdates: Partial<PANApplication['applicant']> = {
      title: (document.getElementById('edit_app_title') as HTMLSelectElement).value,
      firstName: (document.getElementById('edit_app_first_name') as HTMLInputElement).value.trim(),
      lastName: (document.getElementById('edit_app_last_name') as HTMLInputElement).value.trim(),
      panCardName: (document.getElementById('edit_app_pan_name') as HTMLInputElement).value.trim(),
      dob: (document.getElementById('edit_app_dob') as HTMLInputElement).value,
      gender: (document.getElementById('edit_app_gender') as HTMLSelectElement).value as any,
      fatherName: (document.getElementById('edit_app_father') as HTMLInputElement).value.trim(),
      aadhaarNumber: (document.getElementById('edit_app_aadhaar') as HTMLInputElement).value.trim(),
    };

    const contactUpdates: Partial<PANApplication['contact']> = {
      mobile: (document.getElementById('edit_app_mobile') as HTMLInputElement).value.trim(),
      email: (document.getElementById('edit_app_email') as HTMLInputElement).value.trim(),
    };

    const addressUpdates: Partial<PANApplication['address']> = {
      flat: (document.getElementById('edit_app_flat') as HTMLInputElement).value.trim(),
      street: (document.getElementById('edit_app_street') as HTMLInputElement).value.trim(),
      city: (document.getElementById('edit_app_city') as HTMLInputElement).value.trim(),
      state: (document.getElementById('edit_app_state') as HTMLInputElement).value.trim(),
      pincode: (document.getElementById('edit_app_pincode') as HTMLInputElement).value.trim(),
    };

    repo.updateApplicantDetails(app.id, applicantUpdates, contactUpdates, addressUpdates, 'Admin (Officer)');
    closeModal('modal-admin-edit-applicant');
    showToast('Applicant details updated successfully!', 'success');
    openApplicationWorkspace(app.id);
    renderAdminApplicationsTable();
  });

  // Modal Save: Payment Status Update
  document.getElementById('btn-save-admin-payment')?.addEventListener('click', () => {
    const app = state.selectedAppForAdminModal;
    if (!app) return;
    const selStatus = (document.getElementById('m-select-pay-status') as HTMLSelectElement).value as any;
    const txn = (document.getElementById('m-input-pay-txn') as HTMLInputElement).value.trim();

    repo.updatePaymentInfo(app.id, selStatus, txn, 'Admin (Accounts)');
    closeModal('modal-admin-payment-action');
    showToast(`Payment updated to ${selStatus}!`, 'success');
    openApplicationWorkspace(app.id);
    renderAdminApplicationsTable();
    refreshAdminDashboard();
  });
}

function refreshAdminDashboard() {
  const apps = repo.getApplications();
  const users = repo.getUsers();

  const totalApps = apps.length;
  const pendingApps = apps.filter(a => a.status === 'Under Review' || a.status === 'Action Required').length;
  const completedApps = apps.filter(a => a.status === 'Completed').length;

  let totalRev = 0;
  let paidCount = 0;
  let rejectedDocsCount = 0;

  apps.forEach(a => {
    if (a.payment && a.payment.status === 'Successful') {
      totalRev += a.payment.amount;
      paidCount++;
    }
    Object.values(a.documents).forEach(d => {
      if (d.status === 'Rejected') rejectedDocsCount++;
    });
  });

  const elTotal = document.getElementById('adm-stat-total-apps');
  const elPending = document.getElementById('adm-stat-pending-apps');
  const elRev = document.getElementById('adm-stat-revenue');
  const elPaidCount = document.getElementById('adm-stat-paid-count');
  const elUsers = document.getElementById('adm-stat-total-users');
  const elRejected = document.getElementById('adm-stat-rejected-docs');
  const elCompleted = document.getElementById('adm-stat-completed-apps');

  if (elTotal) elTotal.textContent = totalApps.toString();
  if (elPending) elPending.textContent = pendingApps.toString();
  if (elRev) elRev.textContent = `₹${totalRev.toLocaleString('en-IN')}`;
  if (elPaidCount) elPaidCount.textContent = `${paidCount} successful payments`;
  if (elUsers) elUsers.textContent = users.length.toString();
  if (elRejected) elRejected.textContent = rejectedDocsCount.toString();
  if (elCompleted) elCompleted.textContent = completedApps.toString();

  // Pipeline Bars
  const pipelineContainer = document.getElementById('pipeline-bars-container');
  if (pipelineContainer) {
    const underReview = apps.filter(a => a.status === 'Under Review').length;
    const approved = apps.filter(a => a.status === 'Documents Approved').length;
    const provider = apps.filter(a => a.status === 'Submitted to Provider').length;
    const completed = apps.filter(a => a.status === 'Completed').length;

    pipelineContainer.innerHTML = `
      <div class="pipeline-bar-row mb-2 text-xs">
        <div class="flex justify-between font-bold mb-1">
          <span>Under Document Review</span>
          <span>${underReview}</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-amber-500 h-full" style="width: ${totalApps ? (underReview / totalApps) * 100 : 0}%"></div>
        </div>
      </div>

      <div class="pipeline-bar-row mb-2 text-xs">
        <div class="flex justify-between font-bold mb-1">
          <span>Documents Approved</span>
          <span>${approved}</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-blue-600 h-full" style="width: ${totalApps ? (approved / totalApps) * 100 : 0}%"></div>
        </div>
      </div>

      <div class="pipeline-bar-row mb-2 text-xs">
        <div class="flex justify-between font-bold mb-1">
          <span>Provider Queued (Sandbox)</span>
          <span>${provider}</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full" style="width: ${totalApps ? (provider / totalApps) * 100 : 0}%"></div>
        </div>
      </div>

      <div class="pipeline-bar-row text-xs">
        <div class="flex justify-between font-bold mb-1">
          <span>Completed & Dispatched</span>
          <span>${completed}</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-green-600 h-full" style="width: ${totalApps ? (completed / totalApps) * 100 : 0}%"></div>
        </div>
      </div>
    `;
  }
}

function renderAdminApplicationsTable() {
  const tbody = document.getElementById('tbody-admin-applications');
  const searchInput = (document.getElementById('adm-search-input') as HTMLInputElement)?.value.toLowerCase();
  const statusFilter = (document.getElementById('adm-filter-status') as HTMLSelectElement)?.value;
  const payFilter = (document.getElementById('adm-filter-payment') as HTMLSelectElement)?.value;

  if (!tbody) return;

  let apps = repo.getApplications();

  // Filters
  if (searchInput) {
    apps = apps.filter(a => {
      const fName = a.applicant?.firstName?.toLowerCase() || '';
      const lName = a.applicant?.lastName?.toLowerCase() || '';
      const mob = a.contact?.mobile || '';
      const aadh = a.applicant?.aadhaarNumber || '';
      return (
        a.id.toLowerCase().includes(searchInput) ||
        fName.includes(searchInput) ||
        lName.includes(searchInput) ||
        mob.includes(searchInput) ||
        aadh.includes(searchInput)
      );
    });
  }

  if (statusFilter) {
    apps = apps.filter(a => a.status === statusFilter);
  }

  if (payFilter) {
    apps = apps.filter(a => a.payment?.status === payFilter);
  }

  if (apps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">No applications match criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = apps.map(app => {
    // Document review badges
    const docs = app.documents ? Object.values(app.documents) : [];
    const verifiedDocs = docs.filter(d => d && d.status === 'Verified').length;
    const rejectedDocs = docs.filter(d => d && d.status === 'Rejected').length;
    let docBadge = `<span class="doc-badge-pill pending">${verifiedDocs}/5 Verified</span>`;
    if (rejectedDocs > 0) docBadge = `<span class="doc-badge-pill rejected">${rejectedDocs} Rejected</span>`;
    if (verifiedDocs === 5) docBadge = `<span class="doc-badge-pill verified">All 5 Verified</span>`;

    const statusClass = (app.status || 'under-review').toLowerCase().replace(/\s+/g, '-');
    const applicantName = getApplicantFullName(app);
    const mobile = app.contact?.mobile || '—';
    const payAmt = app.payment?.amount ?? 157;
    const payStatus = app.payment?.status || 'Pending';

    return `
      <tr>
        <td>
          <span class="font-mono font-bold text-primary">${app.id}</span>
          <span class="text-xs text-muted block">${app.category || 'Individual'}</span>
        </td>
        <td>
          <strong>${applicantName}</strong>
          <span class="text-xs text-muted block"><i class="fa-solid fa-phone"></i> ${mobile}</span>
        </td>
        <td><span class="text-xs">${app.createdAt || 'Recent'}</span></td>
        <td>${docBadge}</td>
        <td>
          <span class="doc-badge-pill verified font-bold">₹${payAmt} (${payStatus})</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${app.status}</span>
        </td>
        <td>
          <button class="btn-sm-primary" onclick="window.openApplicationWorkspace('${app.id}')">
            <i class="fa-solid fa-folder-open"></i> Workspace
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Mobile Applications Cards Container
  const mobileList = document.getElementById('admin-apps-cards-list');
  if (mobileList) {
    mobileList.innerHTML = apps.map(app => {
      const applicantName = getApplicantFullName(app);
      const statusClass = (app.status || 'under-review').toLowerCase().replace(/\s+/g, '-');
      const payAmt = app.payment?.amount ?? 157;
      const payStatus = app.payment?.status || 'Pending';
      const docs = app.documents ? Object.values(app.documents) : [];
      const verifiedDocs = docs.filter(d => d && d.status === 'Verified').length;
      return `
        <div class="admin-app-mobile-card" onclick="window.openApplicationWorkspace('${app.id}')" style="cursor:pointer;">
          <div class="admin-app-card-head">
            <div class="admin-app-card-applicant">
              <div class="admin-app-card-avatar"><i class="fa-regular fa-user"></i></div>
              <div>
                <span class="font-mono text-xs font-bold text-primary block">${app.id}</span>
                <strong class="text-sm text-slate-800">${applicantName}</strong>
              </div>
            </div>
            <span class="status-badge ${statusClass}">${app.status}</span>
          </div>
          <div class="admin-app-card-badges">
            <span class="text-xs text-muted"><i class="fa-solid fa-phone"></i> ${app.contact?.mobile || '—'}</span>
            <span class="doc-badge-pill verified font-bold">₹${payAmt} (${payStatus})</span>
            <span class="doc-badge-pill pending text-2xs">${verifiedDocs}/5 Docs</span>
          </div>
          <div class="admin-app-card-foot">
            <span class="text-xs text-muted"><i class="fa-regular fa-calendar"></i> ${app.createdAt || 'Recent'}</span>
            <button class="btn-sm-primary" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation(); window.openApplicationWorkspace('${app.id}')">
              <i class="fa-solid fa-folder-open"></i> Workspace
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Global openers
export function openApplicationDetailsModal(appId: string) {
  openApplicationWorkspace(appId);
}

(window as any).openApplicationWorkspace = (appId: string) => {
  openApplicationWorkspace(appId);
};

(window as any).openApplicationDetailsModal = (appId: string) => {
  openApplicationWorkspace(appId);
};

export function openApplicationWorkspace(appId: string) {
  const app = repo.getApplicationById(appId);
  if (!app) return;

  state.selectedAppForAdminModal = app;

  // Switch Admin View to Workspace
  document.querySelectorAll('#admin-content-viewport .admin-view').forEach(v => v.classList.remove('active'));
  const wsView = document.getElementById('view-admin-app-workspace');
  if (wsView) wsView.classList.add('active');

  // Populate Compact Header
  const hdrId = document.getElementById('ws-hdr-app-id');
  const hdrName = document.getElementById('ws-hdr-name');
  const hdrDate = document.getElementById('ws-hdr-date');
  const hdrStatus = document.getElementById('ws-hdr-status');
  const hdrPayStatus = document.getElementById('ws-hdr-pay-status');
  const hdrDocStatus = document.getElementById('ws-hdr-doc-status');
  const hdrProvStatus = document.getElementById('ws-hdr-prov-status');
  const hdrUpdated = document.getElementById('ws-hdr-updated');

  const applicantName = getApplicantFullName(app);
  const statusClass = (app.status || 'under-review').toLowerCase().replace(/\s+/g, '-');
  const docs = app.documents ? Object.values(app.documents) : [];
  const verifiedDocs = docs.filter(d => d && d.status === 'Verified').length;
  const rejectedDocs = docs.filter(d => d && d.status === 'Rejected').length;

  if (hdrId) hdrId.textContent = app.id;
  if (hdrName) hdrName.textContent = `${app.applicant?.title || ''} ${applicantName}`.trim();
  if (hdrDate) hdrDate.innerHTML = `<i class="fa-regular fa-calendar"></i> Submitted: ${app.createdAt || 'Recent'}`;
  
  if (hdrStatus) {
    hdrStatus.className = `status-badge ${statusClass}`;
    hdrStatus.textContent = app.status;
  }

  if (hdrPayStatus) {
    const payClass = app.payment?.status === 'Successful' ? 'verified' : (app.payment?.status === 'Pending' ? 'pending' : 'rejected');
    hdrPayStatus.className = `doc-badge-pill ${payClass} font-bold`;
    hdrPayStatus.textContent = `₹${app.payment?.amount ?? 157} (${app.payment?.status || 'Pending'})`;
  }

  if (hdrDocStatus) {
    if (rejectedDocs > 0) {
      hdrDocStatus.className = 'doc-badge-pill rejected';
      hdrDocStatus.textContent = `${rejectedDocs} Rejected`;
    } else if (verifiedDocs === 5) {
      hdrDocStatus.className = 'doc-badge-pill verified';
      hdrDocStatus.textContent = 'All 5 Verified';
    } else {
      hdrDocStatus.className = 'doc-badge-pill pending';
      hdrDocStatus.textContent = `${verifiedDocs}/5 Verified`;
    }
  }

  if (hdrProvStatus) {
    hdrProvStatus.textContent = app.provider?.name || 'Sandbox Simulation';
  }

  if (hdrUpdated) {
    hdrUpdated.textContent = app.updatedAt || 'Recent';
  }

  // Setup Workspace Tab Switching
  document.querySelectorAll('#ws-tabs-nav .ws-tab-btn').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      document.querySelectorAll('#ws-tabs-nav .ws-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetPaneId = btn.getAttribute('data-ws-pane');
      document.querySelectorAll('.ws-pane').forEach(p => p.classList.add('hidden'));
      if (targetPaneId) {
        const targetPane = document.getElementById(targetPaneId);
        if (targetPane) {
          targetPane.classList.remove('hidden');
          renderWsPaneById(targetPaneId, app);
        }
      }
    };
  });

  // Determine active tab or default to overview
  const activeTabBtn = document.querySelector('#ws-tabs-nav .ws-tab-btn.active') as HTMLButtonElement;
  const currentPaneId = activeTabBtn ? activeTabBtn.getAttribute('data-ws-pane') || 'ws-pane-overview' : 'ws-pane-overview';

  document.querySelectorAll('.ws-pane').forEach(p => p.classList.add('hidden'));
  const currentPane = document.getElementById(currentPaneId);
  if (currentPane) {
    currentPane.classList.remove('hidden');
    renderWsPaneById(currentPaneId, app);
  }

  repo.logAudit('Application Workspace Opened', `Officer opened workspace for ${app.id} (${applicantName})`, app.id);
}

function renderWsPaneById(paneId: string, app: PANApplication) {
  switch (paneId) {
    case 'ws-pane-overview':
      renderWsTabOverview(app);
      break;
    case 'ws-pane-personal':
      renderWsTabPersonal(app);
      break;
    case 'ws-pane-contact':
      renderWsTabContact(app);
      break;
    case 'ws-pane-address':
      renderWsTabAddress(app);
      break;
    case 'ws-pane-app-details':
      renderWsTabAppDetails(app);
      break;
    case 'ws-pane-documents':
      renderWsTabDocuments(app);
      break;
    case 'ws-pane-payment':
      renderWsTabPayment(app);
      break;
    case 'ws-pane-provider':
      renderWsTabProvider(app);
      break;
    case 'ws-pane-notes':
      renderWsTabNotes(app);
      break;
    case 'ws-pane-support':
      renderWsTabSupport(app);
      break;
    case 'ws-pane-activity':
      renderWsTabActivity(app);
      break;
    default:
      renderWsTabOverview(app);
  }
}

/* ============================================================
   TAB 1: OVERVIEW PANE RENDERER
   ============================================================ */
function renderWsTabOverview(app: PANApplication) {
  const container = document.getElementById('ws-pane-overview');
  if (!container) return;

  const applicantName = getApplicantFullName(app);
  const statusClass = (app.status || 'under-review').toLowerCase().replace(/\s+/g, '-');
  const docs = app.documents ? Object.values(app.documents) : [];
  const verifiedDocs = docs.filter(d => d && d.status === 'Verified').length;
  const isPaid = app.payment?.status === 'Successful';
  const isCompleted = app.status === 'Completed';
  const isSubmitted = ['Submitted to Provider', 'Processing', 'Completed'].includes(app.status);

  // 9-Step Progress Milestones
  const steps = [
    { title: 'Application Created', sub: app.createdAt || 'Recent', completed: true, active: false },
    { title: 'Details Completed', sub: 'Citizen Form 49A', completed: true, active: false },
    { title: 'Documents Uploaded', sub: '5 Documents Attached', completed: true, active: false },
    { title: 'Documents Verified', sub: `${verifiedDocs}/5 Verified`, completed: verifiedDocs === 5, active: verifiedDocs > 0 && verifiedDocs < 5 },
    { title: 'Payment Completed', sub: `₹${app.payment?.amount ?? 157} Paid`, completed: isPaid, active: !isPaid },
    { title: 'Ready for Submission', sub: 'Officer Cleared', completed: verifiedDocs === 5 && isPaid, active: false },
    { title: 'Submitted to Provider', sub: app.provider?.acknowledgementNumber ? `Ack #${app.provider.acknowledgementNumber.slice(0, 8)}...` : 'Sandbox Queue', completed: isSubmitted, active: app.status === 'Submitted to Provider' },
    { title: 'Processing', sub: 'Assessment Officer', completed: isCompleted, active: app.status === 'Processing' },
    { title: 'Completed & Dispatched', sub: app.panNumber ? `PAN: ${app.panNumber}` : 'Final Delivery', completed: isCompleted, active: false },
  ];

  container.innerHTML = `
    <!-- Top 6 Summary Cards -->
    <div class="ws-field-grid-4 mb-4">
      <div class="admin-stat-card">
        <div class="stat-header">
          <span>Applicant Name</span>
          <i class="fa-regular fa-user text-primary"></i>
        </div>
        <strong class="stat-value text-base">${applicantName}</strong>
        <span class="stat-trend">${app.applicant?.gender || 'Individual'} • ${app.applicant?.dob || 'DOB'}</span>
      </div>

      <div class="admin-stat-card">
        <div class="stat-header">
          <span>Application ID</span>
          <i class="fa-solid fa-id-card-clip text-blue"></i>
        </div>
        <strong class="stat-value text-base font-mono">${app.id}</strong>
        <span class="stat-trend">Category: ${app.category || 'Individual'}</span>
      </div>

      <div class="admin-stat-card">
        <div class="stat-header">
          <span>Submission Date</span>
          <i class="fa-regular fa-calendar text-muted"></i>
        </div>
        <strong class="stat-value text-base">${app.createdAt || 'Recent'}</strong>
        <span class="stat-trend">Last: ${app.updatedAt || 'Recent'}</span>
      </div>

      <div class="admin-stat-card">
        <div class="stat-header">
          <span>Current Status</span>
          <i class="fa-solid fa-circle-notch text-amber"></i>
        </div>
        <div>
          <span class="status-badge ${statusClass} text-xs">${app.status}</span>
        </div>
        <span class="stat-trend mt-1 block">Live workflow state</span>
      </div>

      <div class="admin-stat-card">
        <div class="stat-header">
          <span>Payment Status</span>
          <i class="fa-solid fa-indian-rupee-sign text-green"></i>
        </div>
        <strong class="stat-value text-base text-green">₹${app.payment?.amount ?? 157}.00</strong>
        <span class="stat-trend">${app.payment?.status || 'Pending'} • ${app.payment?.transactionId || 'Txn'}</span>
      </div>

      <div class="admin-stat-card">
        <div class="stat-header">
          <span>Document Status</span>
          <i class="fa-solid fa-folder-check text-indigo-600"></i>
        </div>
        <strong class="stat-value text-base text-indigo-600">${verifiedDocs}/5 Verified</strong>
        <span class="stat-trend">${docs.length - verifiedDocs} Pending Officer Review</span>
      </div>
    </div>

    <!-- 9-Step Clean Visual Timeline -->
    <div class="ws-progress-timeline-container">
      <div class="ws-timeline-header">
        <h4><i class="fa-solid fa-bars-progress text-primary"></i> Application Progress Timeline</h4>
        <span class="text-xs text-muted">Real-time status transition pathway</span>
      </div>

      <div class="ws-timeline-stepper">
        ${steps.map((st, idx) => {
          let stateCls = '';
          let icon = (idx + 1).toString();
          if (st.completed) {
            stateCls = 'completed';
            icon = '<i class="fa-solid fa-check"></i>';
          } else if (st.active) {
            stateCls = 'active';
            icon = '<i class="fa-solid fa-spinner fa-spin"></i>';
          }
          return `
            <div class="ws-step ${stateCls}">
              <div class="ws-step-node">${icon}</div>
              <span class="ws-step-label">${st.title}</span>
              <span class="ws-step-date">${st.sub}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Quick Overview Snapshot Grid -->
    <div class="ws-field-grid-2">
      <div class="ws-detail-card">
        <div class="ws-detail-header">
          <h4><i class="fa-regular fa-address-card text-blue"></i> Identity & PAN Snapshot</h4>
        </div>
        <div class="ws-detail-body space-y-2 text-xs">
          <div class="flex justify-between border-b pb-1">
            <span class="text-muted">Name as on PAN:</span>
            <strong>${app.applicant?.panCardName || applicantName}</strong>
          </div>
          <div class="flex justify-between border-b pb-1">
            <span class="text-muted">Father's Name:</span>
            <strong>${app.applicant?.fatherName || '—'}</strong>
          </div>
          <div class="flex justify-between border-b pb-1">
            <span class="text-muted">Aadhaar Reference:</span>
            <strong class="font-mono">${app.applicant?.aadhaarNumber ? `•••• •••• ${app.applicant.aadhaarNumber.slice(-4)}` : '—'}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Allotted PAN:</span>
            <strong class="font-mono text-green font-bold">${app.panNumber || 'Pending Allotment'}</strong>
          </div>
        </div>
      </div>

      <div class="ws-detail-card">
        <div class="ws-detail-header">
          <h4><i class="fa-solid fa-truck-fast text-green"></i> Delivery & Contact Snapshot</h4>
        </div>
        <div class="ws-detail-body space-y-2 text-xs">
          <div class="flex justify-between border-b pb-1">
            <span class="text-muted">Primary Mobile:</span>
            <strong>+91 ${app.contact?.mobile || '—'}</strong>
          </div>
          <div class="flex justify-between border-b pb-1">
            <span class="text-muted">Delivery Email:</span>
            <strong>${app.contact?.email || '—'}</strong>
          </div>
          <div class="flex justify-between border-b pb-1">
            <span class="text-muted">Destination City:</span>
            <strong>${app.address?.city || ''}, ${app.address?.state || ''} - ${app.address?.pincode || ''}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Speed Post Tracking:</span>
            <strong class="font-mono text-primary">${app.courierTracking || 'Will be generated upon dispatch'}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 2: PERSONAL DETAILS PANE RENDERER
   ============================================================ */
function renderWsTabPersonal(app: PANApplication) {
  const container = document.getElementById('ws-pane-personal');
  if (!container) return;

  const applicantName = getApplicantFullName(app);

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-regular fa-user text-primary"></i> Personal Details (Form 49A)</h4>
        <button class="btn-ws-action" onclick="document.getElementById('ws-act-edit-details')?.click()">
          <i class="fa-solid fa-user-pen"></i> Edit Personal Details
        </button>
      </div>

      <div class="ws-detail-body">
        <div class="ws-field-grid-3">
          <div class="ws-field-item">
            <span class="ws-field-label">Title</span>
            <span class="ws-field-val">${app.applicant?.title || 'Shri'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">First Name</span>
            <span class="ws-field-val">${app.applicant?.firstName || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Last Name</span>
            <span class="ws-field-val">${app.applicant?.lastName || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Full Name</span>
            <span class="ws-field-val highlight-val">${applicantName}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Name to be Printed on PAN Card</span>
            <span class="ws-field-val">${app.applicant?.panCardName || applicantName}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Date of Birth</span>
            <span class="ws-field-val"><i class="fa-regular fa-calendar"></i> ${app.applicant?.dob || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Gender</span>
            <span class="ws-field-val">${app.applicant?.gender || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Father's Full Name</span>
            <span class="ws-field-val">${app.applicant?.fatherName || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Mother's Name</span>
            <span class="ws-field-val">${app.applicant?.motherName || 'Optional / Not Provided'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Parent Printed on Card Preference</span>
            <span class="ws-field-val">${app.applicant?.parentPreference || 'Father'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Applicant Category</span>
            <span class="ws-field-val">${app.category || 'Individual'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Citizenship / Residential Status</span>
            <span class="ws-field-val">Citizen of India (Resident)</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Aadhaar Number</span>
            <span class="ws-field-val font-mono">${app.applicant?.aadhaarNumber ? `${app.applicant.aadhaarNumber.slice(0, 4)} ${app.applicant.aadhaarNumber.slice(4, 8)} ${app.applicant.aadhaarNumber.slice(8, 12)}` : '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Name as per Aadhaar</span>
            <span class="ws-field-val">${app.applicant?.nameAsPerAadhaar || applicantName}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 3: CONTACT DETAILS PANE RENDERER
   ============================================================ */
function renderWsTabContact(app: PANApplication) {
  const container = document.getElementById('ws-pane-contact');
  if (!container) return;

  const mob = app.contact?.mobile || '';
  const email = app.contact?.email || '';

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-phone text-primary"></i> Contact & Communication Information</h4>
        <button class="btn-ws-action" onclick="document.getElementById('ws-act-contact-user')?.click()">
          <i class="fa-solid fa-paper-plane"></i> Send Direct Alert
        </button>
      </div>

      <div class="ws-detail-body">
        <div class="ws-field-grid-2">
          <div class="ws-field-item p-3 bg-slate-50 rounded border border-slate-200">
            <span class="ws-field-label">Mobile Number</span>
            <div class="ws-field-val mt-1">
              <span class="text-base font-mono">+91 ${mob}</span>
              <button class="ws-copy-btn" onclick="window.copyToClipboard('${mob}', 'Mobile Number')">
                <i class="fa-regular fa-copy"></i> Copy
              </button>
              <a href="tel:+91${mob}" class="ws-copy-btn">
                <i class="fa-solid fa-phone"></i> Call
              </a>
            </div>
            <span class="text-xs text-green mt-2 block"><i class="fa-solid fa-circle-check"></i> OTP Verified during signup & filing</span>
          </div>

          <div class="ws-field-item p-3 bg-slate-50 rounded border border-slate-200">
            <span class="ws-field-label">Email Address</span>
            <div class="ws-field-val mt-1">
              <span class="text-base font-mono">${email}</span>
              <button class="ws-copy-btn" onclick="window.copyToClipboard('${email}', 'Email Address')">
                <i class="fa-regular fa-copy"></i> Copy
              </button>
              <a href="mailto:${email}" class="ws-copy-btn">
                <i class="fa-solid fa-envelope"></i> Email
              </a>
            </div>
            <span class="text-xs text-slate-500 mt-2 block"><i class="fa-solid fa-circle-info"></i> Digitally signed e-PAN PDF will be dispatched to this email</span>
          </div>
        </div>

        <div class="mt-4 p-3 bg-blue-50 rounded border border-blue-200 text-xs text-blue-900">
          <strong><i class="fa-solid fa-shield-halved"></i> Data Privacy & Communication Rule:</strong>
          <p class="mt-1">In compliance with citizen data regulations, contact credentials are used strictly for status alerts, document clarification requests, and dispatch notices.</p>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 4: ADDRESS DETAILS PANE RENDERER
   ============================================================ */
function renderWsTabAddress(app: PANApplication) {
  const container = document.getElementById('ws-pane-address');
  if (!container) return;

  const addr = app.address || ({} as any);
  const formattedAddress = `${addr.flat || ''}${addr.premises ? ', ' + addr.premises : ''}, ${addr.street || ''}, ${addr.locality || ''}, ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}, India`;

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-location-dot text-primary"></i> Address & Dispatch Details</h4>
        <button class="btn-ws-action" onclick="window.copyToClipboard('${escapeHtml(formattedAddress)}', 'Mailing Address')">
          <i class="fa-regular fa-copy"></i> Copy Full Address
        </button>
      </div>

      <div class="ws-detail-body">
        <!-- Formatted Address Box for Courier Labels -->
        <div class="p-3 bg-slate-50 rounded border border-slate-200 mb-4">
          <span class="ws-field-label">Complete Physical Delivery Address</span>
          <p class="text-sm font-bold text-slate-800 mt-1 mb-2">${formattedAddress}</p>
          <div class="flex items-center gap-2">
            <span class="doc-badge-pill verified text-xs"><i class="fa-solid fa-truck"></i> Speed Post Deliverable</span>
            <span class="text-xs text-muted">PIN Code: ${addr.pincode || '—'}</span>
          </div>
        </div>

        <div class="ws-field-grid-3">
          <div class="ws-field-item">
            <span class="ws-field-label">Flat / Room / Door / Block No.</span>
            <span class="ws-field-val">${addr.flat || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Premises / Building / Village</span>
            <span class="ws-field-val">${addr.premises || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Road / Street / Post Office</span>
            <span class="ws-field-val">${addr.street || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Area / Locality / Taluka</span>
            <span class="ws-field-val">${addr.locality || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Town / City / District</span>
            <span class="ws-field-val">${addr.city || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">State / Union Territory</span>
            <span class="ws-field-val">${addr.state || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">PIN Code</span>
            <span class="ws-field-val font-mono font-bold">${addr.pincode || '—'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Country</span>
            <span class="ws-field-val">${addr.country || 'India'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Address Type</span>
            <span class="ws-field-val">Communication & Delivery Address</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 5: APPLICATION DETAILS PANE RENDERER
   ============================================================ */
function renderWsTabAppDetails(app: PANApplication) {
  const container = document.getElementById('ws-pane-app-details');
  if (!container) return;

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-file-lines text-primary"></i> Application & Filing Specifications</h4>
        <button class="btn-ws-action" onclick="downloadApplicationDossier(state.selectedAppForAdminModal!)">
          <i class="fa-solid fa-file-arrow-down"></i> Print Dossier
        </button>
      </div>

      <div class="ws-detail-body">
        <div class="ws-field-grid-3">
          <div class="ws-field-item">
            <span class="ws-field-label">Application ID</span>
            <span class="ws-field-val font-mono font-bold text-primary">${app.id}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Form Type</span>
            <span class="ws-field-val">Form 49A (Indian Citizen)</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Card Preference</span>
            <span class="ws-field-val">${app.panType || 'Physical Laminated PAN + Digitally Signed e-PAN'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Filing Channel</span>
            <span class="ws-field-val">${app.source || 'Online Citizen Self-Service Portal / WebView'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Submission Date</span>
            <span class="ws-field-val">${app.createdAt || 'Recent'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Last Modified Date</span>
            <span class="ws-field-val">${app.updatedAt || 'Recent'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Target Service SLA</span>
            <span class="ws-field-val">7-10 Working Days Delivery</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">User Account ID</span>
            <span class="ws-field-val font-mono">${app.userId}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Verification Mode</span>
            <span class="ws-field-val">Document Upload & Officer Verification</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 6: DOCUMENTS PANE RENDERER (DOCUMENT CENTER)
   ============================================================ */
function renderWsTabDocuments(app: PANApplication) {
  const container = document.getElementById('ws-pane-documents');
  if (!container) return;

  const docs = app.documents || {};
  const docList: Array<{ key: keyof PANApplication['documents']; doc: DocumentItem }> = [
    { key: 'poi', doc: docs.poi },
    { key: 'poa', doc: docs.poa },
    { key: 'dob', doc: docs.dob },
    { key: 'photo', doc: docs.photo },
    { key: 'signature', doc: docs.signature },
  ];

  const verifiedCount = docList.filter(d => d.doc && d.doc.status === 'Verified').length;

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-folder-tree text-indigo-600"></i> Document Center (${verifiedCount}/5 Verified)</h4>
        <div class="flex items-center gap-2">
          ${verifiedCount < 5 ? `
            <button class="btn-sm-primary" style="background:#15803d;" onclick="window.adminBatchVerifyDocs('${app.id}')">
              <i class="fa-solid fa-check-double"></i> Verify All 5 Docs
            </button>
          ` : '<span class="doc-badge-pill verified font-bold"><i class="fa-solid fa-circle-check"></i> All 5 Verified</span>'}
        </div>
      </div>

      <div class="ws-detail-body">
        <div class="ws-doc-cards-grid">
          ${docList.map(({ key, doc }) => {
            const isVerified = doc.status === 'Verified';
            const isRejected = doc.status === 'Rejected';
            const statusClass = doc.status.toLowerCase().replace(/\s+/g, '-');

            return `
              <div class="ws-doc-card-item">
                <div class="ws-doc-card-top">
                  <div class="ws-doc-thumbnail-wrap" onclick="window.previewDocumentImage('${doc.url}', '${escapeHtml(doc.name)}', '${app.id}')" title="Click to inspect preview">
                    <img src="${doc.url}" alt="${doc.name}" />
                  </div>
                  <div class="ws-doc-info-block">
                    <span class="ws-doc-title">${doc.name}</span>
                    <span class="ws-doc-meta">${doc.fileName} (${doc.fileSize})</span>
                    <div>
                      <span class="doc-badge-pill ${statusClass}">${doc.status}</span>
                    </div>
                    ${isRejected ? `<span class="text-rose-600 text-xs font-semibold mt-1 block">${doc.rejectionReason}</span>` : ''}
                  </div>
                </div>

                <div class="ws-doc-actions-row">
                  <button class="btn-card-action" onclick="window.previewDocumentImage('${doc.url}', '${escapeHtml(doc.name)}', '${app.id}')">
                    <i class="fa-solid fa-eye"></i> View
                  </button>
                  <button class="btn-card-action" onclick="window.downloadSecureDocument('${doc.url}', '${doc.fileName}', '${app.id}')">
                    <i class="fa-solid fa-download"></i> Download
                  </button>
                  ${!isVerified ? `
                    <button class="btn-sm-primary" style="background:#15803d;padding:5px 10px;" onclick="window.adminVerifyDocument('${app.id}', '${key}')">
                      <i class="fa-solid fa-check"></i> Verify
                    </button>
                  ` : ''}
                  ${!isRejected ? `
                    <button class="btn-danger" style="padding:5px 10px;font-size:11px;" onclick="window.adminPromptRejectDocument('${app.id}', '${key}')">
                      <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 7: PAYMENT DETAILS PANE RENDERER
   ============================================================ */
function renderWsTabPayment(app: PANApplication) {
  const container = document.getElementById('ws-pane-payment');
  if (!container) return;

  const pay = app.payment || ({} as any);
  const statusClass = (pay.status || 'Pending').toLowerCase();
  const amt = pay.amount ?? 157;
  const base = pay.baseFee ?? 107;
  const svc = pay.serviceFee ?? 25;
  const tax = pay.taxes ?? 25;

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-indian-rupee-sign text-green"></i> Payment Information & Fee Audit</h4>
        <div class="flex items-center gap-2">
          <button class="btn-ws-action" onclick="document.getElementById('modal-admin-payment-action')?.classList.remove('hidden')">
            <i class="fa-solid fa-pen-to-square"></i> Reconcile / Refund
          </button>
        </div>
      </div>

      <div class="ws-detail-body">
        <div class="ws-field-grid-2 mb-4">
          <!-- Fee Card -->
          <div class="p-4 bg-slate-50 rounded border border-slate-200">
            <span class="ws-field-label">Total Payable Amount</span>
            <strong class="text-3xl text-primary font-bold block mt-1">₹${amt}.00</strong>
            <span class="doc-badge-pill ${statusClass === 'successful' ? 'verified' : (statusClass === 'pending' ? 'pending' : 'rejected')} font-bold mt-2 inline-block">
              Payment Status: ${pay.status || 'Pending'}
            </span>

            <div class="border-t mt-3 pt-3 text-xs space-y-1">
              <div class="flex justify-between">
                <span class="text-muted">Application Base Fee:</span>
                <strong>₹${base}.00</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Service & Platform Fee:</span>
                <strong>₹${svc}.00</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Applicable Taxes (GST 18%):</span>
                <strong>₹${tax}.00</strong>
              </div>
              <div class="flex justify-between font-bold border-t pt-1">
                <span>Total Received:</span>
                <span>₹${amt}.00</span>
              </div>
            </div>
          </div>

          <!-- Transaction Identifiers -->
          <div class="p-4 bg-slate-50 rounded border border-slate-200 text-xs space-y-3">
            <div>
              <span class="ws-field-label">Transaction ID</span>
              <div class="flex items-center gap-2 mt-1">
                <strong class="text-sm font-mono">${pay.transactionId || '—'}</strong>
                ${pay.transactionId ? `<button class="ws-copy-btn" onclick="window.copyToClipboard('${pay.transactionId}', 'Transaction ID')"><i class="fa-regular fa-copy"></i> Copy</button>` : ''}
              </div>
            </div>

            <div>
              <span class="ws-field-label">Payment Method</span>
              <strong class="text-sm block mt-1">${(pay.method || 'upi').toUpperCase()} (Unified Payments Interface)</strong>
            </div>

            <div>
              <span class="ws-field-label">Payment Settlement Time</span>
              <strong class="text-sm block mt-1">${pay.paidAt || app.createdAt || 'Recent'}</strong>
            </div>

            <div>
              <span class="ws-field-label">Bank / Gateway Reference</span>
              <strong class="text-sm font-mono block mt-1">${pay.gatewayRef || `UPI-${pay.transactionId || 'REF'}`}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 8: PROVIDER / SUBMISSION PANE RENDERER
   ============================================================ */
function renderWsTabProvider(app: PANApplication) {
  const container = document.getElementById('ws-pane-provider');
  if (!container) return;

  const prov = app.provider || ({} as any);

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-server text-indigo-600"></i> Provider Submission & PAN Allotment (Sandbox / Live)</h4>
        <button class="btn-ws-action highlight-green" onclick="document.getElementById('ws-act-assign-pan')?.click()">
          <i class="fa-solid fa-id-card"></i> Allot PAN & Courier Details
        </button>
      </div>

      <div class="ws-detail-body">
        <div class="card-notice mb-4">
          <i class="fa-solid fa-circle-info text-primary"></i>
          <div>
            <strong>Authorized Provider Mode Notice:</strong>
            <p>This portal operates in <strong>Sandbox / Simulation Mode</strong> unless authorized live NSDL / Protean API credentials are provisioned in backend environment. Dispatches and acknowledgements are safely audited.</p>
          </div>
        </div>

        <div class="ws-field-grid-3">
          <div class="ws-field-item">
            <span class="ws-field-label">Provider Name</span>
            <span class="ws-field-val">${prov.name || 'Protean / UTIITSL (Sandbox Simulation)'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Provider Status</span>
            <span class="ws-field-val"><span class="provider-tag sandbox">${prov.status || 'Sandbox Mode'}</span></span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Acknowledgement Number</span>
            <span class="ws-field-val font-mono font-bold">${prov.acknowledgementNumber || 'Not Generated Yet'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Submission Date</span>
            <span class="ws-field-val">${prov.submissionDate || 'Pending Submission'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Permanent Account Number (PAN)</span>
            <span class="ws-field-val font-mono font-bold text-green">${app.panNumber || '<span class="text-muted">Not Allotted</span>'}</span>
          </div>

          <div class="ws-field-item">
            <span class="ws-field-label">Speed Post Consignment Tracking</span>
            <span class="ws-field-val font-mono">${app.courierTracking || '<span class="text-muted">Not Dispatched</span>'}</span>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t flex items-center gap-3">
          <button class="btn-sm-primary" onclick="window.adminSimulateProviderSubmission('${app.id}')">
            <i class="fa-solid fa-paper-plane"></i> Simulate Provider Submission (Sandbox)
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 9: NOTES PANE RENDERER (INTERNAL ADMIN NOTES)
   ============================================================ */
function renderWsTabNotes(app: PANApplication) {
  const container = document.getElementById('ws-pane-notes');
  if (!container) return;

  const notes = app.internalNotes || [];

  container.innerHTML = `
    <div class="ws-notes-container">
      <!-- Note Composer -->
      <div class="ws-note-composer">
        <h5 class="font-bold text-slate-800 mb-2 flex items-center gap-2">
          <i class="fa-solid fa-pen-to-square text-primary"></i> Add Internal Officer Note
        </h5>
        <div class="flex gap-2 mb-2">
          <select id="ws-note-category" class="select-sm bg-white font-semibold">
            <option value="General">General Note</option>
            <option value="Document Discrepancy">Document Discrepancy</option>
            <option value="Payment Verification">Payment Verification</option>
            <option value="Urgent Officer Flag">Urgent Flag</option>
          </select>
        </div>
        <textarea id="ws-input-note-text" rows="2" class="w-full text-xs p-2 border rounded" placeholder="Type internal officer observation... (visible to staff only)"></textarea>
        <div class="flex justify-end mt-2">
          <button class="btn-sm-primary" onclick="window.adminAddInternalNote('${app.id}')">
            <i class="fa-solid fa-plus"></i> Add Note
          </button>
        </div>
      </div>

      <!-- Notes Feed -->
      <div class="space-y-2">
        ${notes.length === 0 ? `
          <div class="p-4 text-center text-muted text-xs bg-slate-50 rounded border border-slate-200">
            No internal notes recorded for this application yet.
          </div>
        ` : notes.map(n => `
          <div class="ws-note-card">
            <div class="ws-note-header">
              <span class="ws-note-author"><i class="fa-solid fa-user-shield"></i> ${n.admin}</span>
              <span class="ws-note-time"><i class="fa-regular fa-clock"></i> ${n.timestamp}</span>
            </div>
            <p class="ws-note-body">${escapeHtml(n.text)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 10: SUPPORT & COMMUNICATION PANE RENDERER
   ============================================================ */
function renderWsTabSupport(app: PANApplication) {
  const container = document.getElementById('ws-pane-support');
  if (!container) return;

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-headset text-primary"></i> Contact Applicant & In-App Notification</h4>
      </div>

      <div class="ws-detail-body">
        <div class="mb-3">
          <span class="text-xs text-muted block mb-1">Quick Message Templates:</span>
          <div class="flex flex-wrap gap-2">
            <button class="btn-card-action" onclick="window.setSupportTemplate('Aadhaar Card Clear Copy Needed', 'Your uploaded Aadhaar card is blurred or unreadable. Please log in and upload a clear full-page photo to proceed with verification.')">
              Aadhaar Blurred
            </button>
            <button class="btn-card-action" onclick="window.setSupportTemplate('Signature Re-upload Needed', 'The signature provided is faint or cut off. Please re-upload your signature on plain white paper.')">
              Signature Faint
            </button>
            <button class="btn-card-action" onclick="window.setSupportTemplate('Application Forwarded to NSDL', 'Good news! Your PAN application has passed document screening and was forwarded to the Assessment Officer.')">
              Forwarded Notice
            </button>
            <button class="btn-card-action" onclick="window.setSupportTemplate('PAN Allotted & Dispatched', 'Congratulations! Your PAN Card has been allotted and dispatched via Speed Post. Check tracking in your portal.')">
              PAN Dispatched
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="ws-input-msg-title">Alert Title</label>
          <input type="text" id="ws-input-msg-title" placeholder="e.g. Document Verification Notice" />
        </div>

        <div class="form-group">
          <label for="ws-input-msg-text">Alert Message for Applicant</label>
          <textarea id="ws-input-msg-text" rows="3" placeholder="Type direct alert message that will pop up on the applicant's phone..."></textarea>
        </div>

        <div class="flex justify-end">
          <button class="btn-sm-primary" onclick="window.adminSendMessageToUser('${app.id}')">
            <i class="fa-solid fa-paper-plane"></i> Send In-App Notification
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TAB 11: ACTIVITY LOG PANE RENDERER
   ============================================================ */
function renderWsTabActivity(app: PANApplication) {
  const container = document.getElementById('ws-pane-activity');
  if (!container) return;

  const history = app.statusHistory || [];
  const auditLogs = repo.getAuditLogs().filter(l => l.targetAppId === app.id);

  container.innerHTML = `
    <div class="ws-detail-card">
      <div class="ws-detail-header">
        <h4><i class="fa-solid fa-clock-rotate-left text-primary"></i> Application Status Audit & Activity Log</h4>
      </div>

      <div class="ws-detail-body">
        <div class="ws-activity-timeline">
          ${history.map(h => `
            <div class="ws-activity-item">
              <div class="ws-activity-dot"></div>
              <div class="ws-activity-content">
                <div class="flex justify-between items-center mb-1">
                  <strong>${h.status}</strong>
                  <span class="text-xs text-muted">${h.timestamp}</span>
                </div>
                <p class="text-slate-600 mb-1">${escapeHtml(h.note)}</p>
                <span class="text-2xs text-muted block"><i class="fa-solid fa-user-check"></i> Action by: ${h.updatedBy}</span>
              </div>
            </div>
          `).join('')}

          ${auditLogs.map(l => `
            <div class="ws-activity-item">
              <div class="ws-activity-dot" style="border-color:#10b981;"></div>
              <div class="ws-activity-content">
                <div class="flex justify-between items-center mb-1">
                  <strong class="text-emerald-700">${l.action}</strong>
                  <span class="text-xs text-muted">${l.timestamp}</span>
                </div>
                <p class="text-slate-600 mb-1">${escapeHtml(l.details)}</p>
                <span class="text-2xs text-muted block"><i class="fa-solid fa-shield-halved"></i> Officer: ${l.admin}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Global Helpers for Workspace Actions
(window as any).copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} copied to clipboard!`, 'success');
  }).catch(() => {
    showToast(`Copied ${label}`, 'success');
  });
};

(window as any).adminBatchVerifyDocs = (appId: string) => {
  const app = repo.getApplicationById(appId);
  if (!app) return;
  const docKeys: Array<keyof PANApplication['documents']> = ['poi', 'poa', 'dob', 'photo', 'signature'];
  docKeys.forEach(k => {
    repo.updateDocumentStatus(appId, k, 'Verified', '', 'Admin (Officer)');
  });
  showToast('All 5 applicant documents verified successfully!', 'success');
  openApplicationWorkspace(appId);
  renderAdminApplicationsTable();
  refreshAdminDashboard();
};

(window as any).adminAddInternalNote = (appId: string) => {
  const cat = (document.getElementById('ws-note-category') as HTMLSelectElement)?.value || 'General';
  const textEl = document.getElementById('ws-input-note-text') as HTMLTextAreaElement;
  const text = textEl?.value.trim();
  if (!text) {
    showToast('Please type a note before saving.', 'error');
    return;
  }
  repo.addInternalNote(appId, text, `Officer (${cat})`);
  showToast('Internal officer note added.', 'success');
  openApplicationWorkspace(appId);
  // Re-render notes tab
  const btnNotes = document.querySelector('[data-ws-pane="ws-pane-notes"]') as HTMLButtonElement;
  btnNotes?.click();
};

(window as any).setSupportTemplate = (title: string, message: string) => {
  const titleInput = document.getElementById('ws-input-msg-title') as HTMLInputElement;
  const textInput = document.getElementById('ws-input-msg-text') as HTMLTextAreaElement;
  if (titleInput) titleInput.value = title;
  if (textInput) textInput.value = message;
};

(window as any).adminSendMessageToUser = (appId: string) => {
  const app = repo.getApplicationById(appId);
  if (!app) return;
  const title = (document.getElementById('ws-input-msg-title') as HTMLInputElement)?.value.trim();
  const text = (document.getElementById('ws-input-msg-text') as HTMLTextAreaElement)?.value.trim();
  if (!text) {
    showToast('Please enter message text.', 'error');
    return;
  }
  repo.addNotification({
    id: `notif-${Date.now()}`,
    userId: app.userId,
    title: title || 'Notice from Assessment Officer',
    message: text,
    type: 'alert',
    read: false,
    createdAt: new Date().toLocaleString(),
  });
  repo.logAudit('Officer Message Sent', `Message sent to ${app.userId}: "${text.slice(0, 40)}..."`, appId);
  showToast(`Alert message sent directly to applicant ${getApplicantFullName(app)}!`, 'success');
  (document.getElementById('ws-input-msg-title') as HTMLInputElement).value = '';
  (document.getElementById('ws-input-msg-text') as HTMLTextAreaElement).value = '';
};

(window as any).adminSimulateProviderSubmission = (appId: string) => {
  const ack = `88${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
  repo.updateProviderStatus(appId, 'Submitted', ack, 'Simulated NSDL Provider Gateway Queue');
  repo.updateApplicationStatus(appId, 'Submitted to Provider', `Queued to NSDL Provider with Ack No: ${ack}`, 'Admin (Officer)');
  showToast(`Submitted to Provider! Acknowledgement Number: ${ack}`, 'success');
  openApplicationWorkspace(appId);
  renderAdminApplicationsTable();
  refreshAdminDashboard();
};

function downloadApplicationDossier(app: PANApplication) {
  const applicantName = getApplicantFullName(app);
  const addr = app.address;
  const formattedAddress = `${addr?.flat || ''}${addr?.premises ? ', ' + addr.premises : ''}, ${addr?.street || ''}, ${addr?.locality || ''}, ${addr?.city || ''}, ${addr?.state || ''} - ${addr?.pincode || ''}, India`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Pop-up blocked. Please allow pop-ups to print dossier.', 'warning');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>PAN Application Dossier - ${app.id}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; font-size: 13px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 20px; font-weight: 800; color: #1b3a57; margin: 0; }
          .sub { font-size: 11px; color: #64748b; }
          .section { margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; }
          .section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: #1b3a57; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; }
          .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
          .field { font-size: 11px; }
          .field span { display: block; color: #64748b; text-transform: uppercase; font-size: 9px; }
          .watermark { background: #f8fafc; border: 1px dashed #94a3b8; padding: 10px; border-radius: 4px; font-size: 10px; color: #475569; margin-top: 20px; }
          @media print { .no-print { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">CITIZEN PAN CARD APPLICATION DOSSIER</h1>
            <span class="sub">Facilitation & Verification Summary • Form 49A</span>
          </div>
          <div style="text-align:right;">
            <strong style="font-family:monospace;font-size:16px;color:#1b3a57;">${app.id}</strong><br/>
            <span class="sub">Filing Date: ${app.createdAt || 'Recent'}</span>
          </div>
        </div>

        <div class="section">
          <h3>1. Applicant Personal Information</h3>
          <div class="grid-3">
            <div class="field"><span>Full Name</span><strong>${applicantName}</strong></div>
            <div class="field"><span>Name on PAN</span><strong>${app.applicant?.panCardName || applicantName}</strong></div>
            <div class="field"><span>Date of Birth</span><strong>${app.applicant?.dob || '—'}</strong></div>
            <div class="field"><span>Gender</span><strong>${app.applicant?.gender || '—'}</strong></div>
            <div class="field"><span>Father's Name</span><strong>${app.applicant?.fatherName || '—'}</strong></div>
            <div class="field"><span>Aadhaar Number</span><strong>${app.applicant?.aadhaarNumber ? `•••• •••• ${app.applicant.aadhaarNumber.slice(-4)}` : '—'}</strong></div>
          </div>
        </div>

        <div class="section">
          <h3>2. Communication & Delivery Details</h3>
          <div class="grid">
            <div class="field"><span>Primary Mobile</span><strong>+91 ${app.contact?.mobile || '—'}</strong></div>
            <div class="field"><span>Primary Email</span><strong>${app.contact?.email || '—'}</strong></div>
            <div class="field" style="grid-column: span 2;"><span>Delivery Address</span><strong>${formattedAddress}</strong></div>
          </div>
        </div>

        <div class="section">
          <h3>3. Fee Payment & Reconciliation</h3>
          <div class="grid-3">
            <div class="field"><span>Total Fee Paid</span><strong style="color:#15803d;font-size:14px;">₹${app.payment?.amount ?? 157}.00</strong></div>
            <div class="field"><span>Payment Status</span><strong>${app.payment?.status || 'Pending'}</strong></div>
            <div class="field"><span>Transaction ID</span><strong style="font-family:monospace;">${app.payment?.transactionId || '—'}</strong></div>
          </div>
        </div>

        <div class="section">
          <h3>4. Verification & Status Summary</h3>
          <div class="grid-3">
            <div class="field"><span>Application Status</span><strong>${app.status}</strong></div>
            <div class="field"><span>Provider Ack No</span><strong>${app.provider?.acknowledgementNumber || 'Pending'}</strong></div>
            <div class="field"><span>Allotted PAN</span><strong style="font-family:monospace;color:#15803d;">${app.panNumber || 'Under Processing'}</strong></div>
          </div>
        </div>

        <div class="watermark">
          <strong>FACILITATION & VERIFICATION RECORD:</strong> This document represents an authorized summary dossier prepared through the digital services portal. The applicant has submitted proof of identity, address, and date of birth in accordance with Form 49A rules.
        </div>

        <div style="margin-top:20px; text-align:center;" class="no-print">
          <button onclick="window.print()" style="padding:10px 20px;background:#1b3a57;color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer;">
            Print / Save as PDF
          </button>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  repo.logAudit('Dossier Downloaded', `Generated dossier printout for ${app.id}`, app.id);
}

function renderAdminDocRow(appId: string, docKey: string, doc: DocumentItem): string {
  const isVerified = doc.status === 'Verified';
  const isRejected = doc.status === 'Rejected';

  return `
    <div class="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs">
      <div class="flex items-center gap-3">
        <img src="${doc.url}" alt="${doc.name}" class="w-10 h-10 object-cover rounded border" />
        <div>
          <span class="font-bold text-slate-800">${doc.name}</span>
          <span class="text-slate-500 block">${doc.fileName} (${doc.fileSize})</span>
          <span class="doc-badge-pill ${doc.status.toLowerCase()}">${doc.status}</span>
          ${isRejected ? `<span class="text-rose-600 block text-2xs">${doc.rejectionReason}</span>` : ''}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-card-action" onclick="window.previewDocumentImage('${doc.url}', '${escapeHtml(doc.name)}', '${appId}')">
          <i class="fa-solid fa-eye"></i> View
        </button>
        <button class="btn-card-action" onclick="window.downloadSecureDocument('${doc.url}', '${doc.fileName}', '${appId}')">
          <i class="fa-solid fa-download"></i> Download
        </button>
        ${!isVerified ? `
          <button class="btn-sm-primary" style="background:#15803d;" onclick="window.adminVerifyDocument('${appId}', '${docKey}')">
            <i class="fa-solid fa-check"></i> Verify
          </button>
        ` : ''}
        ${!isRejected ? `
          <button class="btn-danger" style="padding:4px 8px;font-size:11px;" onclick="window.adminPromptRejectDocument('${appId}', '${docKey}')">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

// Global hooks for document preview, download, verify & reject
(window as any).previewDocumentImage = (url: string, title: string, appId: string) => {
  const modal = document.getElementById('modal-doc-viewer');
  const img = document.getElementById('doc-viewer-img') as HTMLImageElement;
  const tEl = document.getElementById('doc-viewer-title');
  const subEl = document.getElementById('doc-viewer-subtitle');
  const btnDownload = document.getElementById('btn-download-secure-doc');

  if (img) img.src = url;
  if (tEl) tEl.textContent = title;
  if (subEl) subEl.textContent = `Application: ${appId}`;

  if (btnDownload) {
    btnDownload.onclick = () => {
      (window as any).downloadSecureDocument(url, `${title.replace(/\s+/g, '_')}.png`, appId);
    };
  }

  if (modal) modal.classList.remove('hidden');
  repo.logAudit('Document Previewed', `Previewed ${title} for application ${appId}`, appId);
};

(window as any).downloadSecureDocument = (url: string, fileName: string, appId: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  repo.logAudit('Document Downloaded', `Secure download of ${fileName} by authorized admin`, appId);
  showToast(`Downloaded ${fileName} securely. Audit log recorded.`, 'success');
};

(window as any).adminVerifyDocument = (appId: string, docKey: keyof PANApplication['documents']) => {
  repo.updateDocumentStatus(appId, docKey, 'Verified', '', 'Admin (Officer)');
  showToast(`Document verified successfully!`, 'success');
  openApplicationDetailsModal(appId);
  renderAdminApplicationsTable();
  refreshAdminDashboard();
};

(window as any).adminPromptRejectDocument = (appId: string, docKey: keyof PANApplication['documents']) => {
  state.activeRejectDocKey = docKey;
  const modal = document.getElementById('modal-doc-reject');
  const textEl = document.getElementById('reject-reason-text') as HTMLTextAreaElement;
  if (textEl) textEl.value = 'Document is blurred or unclear. Please upload a clear photo or scan.';
  if (modal) modal.classList.remove('hidden');
};

function renderAdminUsersTable() {
  const tbody = document.getElementById('tbody-admin-users');
  if (!tbody) return;

  const users = repo.getUsers();
  tbody.innerHTML = users.map(u => {
    const userApps = repo.getUserApplications(u.id);
    return `
      <tr>
        <td class="font-mono text-xs">${u.id}</td>
        <td><strong>${u.name}</strong></td>
        <td>
          <span class="text-xs block">${u.mobile}</span>
          <span class="text-xs text-muted">${u.email}</span>
        </td>
        <td><span class="text-xs">${u.createdAt}</span></td>
        <td><span class="count-pill">${userApps.length}</span></td>
        <td><span class="doc-badge-pill verified">${u.status}</span></td>
        <td>
          <button class="btn-card-action" onclick="alert('User ${u.name} has ${userApps.length} applications.')">
            <i class="fa-solid fa-eye"></i> View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminPaymentsTable() {
  const tbody = document.getElementById('tbody-admin-payments');
  if (!tbody) return;

  const apps = repo.getApplications().filter(a => a.payment && a.payment.status === 'Successful');
  tbody.innerHTML = apps.map(a => `
    <tr>
      <td class="font-mono text-xs">${a.payment?.transactionId || '—'}</td>
      <td class="font-mono text-xs font-bold text-primary">${a.id}</td>
      <td>${getApplicantFullName(a)}</td>
      <td class="font-bold text-green">₹${a.payment?.amount ?? 157}</td>
      <td><span class="text-xs uppercase">${a.payment?.method || 'UPI'}</span></td>
      <td><span class="doc-badge-pill verified">${a.payment?.status || 'Successful'}</span></td>
      <td><span class="text-xs">${a.payment?.paidAt || a.createdAt || 'Recent'}</span></td>
      <td>
        <button class="btn-card-action" onclick="alert('Transaction ${a.payment?.transactionId || '—'} verified on gateway.')">
          <i class="fa-solid fa-receipt"></i> Verify
        </button>
      </td>
    </tr>
  `).join('');
}

function renderAdminTickets() {
  const container = document.getElementById('admin-tickets-container');
  if (!container) return;

  const tickets = repo.getTickets();
  if (tickets.length === 0) {
    container.innerHTML = '<p class="text-muted p-4">No support tickets found.</p>';
    return;
  }

  container.innerHTML = tickets.map(t => `
    <div class="bg-white p-3 rounded-lg border border-slate-200 mb-3 text-xs">
      <div class="flex justify-between items-start">
        <div>
          <span class="font-mono text-primary font-bold">${t.id}</span> - <strong>${t.subject}</strong>
          <span class="text-slate-500 block">From: ${t.userName} (${t.createdAt})</span>
        </div>
        <span class="doc-badge-pill ${t.status === 'Resolved' ? 'verified' : 'pending'}">${t.status}</span>
      </div>
      <p class="bg-slate-50 p-2 rounded mt-2 border border-slate-100 text-slate-700">${t.message}</p>
      ${t.adminReply ? `<div class="bg-green-50 p-2 rounded mt-2 text-green-900 border border-green-200"><strong>Our Reply:</strong> ${t.adminReply}</div>` : ''}
      <div class="mt-3 flex justify-end">
        <button class="btn-sm-primary" onclick="window.adminReplyTicketPrompt('${t.id}')">
          <i class="fa-solid fa-reply"></i> Reply to Applicant
        </button>
      </div>
    </div>
  `).join('');
}

(window as any).adminReplyTicketPrompt = (ticketId: string) => {
  const reply = prompt('Enter reply for the applicant:');
  if (reply) {
    repo.replyTicket(ticketId, reply);
    showToast('Reply dispatched to applicant!', 'success');
    renderAdminTickets();
  }
};

function renderAdminAuditLogs() {
  const tbody = document.getElementById('tbody-admin-audit');
  if (!tbody) return;

  const logs = repo.getAuditLogs();
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td class="text-xs text-slate-500 whitespace-nowrap">${l.timestamp}</td>
      <td class="text-xs font-bold text-slate-800">${l.admin}</td>
      <td><span class="doc-badge-pill approved font-bold">${l.action}</span></td>
      <td class="font-mono text-xs">${l.targetAppId || '—'}</td>
      <td class="text-xs text-slate-600">${l.details}</td>
    </tr>
  `).join('');
}

function exportApplicationsCSV() {
  const apps = repo.getApplications();
  if (apps.length === 0) {
    showToast('No applications to export.', 'info');
    return;
  }

  const headers = ['Application ID', 'Applicant Name', 'Mobile', 'Email', 'Aadhaar', 'Status', 'Payment Status', 'Amount', 'Date'];
  const rows = apps.map(a => [
    a.id,
    `"${getApplicantFullName(a)}"`,
    a.contact?.mobile || '',
    a.contact?.email || '',
    a.applicant?.aadhaarNumber || '',
    a.status || 'Under Review',
    a.payment?.status || 'Pending',
    a.payment?.amount ?? 157,
    `"${a.createdAt || ''}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PAN_Applications_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  repo.logAudit('CSV Export', `Exported ${apps.length} application records to CSV`);
  showToast('Applications exported to CSV successfully.', 'success');
}

/* ============================================================
   10. SKETCHWARE & HOPWEB APK EXPORT GUIDE MODAL
   ============================================================ */
function initApkGuideModal() {
  const btnApkGuide = document.getElementById('btn-apk-guide');
  const modal = document.getElementById('modal-apk-guide');
  const copyInput = document.getElementById('apk-app-url-input') as HTMLInputElement;
  const btnCopy = document.getElementById('btn-copy-apk-url');

  if (copyInput) {
    copyInput.value = window.location.href;
  }

  btnApkGuide?.addEventListener('click', () => {
    if (copyInput) copyInput.value = window.location.href;
    if (modal) modal.classList.remove('hidden');
  });

  btnCopy?.addEventListener('click', () => {
    if (copyInput) {
      navigator.clipboard.writeText(copyInput.value).then(() => {
        showToast('App URL copied to clipboard!', 'success');
      });
    }
  });

  // Guide Tabs
  document.querySelectorAll('.guide-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetPaneId = btn.getAttribute('data-guide-target');
      document.querySelectorAll('.guide-pane').forEach(p => p.classList.add('hidden'));

      if (targetPaneId) {
        document.getElementById(targetPaneId)?.classList.remove('hidden');
      }
    });
  });
}

/* ============================================================
   HELPER UTILITIES
   ============================================================ */
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function closeModal(modalId: string) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
