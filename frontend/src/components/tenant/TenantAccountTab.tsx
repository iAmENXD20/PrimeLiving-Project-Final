import { useState, useEffect, useRef, useCallback } from 'react'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, ShieldCheck, Users, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'
import {
  getUnitOccupants,
  addUnitOccupant,
  deleteUnitOccupant,
  uploadOccupantIdPhoto,
  type UnitOccupant,
} from '@/lib/tenantApi'

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

interface TenantAccountTabProps {
  tenantId?: string
  tenantName?: string
  tenantPhone?: string | null
  apartmentId?: string | null
  ownerId?: string | null
}

export default function TenantAccountTab({ tenantId, tenantName, tenantPhone, apartmentId, ownerId }: TenantAccountTabProps) {
  const { isDark } = useTheme()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [phone, setPhone] = useState(tenantPhone || '')
  const [phoneInput, setPhoneInput] = useState(() => {
    const d = (tenantPhone || '').replace(/\D/g, '')
    return d.startsWith('63') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d
  })
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [tenantStatus, setTenantStatus] = useState<string>('active')
  const [moveInDate, setMoveInDate] = useState<string | null>(null)
  const [apartmentName, setApartmentName] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [propertyAddress, setPropertyAddress] = useState<string | null>(null)
  const [birthdate, setBirthdate] = useState<string>('')
  const [birthdateSaving, setBirthdateSaving] = useState(false)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [maxOccupancy, setMaxOccupancy] = useState<number | null>(null)
  const [occupants, setOccupants] = useState<UnitOccupant[]>([])
  const [occupantsLoading, setOccupantsLoading] = useState(false)
  const [addingOccupant, setAddingOccupant] = useState(false)
  const [newOccFirstName, setNewOccFirstName] = useState('')
  const [newOccLastName, setNewOccLastName] = useState('')
  const [newOccSex, setNewOccSex] = useState('')
  const [newOccPhone, setNewOccPhone] = useState('')
  const [newOccBirthdate, setNewOccBirthdate] = useState('')
  const [newOccupantIdFile, setNewOccupantIdFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadProfile = useCallback(async () => {
    const [{ data: userData }, tenantRes] = await Promise.all([
      supabase.auth.getUser(),
      tenantId
        ? supabase
            .from('tenants')
            .select('status, move_in_date, unit_id, apartmentowner_id, apartment_id, birthdate')
            .eq('id', tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ])

    setUserEmail(userData.user?.email ?? null)

    const resolvedApartmentId = (tenantRes?.data?.unit_id as string | null) || apartmentId || null
    const resolvedClientId = (tenantRes?.data?.apartmentowner_id as string | null) || ownerId || null

    if (tenantRes?.data?.status) setTenantStatus(tenantRes.data.status)
    if (tenantRes?.data?.move_in_date) setMoveInDate(tenantRes.data.move_in_date)
    if (tenantRes?.data?.birthdate) setBirthdate(tenantRes.data.birthdate)

    if (resolvedApartmentId) {
      setUnitId(resolvedApartmentId)
      const { data: apartment } = await supabase
        .from('units')
        .select('name, max_occupancy')
        .eq('id', resolvedApartmentId)
        .maybeSingle()
      setApartmentName(apartment?.name || null)
      setMaxOccupancy(apartment?.max_occupancy ?? null)

      // Load occupants
      setOccupantsLoading(true)
      try {
        const occ = await getUnitOccupants(resolvedApartmentId)
        setOccupants(occ)
      } catch {
        // silent
      } finally {
        setOccupantsLoading(false)
      }
    }

    if (resolvedClientId) {
      const { data: owner } = await supabase
        .from('apartment_owners')
        .select('first_name, last_name')
        .eq('id', resolvedClientId)
        .maybeSingle()
      setOwnerName(owner ? `${owner.first_name} ${owner.last_name}`.trim() : null)
    }

    // Get property address from the apartment record
    const resolvedAptId = tenantRes?.data?.apartment_id as string | null
    if (resolvedAptId) {
      const { data: aptData } = await supabase
        .from('apartments')
        .select('address')
        .eq('id', resolvedAptId)
        .maybeSingle()
      setPropertyAddress(aptData?.address || null)
    }
  }, [tenantId, apartmentId, ownerId])

  useEffect(() => {
    loadProfile().catch(() => {
      // silent fallback
    })
  }, [loadProfile])

  useRealtimeSubscription(`tenant-account-${tenantId}`, [
    { table: 'tenants', filter: `id=eq.${tenantId}`, onChanged: () => loadProfile() },
  ])

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
            <Input className={`mt-1 text-base font-semibold ${inputClass}`} value={tenantName || '—'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Email</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={userEmail ?? '—'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Role</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value="Tenant" disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Status</Label>
            <Input className={`mt-1 text-base capitalize ${inputClass}`} value={tenantStatus} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Move-in Date</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={moveInDate ? new Date(moveInDate).toLocaleDateString() : 'Not set'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Assigned Unit</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={apartmentName || 'Unassigned'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Property Owner</Label>
            <Input className={`mt-1 text-base ${inputClass}`} value={ownerName || 'Not linked'} disabled />
          </div>
          <div>
            <Label className={`text-sm ${labelClass}`}>Property Address</Label>
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
                  if (!tenantId) return
                  setPhoneSaving(true)
                  try {
                    const { error } = await supabase.from('tenants').update({ phone: phoneInput }).eq('id', tenantId)
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
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="date"
                className={`text-base ${inputClass}`}
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                onBlur={async () => {
                  if (!tenantId) return
                  setBirthdateSaving(true)
                  try {
                    const { error } = await supabase.from('tenants').update({ birthdate: birthdate || null }).eq('id', tenantId)
                    if (error) throw error
                    toast.success('Birthdate updated!')
                  } catch {
                    toast.error('Failed to update birthdate')
                  } finally {
                    setBirthdateSaving(false)
                  }
                }}
              />
              {birthdate && (
                <span className={`text-sm whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs old
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unit Occupants */}
      {unitId && (
        <div className={`${sectionClass} opacity-0 animate-fade-up-delay-2`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Unit Occupants
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {maxOccupancy
                  ? `Maximum ${maxOccupancy} occupants (including you). Register other occupants living in your unit.`
                  : 'Register other occupants living in your unit.'}
              </p>
            </div>
          </div>

          {/* Occupant list */}
          {occupantsLoading ? (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading occupants...</p>
          ) : (
            <>
              {occupants.length === 0 && (
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No additional occupants registered. If others live with you, add them below.
                </p>
              )}
              {occupants.length > 0 && (
                <div className="space-y-2 mb-4">
                  {occupants.map((occ) => (
                    <div
                      key={occ.id}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                        isDark ? 'bg-[#0A1628] border-[#1E293B]' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {occ.id_photo_url ? (
                          <a href={occ.id_photo_url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg overflow-hidden border border-gray-300 flex-shrink-0">
                            <img src={occ.id_photo_url} alt="ID" className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                            No ID
                          </div>
                        )}
                        <div>
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {occ.first_name ? `${occ.first_name} ${occ.last_name || ''}`.trim() : occ.full_name}
                          </span>
                          <div className={`flex items-center gap-3 text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {occ.sex && <span>{occ.sex}</span>}
                            {occ.birthdate && <span>{Math.floor((Date.now() - new Date(occ.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs old</span>}
                            {occ.phone && <span>{formatPhone(occ.phone)}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await deleteUnitOccupant(occ.id)
                            setOccupants(prev => prev.filter(o => o.id !== occ.id))
                            toast.success('Occupant removed')
                          } catch {
                            toast.error('Failed to remove occupant')
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add occupant form */}
              {(!maxOccupancy || occupants.length + 1 < maxOccupancy) && (
                <div className={`rounded-lg border p-4 ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                  <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Add Occupant</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className={`text-sm ${labelClass}`}>First Name</Label>
                        <Input
                          className={`mt-1 ${inputClass}`}
                          value={newOccFirstName}
                          onChange={(e) => setNewOccFirstName(e.target.value)}
                          placeholder="First name"
                        />
                      </div>
                      <div>
                        <Label className={`text-sm ${labelClass}`}>Last Name</Label>
                        <Input
                          className={`mt-1 ${inputClass}`}
                          value={newOccLastName}
                          onChange={(e) => setNewOccLastName(e.target.value)}
                          placeholder="Last name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className={`text-sm ${labelClass}`}>Sex</Label>
                        <select
                          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${inputClass}`}
                          value={newOccSex}
                          onChange={(e) => setNewOccSex(e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div>
                        <Label className={`text-sm ${labelClass}`}>Contact Number</Label>
                        <div className="relative mt-1">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>+63</span>
                          <Input
                            className={`pl-12 ${inputClass}`}
                            value={newOccPhone}
                            onChange={(e) => setNewOccPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="9XX XXX XXXX"
                            maxLength={10}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className={`text-sm ${labelClass}`}>Birthdate</Label>
                        <Input
                          type="date"
                          className={`mt-1 ${inputClass}`}
                          value={newOccBirthdate}
                          onChange={(e) => setNewOccBirthdate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className={`text-sm ${labelClass}`}>Valid ID (photo)</Label>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setNewOccupantIdFile(e.target.files?.[0] || null)}
                        />
                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4" />
                            {newOccupantIdFile ? 'Change File' : 'Upload ID'}
                          </Button>
                          {newOccupantIdFile && (
                            <span className={`text-sm flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {newOccupantIdFile.name}
                              <button onClick={() => { setNewOccupantIdFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      className="gap-2"
                      disabled={addingOccupant || !newOccFirstName.trim()}
                      onClick={async () => {
                        if (!tenantId || !unitId || !newOccFirstName.trim()) return
                        setAddingOccupant(true)
                        try {
                          let photoUrl: string | undefined
                          if (newOccupantIdFile) {
                            photoUrl = await uploadOccupantIdPhoto(newOccupantIdFile, tenantId)
                          }
                          const occ = await addUnitOccupant({
                            unit_id: unitId,
                            tenant_id: tenantId,
                            first_name: newOccFirstName.trim(),
                            last_name: newOccLastName.trim(),
                            sex: newOccSex || undefined,
                            phone: newOccPhone || undefined,
                            birthdate: newOccBirthdate || undefined,
                            id_photo_url: photoUrl,
                          })
                          setOccupants(prev => [...prev, occ])
                          setNewOccFirstName('')
                          setNewOccLastName('')
                          setNewOccSex('')
                          setNewOccPhone('')
                          setNewOccBirthdate('')
                          setNewOccupantIdFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                          toast.success('Occupant added')
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to add occupant')
                        } finally {
                          setAddingOccupant(false)
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      {addingOccupant ? 'Adding...' : 'Add Occupant'}
                    </Button>
                  </div>
                </div>
              )}

              {maxOccupancy && occupants.length + 1 >= maxOccupancy && (
                <p className={`text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  Maximum occupancy ({maxOccupancy}) has been reached.
                </p>
              )}
            </>
          )}
        </div>
      )}

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
