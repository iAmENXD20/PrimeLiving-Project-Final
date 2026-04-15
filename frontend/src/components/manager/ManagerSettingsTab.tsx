import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'

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

interface ManagerSettingsTabProps {
  managerId?: string
  managerName?: string
  managerPhone?: string | null
  ownerId?: string | null
}

export default function ManagerSettingsTab({ managerId, managerName, managerPhone, ownerId }: ManagerSettingsTabProps) {
  const { isDark } = useTheme()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [phone, setPhone] = useState(managerPhone || '')
  const [phoneInput, setPhoneInput] = useState(() => {
    const d = (managerPhone || '').replace(/\D/g, '')
    return d.startsWith('63') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d
  })
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [managerStatus, setManagerStatus] = useState<string>('active')
  const [joinedDate, setJoinedDate] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null)
  const [birthdate, setBirthdate] = useState<string>('')
  const [birthdateSaving, setBirthdateSaving] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const [{ data: userData }, managerRes] = await Promise.all([
        supabase.auth.getUser(),
        managerId
          ? supabase
              .from('apartment_managers')
              .select('status, joined_date, apartmentowner_id, apartment_id, birthdate')
              .eq('id', managerId)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ])

      setUserEmail(userData.user?.email ?? null)

      const resolvedClientId = (managerRes?.data?.apartmentowner_id as string | null) || ownerId || null
      const resolvedApartmentId = managerRes?.data?.apartment_id as string | null

      if (managerRes?.data?.status) setManagerStatus(managerRes.data.status)
      if (managerRes?.data?.joined_date) setJoinedDate(managerRes.data.joined_date)
      if (managerRes?.data?.birthdate) setBirthdate(managerRes.data.birthdate)

      if (resolvedClientId) {
        const { data: clientData } = await supabase
          .from('apartment_owners')
          .select('first_name, last_name')
          .eq('id', resolvedClientId)
          .maybeSingle()

        setOwnerName(clientData ? `${clientData.first_name} ${clientData.last_name}`.trim() : null)
      }

      if (resolvedApartmentId) {
        const { data: aptData } = await supabase
          .from('apartments')
          .select('address')
          .eq('id', resolvedApartmentId)
          .maybeSingle()

        setPropertyAddress(aptData?.address || null)
      }
    }

    loadProfile().catch(() => {
      // silent fallback
    })
  }, [managerId, ownerId])

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
      <div className={sectionClass}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Account Information
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Your login credentials</p>
          </div>
        </div>

        <div className={infoGridClass}>
          <div>
            <Label className={`text-sm ${labelClass}`}>Name</Label>
            <Input className={`mt-1 text-base font-semibold ${inputClass}`} value={managerName || '—'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Email</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={userEmail ?? '—'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Role</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value="Apartment Manager" disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Status</Label>
            <Input className={`mt-1 text-base capitalize ${inputClass}`} value={managerStatus} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Joined Date</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={joinedDate ? new Date(joinedDate).toLocaleDateString() : 'Not set'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Owner</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={ownerName || 'Not linked'} disabled />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <Label className={`text-sm ${labelClass}`}>Managed Property Address</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={propertyAddress || 'Not set'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Contact Number</Label>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-base font-medium whitespace-nowrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>+63</span>
              <Input
                className={`text-base ${inputClass}`}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                onBlur={async () => {
                  const d = (phone || '').replace(/\D/g, '')
                  const current = d.startsWith('63') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d
                  if (phoneInput === current) return
                  if (!managerId) return
                  setPhoneSaving(true)
                  try {
                    const { error } = await supabase.from('apartment_managers').update({ phone: phoneInput }).eq('id', managerId)
                    if (error) throw error
                    setPhone(phoneInput)
                    toast.success('Contact number updated!')
                  } catch {
                    toast.error('Failed to update contact number')
                  } finally {
                    setPhoneSaving(false)
                  }
                }}
                placeholder="9XX XXX XXXX"
                maxLength={10}
              />
            </div>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Birthdate</Label>
            <Input
              type="date"
              className={`mt-1 text-base ${inputClass}`}
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              onBlur={async () => {
                if (!managerId || !birthdate) return
                setBirthdateSaving(true)
                try {
                  const { error } = await supabase.from('apartment_managers').update({ birthdate }).eq('id', managerId)
                  if (error) throw error
                  toast.success('Birthdate updated!')
                } catch {
                  toast.error('Failed to update birthdate')
                } finally {
                  setBirthdateSaving(false)
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className={sectionClass}>
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
          <div className="space-y-2">
            <Label className={labelClass}>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                {...register('currentPassword')}
                className={`${inputClass} pr-10 h-11 ${errors.currentPassword ? 'border-red-500/50' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && <p className="text-red-400 text-xs">{errors.currentPassword.message}</p>}
          </div>

          <div className="space-y-2">
              <Label className={labelClass}>New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Enter new password"
                  {...register('newPassword')}
                  className={`${inputClass} pr-10 h-11 ${errors.newPassword ? 'border-red-500/50' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-red-400 text-xs">{errors.newPassword.message}</p>}
          </div>

          <div className="space-y-2">
              <Label className={labelClass}>Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  {...register('confirmPassword')}
                  className={`${inputClass} pr-10 h-11 ${errors.confirmPassword ? 'border-red-500/50' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
