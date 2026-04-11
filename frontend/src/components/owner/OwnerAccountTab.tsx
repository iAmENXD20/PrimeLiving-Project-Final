import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, ShieldCheck, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { getOwnerApartmentAddress, updateOwnerApartmentAddress } from '@/lib/ownerApi'
import { PROVINCE_LIST, getCitiesByProvince, PH_PROVINCES } from '@/lib/phLocations'
import AutocompleteInput from '@/components/ui/AutocompleteInput'

function formatPhoneTo63(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('63')) return `+63 ${digits.slice(2)}`
  if (digits.startsWith('0')) return `+63 ${digits.slice(1)}`
  if (digits.startsWith('9') && digits.length === 10) return `+63 ${digits}`
  return phone
}

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
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

interface OwnerAccountTabProps {
  ownerId: string
}

export default function OwnerAccountTab({ ownerId }: OwnerAccountTabProps) {
  const { isDark } = useTheme()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null)
  const [ownerStatus, setOwnerStatus] = useState<string>('active')
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [unitsCount, setUnitsCount] = useState(0)
  const [activeManagersCount, setActiveManagersCount] = useState(0)
  const [activeTenantsCount, setActiveTenantsCount] = useState(0)
  const [addrFields, setAddrFields] = useState({ street: '', barangay: '', city: '', province: '' })
  const [addressSaving, setAddressSaving] = useState(false)
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
    supabase.from('apartment_owners').select('first_name, last_name, phone, status').eq('id', ownerId).single().then(({ data }) => {
      setOwnerName(data ? `${data.first_name} ${data.last_name}`.trim() : null)
      setOwnerPhone(data?.phone ?? null)
      setOwnerStatus(data?.status || 'active')
      const d = (data?.phone || '').replace(/\D/g, '')
      setPhoneInput(d.startsWith('63') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d)
    })

    Promise.all([
      supabase.from('units').select('id', { count: 'exact', head: true }).eq('apartmentowner_id', ownerId),
      supabase.from('apartment_managers').select('id', { count: 'exact', head: true }).eq('apartmentowner_id', ownerId).eq('status', 'active'),
      supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('apartmentowner_id', ownerId).eq('status', 'active'),
    ]).then(([unitsRes, managersRes, tenantsRes]) => {
      setUnitsCount(unitsRes.count || 0)
      setActiveManagersCount(managersRes.count || 0)
      setActiveTenantsCount(tenantsRes.count || 0)
    })
    getOwnerApartmentAddress(ownerId).then((addr) => {
      if (addr) {
        // Parse "street, barangay, city, province zip" back into fields
        const parts = addr.split(', ')
        if (parts.length >= 4) {
          const province = parts[3] || ''
          setAddrFields({ street: parts[0] || '', barangay: parts[1] || '', city: parts[2] || '', province })
        } else {
          setAddrFields({ street: addr, barangay: '', city: '', province: '' })
        }
      }
    })
  }, [ownerId])

  const handleSavePhone = async () => {
    if (phoneInput === ((ownerPhone || '').replace(/\D/g, '').replace(/^63/, '') || ownerPhone || '')) return
    setPhoneSaving(true)
    try {
      const { error } = await supabase.from('apartment_owners').update({ phone: phoneInput }).eq('id', ownerId)
      if (error) throw error
      setOwnerPhone(phoneInput)
      toast.success('Contact number updated!')
    } catch {
      toast.error('Failed to update contact number')
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
  const infoGridClass = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [&>div]:min-h-[56px] [&_p]:truncate`

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
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

        <div className={infoGridClass}>
          <div>
            <Label className={`text-sm ${labelClass}`}>Name</Label>
            <Input className={`mt-1 text-base font-semibold ${inputClass}`} value={ownerName ?? '—'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Email</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={userEmail ?? '—'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Role</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value="Owner" disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Status</Label>
            <Input className={`mt-1 text-base capitalize ${inputClass}`} value={ownerStatus} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Contact Number</Label>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-base font-medium whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>+63</span>
              <Input
                className={`text-base ${inputClass}`}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                onBlur={handleSavePhone}
                placeholder="9XXXXXXXXX"
                maxLength={10}
              />
            </div>
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
              Your apartment building address
            </p>
          </div>
        </div>

        {addrFields.street || addrFields.barangay || addrFields.city || addrFields.province ? (
          <div className={infoGridClass}>
            <div>
              <Label className={`text-sm ${labelClass}`}>Street / Building</Label>
              <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {addrFields.street || '—'}
              </p>
            </div>
            <div>
              <Label className={`text-sm ${labelClass}`}>Barangay</Label>
              <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {addrFields.barangay || '—'}
              </p>
            </div>
            <div>
              <Label className={`text-sm ${labelClass}`}>Province</Label>
              <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {addrFields.province || '—'}
              </p>
            </div>
            <div>
              <Label className={`text-sm ${labelClass}`}>City / Municipality</Label>
              <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {addrFields.city || '—'}
              </p>
            </div>
          </div>
        ) : (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            No address set yet.
          </p>
        )}
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
