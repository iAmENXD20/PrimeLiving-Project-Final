import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { ArrowLeft, Building2, CheckCircle2, KeyRound, Sun, Moon, Eye, EyeOff, Upload, FileText, ChevronDown, X, Lock, Check, IdCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import api from '../lib/apiClient'
import { useTheme } from '@/context/ThemeContext'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const ID_TYPE_OPTIONS = [
  'Philippine National ID (PhilSys)',
  'Driver\'s License',
  'Passport',
  'SSS ID',
  'PhilHealth ID',
  'Others',
]

export default function InviteConfirmPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [idType, setIdType] = useState('')
  const [idTypeOther, setIdTypeOther] = useState('')
  const [idFile, setIdFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [idBackFile, setIdBackFile] = useState<File | null>(null)
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null)
  const [showIdDropdown, setShowIdDropdown] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [countdown, setCountdown] = useState(5)
  const [stepTransition, setStepTransition] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileBackInputRef = useRef<HTMLInputElement>(null)

  const tokenHash = useMemo(() => searchParams.get('token_hash') || '', [searchParams])
  const type = useMemo(() => searchParams.get('type') || 'invite', [searchParams])

  useEffect(() => {
    if (currentStep !== 3) return
    if (countdown <= 0) {
      navigate('/login')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [currentStep, countdown, navigate])

  function goToStep(step: number) {
    setStepTransition(true)
    setTimeout(() => {
      setCurrentStep(step)
      setError(null)
      setStepTransition(false)
    }, 300)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }
    if (side === 'front') {
      setIdFile(file)
      setIdPreview(URL.createObjectURL(file))
    } else {
      setIdBackFile(file)
      setIdBackPreview(URL.createObjectURL(file))
    }
    setError(null)
  }

  function clearFile(side: 'front' | 'back') {
    if (side === 'front') {
      setIdFile(null)
      if (idPreview) URL.revokeObjectURL(idPreview)
      setIdPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else {
      setIdBackFile(null)
      if (idBackPreview) URL.revokeObjectURL(idBackPreview)
      setIdBackPreview(null)
      if (fileBackInputRef.current) fileBackInputRef.current.value = ''
    }
  }

  function handleNextStep() {
    setError(null)
    if (!idType) {
      setError('Please select an ID type for verification.')
      return
    }
    if (idType === 'Others' && !idTypeOther.trim()) {
      setError('Please specify your ID type.')
      return
    }
    if (!idFile) {
      setError('Please upload a photo of the front of your ID.')
      return
    }
    if (!idBackFile) {
      setError('Please upload a photo of the back of your ID.')
      return
    }
    goToStep(2)
  }

  async function handleActivate() {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (!/[A-Za-z]/.test(password)) {
      setError('Password must contain at least one letter.')
      return
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.')
      return
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      setError('Password must contain at least one special character.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setVerifying(true)
    setError(null)
    setSuccessMessage(null)

    if (tokenHash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      })

      if (verifyError) {
        setError(verifyError.message)
        setVerifying(false)
        return
      }
    } else {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setError('Invalid or expired invite link. Please request a new invitation email.')
        setVerifying(false)
        return
      }
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    })

    if (passwordError) {
      setError(passwordError.message)
      setVerifying(false)
      return
    }

    // Upload ID photos to Supabase storage
    let idPhotoUrl = ''
    let idBackPhotoUrl = ''
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not found')
      if (!idFile || !idBackFile) throw new Error('ID photos are required')

      // Upload front
      const frontExt = idFile.name.split('.').pop() || 'jpg'
      const frontPath = `${user.id}/front_${Date.now()}.${frontExt}`
      const { error: frontError } = await supabase.storage
        .from('verification-ids')
        .upload(frontPath, idFile, { upsert: true })
      if (frontError) throw frontError
      idPhotoUrl = frontPath

      // Upload back
      const backExt = idBackFile.name.split('.').pop() || 'jpg'
      const backPath = `${user.id}/back_${Date.now()}.${backExt}`
      const { error: backError } = await supabase.storage
        .from('verification-ids')
        .upload(backPath, idBackFile, { upsert: true })
      if (backError) throw backError
      idBackPhotoUrl = backPath
    } catch (uploadErr: any) {
      setError('Failed to upload ID photo: ' + (uploadErr.message || 'Unknown error'))
      setVerifying(false)
      return
    }

    // Update status and save ID verification data
    try {
      await api.put('/tenants/confirm-activation', {
        id_type: idType === 'Others' ? 'Others' : idType,
        id_type_other: idType === 'Others' ? idTypeOther.trim() : null,
        id_front_photo_url: idPhotoUrl,
        id_back_photo_url: idBackPhotoUrl,
      })
    } catch {
      // Non-blocking — status update is best-effort
    }

    setSuccessMessage("You're all set! Your account is currently under review by management for verification.")
    setVerifying(false)
    goToStep(3)
  }

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-dark' : 'bg-gray-50'}`}>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=1600&fit=crop&q=80"
          alt="Apartment building"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-dark/75" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <Link to="/login" className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          </Link>

          <h1 className="text-5xl font-extrabold text-white leading-tight">Finish Your Account Setup</h1>
          <p className="mt-5 text-lg text-gray-300 max-w-lg">
            Set your password to activate access to your dashboard.
          </p>

          <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-5 max-w-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              <p className="text-sm text-gray-200">
                You were invited by your apartment owner. After activation, use your new password to sign in.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <button
          onClick={toggleTheme}
          className={`absolute top-6 right-6 p-2 rounded-lg transition-colors ${
            isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="w-full max-w-md">
          <div className="mb-7">
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Verify & Activate Account</h2>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Step {currentStep} of 3
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center mb-8">
            {[
              { label: 'ID Verification', step: 1 },
              { label: 'Set Password', step: 2 },
              { label: 'Complete', step: 3 },
            ].map((item, index) => (
              <div key={item.step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                      currentStep > item.step
                        ? 'bg-primary text-white'
                        : currentStep === item.step
                        ? 'bg-primary text-white'
                        : isDark ? 'border-2 border-[#334155] text-gray-500' : 'border-2 border-gray-300 text-gray-400'
                    }`}
                  >
                    {currentStep > item.step ? (
                      <Check className="w-5 h-5" />
                    ) : item.step === 1 ? (
                      <IdCard className="w-4 h-4" />
                    ) : item.step === 2 ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium whitespace-nowrap ${
                    currentStep >= item.step
                      ? isDark ? 'text-white' : 'text-gray-900'
                      : isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {item.label}
                  </span>
                </div>
                {index < 2 && (
                  <div className={`w-12 h-0.5 mx-2 mb-5 transition-colors duration-500 ${
                    currentStep > item.step
                      ? 'bg-primary'
                      : isDark ? 'bg-[#1E293B]' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className={`mb-5 rounded-lg border p-3 text-sm ${isDark ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {error}
            </div>
          )}

          <div className={`transition-opacity duration-300 ${stepTransition ? 'opacity-0' : 'opacity-100'}`}>
          {/* Step 1: ID Verification */}
          {currentStep === 1 && (
            <div key="step-1" className="space-y-4 animate-slide-up">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Upload a clear photo of your valid ID (front and back) for identity verification.
              </p>

              {/* ID Type Dropdown */}
              <div className="space-y-2">
                <Label>ID Type</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowIdDropdown(!showIdDropdown)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm text-left ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white hover:border-[#334155]'
                        : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                    } ${!idType ? (isDark ? 'text-gray-500' : 'text-gray-400') : ''}`}
                  >
                    <span>{idType || 'Select ID type'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showIdDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showIdDropdown && (
                    <div className={`absolute z-20 w-full mt-1 rounded-md border shadow-lg max-h-48 overflow-y-auto ${
                      isDark ? 'bg-[#0F1D32] border-[#1E293B]' : 'bg-white border-gray-200'
                    }`}>
                      {ID_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setIdType(option)
                            setShowIdDropdown(false)
                            if (option !== 'Others') setIdTypeOther('')
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            idType === option
                              ? isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
                              : isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Others text input */}
              {idType === 'Others' && (
                <div className="space-y-2">
                  <Label htmlFor="id-type-other">Specify ID Type</Label>
                  <Input
                    id="id-type-other"
                    value={idTypeOther}
                    onChange={(e) => setIdTypeOther(e.target.value)}
                    placeholder="Enter your ID type"
                    className={isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}
                  />
                </div>
              )}

              {/* File Upload - Front & Back */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Front of ID</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'front')}
                    className="hidden"
                  />
                  {!idFile ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full flex flex-col items-center justify-center gap-2 py-5 rounded-lg border-2 border-dashed transition-colors ${
                        isDark
                          ? 'border-[#1E293B] hover:border-[#334155] text-gray-400 hover:text-gray-300'
                          : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-600'
                      }`}
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs font-medium">Upload Front</span>
                      <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>JPG, PNG — max 5MB</span>
                    </button>
                  ) : (
                    <div className={`relative rounded-lg border overflow-hidden ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                      {idPreview && (
                        <img src={idPreview} alt="ID Front" className="w-full h-28 object-contain bg-black/5" />
                      )}
                      <div className={`flex items-center justify-between px-2 py-1.5 text-xs ${isDark ? 'bg-[#0A1628] text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                        <span className="truncate max-w-[100px]">{idFile.name}</span>
                        <button type="button" onClick={() => clearFile('front')} className="text-red-400 hover:text-red-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Back of ID</Label>
                  <input
                    ref={fileBackInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'back')}
                    className="hidden"
                  />
                  {!idBackFile ? (
                    <button
                      type="button"
                      onClick={() => fileBackInputRef.current?.click()}
                      className={`w-full flex flex-col items-center justify-center gap-2 py-5 rounded-lg border-2 border-dashed transition-colors ${
                        isDark
                          ? 'border-[#1E293B] hover:border-[#334155] text-gray-400 hover:text-gray-300'
                          : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-600'
                      }`}
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs font-medium">Upload Back</span>
                      <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>JPG, PNG — max 5MB</span>
                    </button>
                  ) : (
                    <div className={`relative rounded-lg border overflow-hidden ${isDark ? 'border-[#1E293B]' : 'border-gray-200'}`}>
                      {idBackPreview && (
                        <img src={idBackPreview} alt="ID Back" className="w-full h-28 object-contain bg-black/5" />
                      )}
                      <div className={`flex items-center justify-between px-2 py-1.5 text-xs ${isDark ? 'bg-[#0A1628] text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                        <span className="truncate max-w-[100px]">{idBackFile.name}</span>
                        <button type="button" onClick={() => clearFile('back')} className="text-red-400 hover:text-red-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={handleNextStep}
                className="w-full mt-4 bg-primary hover:bg-primary/90 text-white font-semibold py-3"
              >
                Next
              </Button>
            </div>
          )}

          {/* Step 2: Set Password */}
          {currentStep === 2 && (
            <div key="step-2" className="space-y-4 animate-slide-up">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Set a secure password to access your account. Must contain letters, numbers, and a special character.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-password">Create Password</Label>
                  <div className="relative">
                    <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <Input
                      id="invite-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className={`pl-10 pr-10 ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Must contain letters, numbers, and a special character
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <Input
                      id="invite-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className={`pl-10 pr-10 ${isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep(1)}
                  className={`flex-1 font-semibold py-3 ${isDark ? 'border-[#1E293B] text-gray-300 hover:bg-white/5' : ''}`}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleActivate}
                  disabled={verifying}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold py-3"
                >
                  {verifying ? 'Activating...' : 'Activate Account'}
                </Button>
              </div>

              <p className={`text-xs mt-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                After activation, sign in with your email and new password.
              </p>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 3 && (
            <div key="step-3" className="text-center space-y-5 animate-slide-up">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Account Activated!</h3>
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {successMessage || "You're all set! Your account is currently under review by management for verification."}
                </p>
              </div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Redirecting to login in <span className="font-semibold">{countdown}</span> second{countdown !== 1 ? 's' : ''}...
              </p>
              <Button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3"
              >
                Go to Login Now
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
