import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, ShieldCheck, MapPin, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { getOwnerApartmentAddress, updateOwnerApartmentAddress } from '@/lib/ownerApi'
import { PROVINCE_LIST, getCitiesByProvince, PH_PROVINCES } from '@/lib/phLocations'
import AutocompleteInput from '@/components/ui/AutocompleteInput'

// Get cities based on exact or partial province match, or all cities if empty
function getCitySuggestions(province: string): string[] {
  if (!province) {
    // Return all cities from all provinces
    const all = new Set<string>()
    Object.values(PH_PROVINCES).forEach((cities) => cities.forEach((c) => all.add(c)))
    return Array.from(all).sort()
  }
  // Try exact match first
  const exact = getCitiesByProvince(province)
  if (exact.length > 0) return exact
  // Partial match: find first province that matches input
  const lower = province.toLowerCase()
  const match = PROVINCE_LIST.find((p) => p.toLowerCase().startsWith(lower))
  return match ? getCitiesByProvince(match) : []
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

interface OwnerAccountTabProps {
  clientId: string
}

export default function OwnerAccountTab({ clientId }: OwnerAccountTabProps) {
  const { isDark } = useTheme()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null)
  const [ownerStatus, setOwnerStatus] = useState<string>('active')
  const [memberSince, setMemberSince] = useState<string | null>(null)
  const [unitsCount, setUnitsCount] = useState(0)
  const [activeManagersCount, setActiveManagersCount] = useState(0)
  const [activeTenantsCount, setActiveTenantsCount] = useState(0)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [addrFields, setAddrFields] = useState({ street: '', barangay: '', city: '', province: '', zip: '' })
  const [addressSaving, setAddressSaving] = useState(false)
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
    supabase.from('clients').select('name, phone, status, created_at').eq('id', clientId).single().then(({ data }) => {
      setOwnerName(data?.name ?? null)
      setOwnerPhone(data?.phone ?? null)
      setOwnerStatus(data?.status || 'active')
      setMemberSince(data?.created_at || null)
    })

    Promise.all([
      supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      supabase.from('managers').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'active'),
      supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'active'),
    ]).then(([unitsRes, managersRes, tenantsRes]) => {
      setUnitsCount(unitsRes.count || 0)
      setActiveManagersCount(managersRes.count || 0)
      setActiveTenantsCount(tenantsRes.count || 0)
    })
    getOwnerApartmentAddress(clientId).then((addr) => {
      if (addr) {
        // Parse "street, barangay, city, province zip" back into fields
        const parts = addr.split(', ')
        if (parts.length >= 4) {
          const lastPart = parts[3] || ''
          const spaceIdx = lastPart.lastIndexOf(' ')
          const province = spaceIdx > 0 ? lastPart.slice(0, spaceIdx) : lastPart
          const zip = spaceIdx > 0 ? lastPart.slice(spaceIdx + 1) : ''
          setAddrFields({ street: parts[0] || '', barangay: parts[1] || '', city: parts[2] || '', province, zip })
        } else {
          setAddrFields({ street: addr, barangay: '', city: '', province: '', zip: '' })
        }
      }
    })
  }, [clientId])

  const handleSavePhone = async () => {
    setPhoneSaving(true)
    try {
      const { error } = await supabase.from('clients').update({ phone: phoneInput }).eq('id', clientId)
      if (error) throw error
      setOwnerPhone(phoneInput)
      setEditingPhone(false)
      toast.success('Phone number updated!')
    } catch {
      toast.error('Failed to update phone number')
    } finally {
      setPhoneSaving(false)
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmit = async (data: PasswordForm) => {
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail!,
        password: data.currentPassword,
      })

      if (signInError) {
        toast.error('Current password is incorrect')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      })

      if (updateError) {
        toast.error(updateError.message)
        return
      }

      toast.success('Password updated successfully!')
      reset()
    } catch {
      toast.error('An unexpected error occurred')
    }
  }

  const cardClass = isDark
    ? 'bg-[#111C32] border-[#1E293B]'
    : 'bg-white border-gray-200'

  const inputClass = isDark
    ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500 focus:border-primary'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary'

  const labelClass = isDark ? 'text-gray-300' : 'text-gray-700'
  const sectionClass = `${cardClass} rounded-2xl border p-6 lg:p-8 shadow-sm`

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className={sectionClass}>
        <h2 className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Account Settings
        </h2>
        <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Manage your account security and update your password.
        </p>
      </div>

      {/* Account Info */}
      <div className={`${sectionClass} opacity-0 animate-fade-up-delay-1`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Account Information
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Your login credentials
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className={`text-sm ${labelClass}`}>Name</Label>
            <p className={`mt-1 text-base font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {ownerName ?? '—'}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Email</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {userEmail ?? '—'}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Role</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              Owner
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Status</Label>
            <p className={`mt-1 text-base font-medium capitalize ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {ownerStatus}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Member Since</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {memberSince ? new Date(memberSince).toLocaleDateString() : 'Not set'}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Total Units</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {unitsCount}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Active Managers</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {activeManagersCount}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Active Tenants</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {activeTenantsCount}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Phone</Label>
            {editingPhone ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  className={`text-base ${inputClass}`}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="Enter phone number"
                />
                <button type="button" onClick={handleSavePhone} disabled={phoneSaving} className="text-green-500 hover:text-green-400">
                  <Check className="w-5 h-5" />
                </button>
                <button type="button" onClick={() => setEditingPhone(false)} className="text-red-500 hover:text-red-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {ownerPhone || 'Not provided'}
                </p>
                <button type="button" onClick={() => { setPhoneInput(ownerPhone || ''); setEditingPhone(true) }} className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Apartment Address */}
      <div className={`${sectionClass} opacity-0 animate-fade-up-delay-1 relative z-10 overflow-visible`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Apartment Address
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Set your apartment building address
            </p>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            // Validate all address fields are filled
            const errs: Record<string, string> = {}
            if (!addrFields.street.trim()) errs.street = 'Street / Building is required'
            if (!addrFields.barangay.trim()) errs.barangay = 'Barangay is required'
            if (!addrFields.province.trim()) errs.province = 'Province is required'
            if (!addrFields.city.trim()) errs.city = 'City / Municipality is required'
            if (!addrFields.zip.trim()) errs.zip = 'Zip Code is required'
            setAddressErrors(errs)
            if (Object.keys(errs).length > 0) {
              toast.error('Please fill in all address fields')
              return
            }
            setAddressSaving(true)
            try {
              const combined = [addrFields.street, addrFields.barangay, addrFields.city, `${addrFields.province} ${addrFields.zip}`.trim()].filter(Boolean).join(', ')
              await updateOwnerApartmentAddress(clientId, combined)
              toast.success('Apartment address updated!')
            } catch {
              toast.error('Failed to update apartment address')
            } finally {
              setAddressSaving(false)
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={labelClass}>Street / Building <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                placeholder="e.g. 123 Rizal Ave, Bldg A"
                className={`${inputClass} ${addressErrors.street ? 'border-red-500 focus:border-red-500' : ''}`}
                value={addrFields.street}
                onChange={(e) => { setAddrFields({ ...addrFields, street: e.target.value }); setAddressErrors((prev) => { const { street, ...rest } = prev; return rest }) }}
                required
              />
              {addressErrors.street && <p className="text-xs text-red-500 mt-1">{addressErrors.street}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Barangay <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                placeholder="e.g. Brgy. San Antonio"
                className={`${inputClass} ${addressErrors.barangay ? 'border-red-500 focus:border-red-500' : ''}`}
                value={addrFields.barangay}
                onChange={(e) => { setAddrFields({ ...addrFields, barangay: e.target.value }); setAddressErrors((prev) => { const { barangay, ...rest } = prev; return rest }) }}
                required
              />
              {addressErrors.barangay && <p className="text-xs text-red-500 mt-1">{addressErrors.barangay}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className={labelClass}>Province <span className="text-red-500">*</span></Label>
              <AutocompleteInput
                value={addrFields.province}
                onChange={(val) => { setAddrFields({ ...addrFields, province: val, city: '' }); setAddressErrors((prev) => { const { province, ...rest } = prev; return rest }) }}
                suggestions={PROVINCE_LIST}
                placeholder="e.g. Metro Manila"
                className={`${inputClass} ${addressErrors.province ? 'border-red-500 focus:border-red-500' : ''}`}
                isDark={isDark}
              />
              {addressErrors.province && <p className="text-xs text-red-500 mt-1">{addressErrors.province}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>City / Municipality <span className="text-red-500">*</span></Label>
              <AutocompleteInput
                value={addrFields.city}
                onChange={(val) => { setAddrFields({ ...addrFields, city: val }); setAddressErrors((prev) => { const { city, ...rest } = prev; return rest }) }}
                suggestions={getCitySuggestions(addrFields.province)}
                placeholder="e.g. Quezon City"
                className={`${inputClass} ${addressErrors.city ? 'border-red-500 focus:border-red-500' : ''}`}
                isDark={isDark}
              />
              {addressErrors.city && <p className="text-xs text-red-500 mt-1">{addressErrors.city}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Zip Code <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                placeholder="e.g. 1100"
                className={`${inputClass} ${addressErrors.zip ? 'border-red-500 focus:border-red-500' : ''}`}
                value={addrFields.zip}
                onChange={(e) => { setAddrFields({ ...addrFields, zip: e.target.value }); setAddressErrors((prev) => { const { zip, ...rest } = prev; return rest }) }}
                required
              />
              {addressErrors.zip && <p className="text-xs text-red-500 mt-1">{addressErrors.zip}</p>}
            </div>
          </div>
          <div className="pt-1">
            <Button
              type="submit"
              disabled={addressSaving}
              className="w-full sm:w-auto px-8 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors"
            >
              {addressSaving ? 'Saving...' : 'Save Address'}
            </Button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className={`${sectionClass} opacity-0 animate-fade-up-delay-2`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Change Password
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Update your password to keep your account secure
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Current Password */}
          <div className="space-y-1.5">
            <Label className={labelClass}>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                className={`pr-10 h-11 ${inputClass}`}
                {...register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-red-500 text-sm">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label className={labelClass}>New Password</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                placeholder="Enter new password"
                className={`pr-10 h-11 ${inputClass}`}
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-500 text-sm">{errors.newPassword.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label className={labelClass}>Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm new password"
                className={`pr-10 h-11 ${inputClass}`}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors"
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
