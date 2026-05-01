# Maintenance Request Form - Green Theme Update

## Summary
Updated the Manager Maintenance Tab to use the PrimeLiving green shade theme consistently throughout all UI elements.

## Changes Applied

### 1. Status Colors
- **In Progress**: Changed from `bg-blue-400/15 text-blue-400` to `bg-primary-400/15 text-primary-400`
- **Resolved**: Changed from `bg-green-400/15 text-green-500` to `bg-primary-500/15 text-primary-500`

### 2. Priority Colors
- **Low Priority**: Changed from `bg-blue-400/15 text-blue-400` to `bg-primary-300/15 text-primary-300`

### 3. UI Elements Updated

#### Maintenance ID Display
- Light mode: `text-blue-600` → `text-primary-700`

#### In Progress Badge
- `bg-blue-500/15 text-blue-400` → `bg-primary-500/15 text-primary-400`

#### Repairman Avatar
- Dark mode: Already using `bg-primary/15 text-primary`
- Light mode: `bg-blue-100 text-blue-700` → `bg-primary-100 text-primary-700`

#### Active Status Indicator
- `text-green-400` → `text-primary-400`

#### Request ID Badge
- Light mode: `bg-blue-50 text-blue-600` → `bg-primary-50 text-primary-600`

#### Photo Count Badges
- Light mode: `bg-blue-100 text-blue-700` → `bg-primary-100 text-primary-700`

### 4. Status Action Cards

#### "Ready to Start" Card (Pending Status)
- Border & Background:
  - Dark: `border-blue-500/30 bg-blue-500/5` → `border-primary-500/30 bg-primary-500/5`
  - Light: `border-blue-200 bg-blue-50` → `border-primary-200 bg-primary-50`
- Text: `text-blue-300/text-blue-700` → `text-primary-300/text-primary-700`
- Button: `bg-blue-600 hover:bg-blue-700` → `bg-primary-600 hover:bg-primary-700`

#### "In Progress" Status Card
- Border & Background:
  - Dark: `border-blue-500/30 bg-blue-500/5` → `border-primary-500/30 bg-primary-500/5`
  - Light: `border-blue-200 bg-blue-50` → `border-primary-200 bg-primary-50`
- Pulse Indicator: `bg-blue-500` → `bg-primary-500`
- Text: `text-blue-400/text-blue-600` → `text-primary-400/text-primary-600`

#### "Resolved" Status Card
- Border & Background:
  - Dark: `border-green-500/30 bg-green-500/5` → `border-primary-500/30 bg-primary-500/5`
  - Light: `border-green-200 bg-green-50` → `border-primary-200 bg-primary-50`
- Text: `text-green-400/text-green-700` → `text-primary-400/text-primary-700`
- Button: `bg-green-600 hover:bg-green-700` → `bg-primary-600 hover:bg-primary-700`

## Theme Colors Reference
Based on `tailwind.config.js`:

```javascript
primary: {
  DEFAULT: '#059669',  // Emerald-600
  50: '#ECFDF5',
  100: '#D1FAE5',
  200: '#A7F3D0',
  300: '#6EE7B7',
  400: '#34D399',
  500: '#10B981',
  600: '#059669',
  700: '#047857',
  800: '#065F46',
  900: '#064E3B',
}
```

## Design Pattern Maintained
- All interactive elements (buttons, badges, status indicators) now use the primary green shade
- Consistent color hierarchy: primary for positive/active states, yellow for pending/warning, red for urgent/error
- Dark/light mode compatibility preserved
- Hover and focus states use primary color variations

## Files Modified
- `frontend/src/components/manager/ManagerMaintenanceTab.tsx`

## Testing Recommendations
1. Verify all status badges display correctly in both dark and light modes
2. Check button hover states for smooth transitions
3. Ensure status action cards are visually distinct
4. Validate color contrast for accessibility
5. Test repairman assignment UI elements


---

## Email OTP Verification Modal Update

### File Modified
- `frontend/src/pages/LoginPage.tsx`

### Changes Applied

#### 1. Mail Icon Container
- Changed from `bg-blue-500/15` with `text-blue-500` to `bg-primary/15` with `text-primary`
- Now uses the green theme for the mail icon background

#### 2. Verify Button
- Changed from `bg-blue-600 hover:bg-blue-700` to `bg-primary hover:bg-primary/90`
- Consistent with other primary action buttons across the platform

#### 3. Resend Code Link
- Dark mode: `text-blue-400 hover:text-blue-300` → `text-primary-400 hover:text-primary-300`
- Light mode: `text-blue-600 hover:text-blue-700` → `text-primary-600 hover:text-primary-700`
- Maintains the green theme for interactive text elements

### Visual Impact
The Email OTP verification modal now matches the PrimeLiving green brand identity:
- Green mail icon background
- Green verify button
- Green resend code link
- Consistent with the overall platform design language


---

## Account Settings - Two-Factor Setup Update

### File Modified
- `frontend/src/components/shared/TwoFactorSetup.tsx`

### Changes Applied

#### 1. Email OTP Icon Container (Not Enabled State)
- Changed from `bg-blue-500/10` with `text-blue-500` to `bg-primary/10` with `text-primary`
- Now uses green theme when Email OTP is not yet enabled

#### 2. Enable Email OTP Button
- Changed from `bg-blue-600 hover:bg-blue-700` to `bg-primary hover:bg-primary/90`
- Matches the primary action button style across the platform

#### 3. Confirm & Enable Button (Verification Step)
- Changed from `bg-blue-600 hover:bg-blue-700` to `bg-primary hover:bg-primary/90`
- Consistent green theme for the verification confirmation button

### Visual Impact
The Email OTP setup flow in Account Settings now uses the green theme:
- Green mail icon when not enabled
- Green "Enable Email OTP" button
- Green "Confirm & Enable" button during verification
- Maintains green checkmark icon when already enabled
- Consistent with PrimeLiving's brand identity across all user roles (Owner, Manager, Tenant)

### Affected User Roles
This component is shared across:
- Owner Account Settings
- Manager Account Settings  
- Tenant Account Settings

All roles now have a consistent green-themed 2FA setup experience.
