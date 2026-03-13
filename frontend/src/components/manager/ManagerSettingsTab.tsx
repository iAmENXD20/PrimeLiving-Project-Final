import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, ShieldCheck, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'

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

interface ManagerSettingsTabProps {
  managerId?: string
  managerName?: string
  managerPhone?: string | null
}

export default function ManagerSettingsTab({ managerId, managerName, managerPhone }: ManagerSettingsTabProps) {
  const { isDark } = useTheme()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [phone, setPhone] = useState(managerPhone || '')
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)

  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  })

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

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Manage your account security and update your password.
        </p>
      </div>

      {/* Account Info */}
      <div className={`rounded-xl border p-6 ${cardClass}`}>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className={`text-sm ${labelClass}`}>Name</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {managerName || 'Loading...'}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Email</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              {userEmail ?? 'Loading...'}
            </p>
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Role</Label>
            <p className={`mt-1 text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              Apartment Manager
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
                <button onClick={async () => {
                  if (!managerId) return
                  setPhoneSaving(true)
                  try {
                    const { error } = await supabase.from('managers').update({ phone: phoneInput }).eq('id', managerId)
                    if (error) throw error
                    setPhone(phoneInput)
                    setEditingPhone(false)
                    toast.success('Phone number updated!')
                  } catch {
                    toast.error('Failed to update phone number')
                  } finally {
                    setPhoneSaving(false)
                  }
                }} disabled={phoneSaving} className="text-green-500 hover:text-green-400">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingPhone(false)} className="text-red-500 hover:text-red-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {phone || 'Not provided'}
                </p>
                <button onClick={() => { setPhoneInput(phone || ''); setEditingPhone(true) }} className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className={`rounded-xl border p-6 ${cardClass}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-500" />
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className={labelClass}>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                {...register('currentPassword')}
                className={`${inputClass} pr-10 ${errors.currentPassword ? 'border-red-500/50' : ''}`}
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
                className={`${inputClass} pr-10 ${errors.newPassword ? 'border-red-500/50' : ''}`}
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
                className={`${inputClass} pr-10 ${errors.confirmPassword ? 'border-red-500/50' : ''}`}
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
