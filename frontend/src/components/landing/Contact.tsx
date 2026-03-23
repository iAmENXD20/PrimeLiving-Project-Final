import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Bell, BarChart3, ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTheme } from '@/context/ThemeContext'
import { useInView } from '@/hooks/useInView'
import { submitInquiry } from '@/lib/api'
import zipcodes from 'zipcodes-ph'
import { PROVINCE_LIST, getCitiesByProvince, PH_PROVINCES } from '@/lib/phLocations'
import { getBarangays } from '@/lib/psgcApi'

const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.com.ph', 'outlook.com', 'hotmail.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'aol.com', 'live.com',
  'zoho.com', 'ymail.com', 'msn.com', 'me.com', 'rocketmail.com',
]

function suggestEmailDomain(email: string): string | null {
  const atIndex = email.indexOf('@')
  if (atIndex < 1) return null
  const domain = email.slice(atIndex + 1).toLowerCase().trim()
  if (!domain || domain.length < 3) return null
  if (COMMON_DOMAINS.includes(domain)) return null

  // Simple Levenshtein-like check for close matches
  for (const common of COMMON_DOMAINS) {
    if (Math.abs(domain.length - common.length) > 2) continue
    let diff = 0
    const maxLen = Math.max(domain.length, common.length)
    for (let i = 0; i < maxLen; i++) {
      if (domain[i] !== common[i]) diff++
      if (diff > 2) break
    }
    if (diff <= 2 && diff > 0) {
      return `${email.slice(0, atIndex + 1)}${common}`
    }
  }
  return null
}

const inquirySchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name is required')
    .regex(/^[A-Za-z][A-Za-z\s'-]*$/, 'First name must contain letters only'),
  lastName: z
    .string()
    .min(2, 'Last name is required')
    .regex(/^[A-Za-z][A-Za-z\s'-]*$/, 'Last name must contain letters only'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string()
    .regex(/^9\d{9}$/, 'Enter a valid PH mobile number (e.g. 9171234567)'),
  sex: z.string().min(1, 'Sex is required'),
  age: z.string().regex(/^\d+$/, 'Enter a valid age').refine(v => Number(v) >= 18 && Number(v) <= 120, 'Age must be between 18 and 120'),
  streetBuilding: z.string().min(3, 'Street / Building is required'),
  barangay: z.string().min(2, 'Barangay is required'),
  province: z.string().min(1, 'Province is required'),
  cityMunicipality: z.string().min(1, 'City / Municipality is required'),
  zipCode: z.string().regex(/^\d{4}$/, 'Zip code must be 4 digits'),
  apartmentClassification: z.string().min(1, 'Apartment classification is required'),
  numberOfUnits: z.string().optional(),
  numberOfFloors: z.string().optional(),
  numberOfRooms: z.string().optional(),
  otherPropertyDetails: z.string().optional(),
}).superRefine((data, ctx) => {
  const isPositiveInteger = (value?: string) => !!value && /^\d+$/.test(value) && Number(value) > 0

  const requirePositive = (field: keyof typeof data, label: string) => {
    const value = data[field] as string | undefined
    if (!isPositiveInteger(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `Enter a valid ${label}`,
      })
    }
  }

  switch (data.apartmentClassification) {
    case 'Apartment Building':
      requirePositive('numberOfUnits', 'number of units')
      requirePositive('numberOfFloors', 'number of floors')
      break
    case 'Condominium':
      requirePositive('numberOfUnits', 'number of units')
      requirePositive('numberOfFloors', 'number of floors')
      break
    case 'Boarding House':
      requirePositive('numberOfRooms', 'number of rooms')
      break
    case 'Dormitory':
      requirePositive('numberOfRooms', 'number of rooms')
      break
    case 'Townhouse':
      requirePositive('numberOfFloors', 'number of residential units')
      break
    case 'Other':
      if (!data.otherPropertyDetails || data.otherPropertyDetails.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['otherPropertyDetails'],
          message: 'Please provide at least 3 characters',
        })
      }
      break
  }

  const expectedZip = getZipCodeForLocation(data.cityMunicipality)
  if (expectedZip && data.zipCode !== expectedZip) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['zipCode'],
      message: `Zip code for ${data.cityMunicipality} is ${expectedZip}`,
    })
  }
})

type InquiryForm = z.infer<typeof inquirySchema>

const highlights = [
  {
    icon: MapPin,
    text: 'Available nationwide in the Philippines',
  },
  {
    icon: Bell,
    text: 'Real-time SMS notifications included',
  },
  {
    icon: BarChart3,
    text: 'Analytics dashboard for system-wide insights',
  },
]

const apartmentClassifications = [
  'Apartment Building',
  'Condominium',
  'Boarding House',
  'Dormitory',
  'Townhouse',
  'Other',
]

function getCitySuggestions(province: string): string[] {
  if (!province) {
    const all = new Set<string>()
    Object.values(PH_PROVINCES).forEach((cities) => cities.forEach((city) => all.add(city)))
    return Array.from(all).sort()
  }
  const exact = getCitiesByProvince(province)
  if (exact.length > 0) return exact
  const lower = province.toLowerCase()
  const match = PROVINCE_LIST.find((p) => p.toLowerCase().startsWith(lower))
  return match ? getCitiesByProvince(match) : []
}

const getZipCodeForLocation = (locationName: string): string | null => {
  if (!locationName) return null
  const direct = zipcodes.reverse(locationName)
  if (typeof direct === 'number') return String(direct)

  const normalized = locationName.replace(/^City of\s+/i, '')
  const fallback = zipcodes.reverse(normalized)
  if (typeof fallback === 'number') return String(fallback)

  return null
}

export default function Contact() {
  const { isDark } = useTheme()
  const { ref, isInView } = useInView()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InquiryForm>({
    resolver: zodResolver(inquirySchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      sex: '',
      age: '',
      streetBuilding: '',
      barangay: '',
      province: '',
      cityMunicipality: '',
      zipCode: '',
      apartmentClassification: '',
      numberOfUnits: '',
      numberOfFloors: '',
      numberOfRooms: '',
      otherPropertyDetails: '',
    },
  })

  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [phoneInputError, setPhoneInputError] = useState(false)
  const [phonePrefixError, setPhonePrefixError] = useState(false)
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null)
  const [isProvinceOpen, setIsProvinceOpen] = useState(false)
  const [isCityOpen, setIsCityOpen] = useState(false)
  const [isBarangayOpen, setIsBarangayOpen] = useState(false)
  const [isSexOpen, setIsSexOpen] = useState(false)
  const [isClassificationOpen, setIsClassificationOpen] = useState(false)
  const [barangayList, setBarangayList] = useState<string[]>([])
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false)
  const [barangaySearch, setBarangaySearch] = useState('')
  const [firstNameInputNote, setFirstNameInputNote] = useState(false)
  const [lastNameInputNote, setLastNameInputNote] = useState(false)
  const provinceRef = useRef<HTMLDivElement>(null)
  const cityRef = useRef<HTMLDivElement>(null)
  const barangayRef = useRef<HTMLDivElement>(null)
  const sexRef = useRef<HTMLDivElement>(null)
  const classificationRef = useRef<HTMLDivElement>(null)
  const barangaySearchRef = useRef<HTMLInputElement>(null)
  const firstNameNoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNameNoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const apartmentClassification = watch('apartmentClassification')
  const selectedProvince = watch('province')
  const selectedCityMunicipality = watch('cityMunicipality')
  const selectedBarangay = watch('barangay')

  const needsUnits = ['Apartment Building', 'Condominium'].includes(apartmentClassification)
  const needsFloors = ['Apartment Building', 'Condominium', 'Townhouse'].includes(apartmentClassification)
  const needsRooms = ['Boarding House', 'Dormitory'].includes(apartmentClassification)
  const needsOtherDetails = apartmentClassification === 'Other'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (provinceRef.current && !provinceRef.current.contains(event.target as Node)) {
        setIsProvinceOpen(false)
      }
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) {
        setIsCityOpen(false)
      }
      if (barangayRef.current && !barangayRef.current.contains(event.target as Node)) {
        setIsBarangayOpen(false)
        setBarangaySearch('')
      }
      if (sexRef.current && !sexRef.current.contains(event.target as Node)) {
        setIsSexOpen(false)
      }
      if (classificationRef.current && !classificationRef.current.contains(event.target as Node)) {
        setIsClassificationOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!selectedCityMunicipality) return
    const expectedZip = getZipCodeForLocation(selectedCityMunicipality)
    if (expectedZip) {
      setValue('zipCode', expectedZip, { shouldValidate: true })
    }
  }, [selectedCityMunicipality, setValue])

  useEffect(() => {
    if (!selectedCityMunicipality || !selectedProvince) {
      setBarangayList([])
      return
    }
    let cancelled = false
    setIsLoadingBarangays(true)
    getBarangays(selectedCityMunicipality, selectedProvince).then((list) => {
      if (!cancelled) {
        setBarangayList(list)
        setIsLoadingBarangays(false)
      }
    })
    return () => { cancelled = true }
  }, [selectedCityMunicipality, selectedProvince])

  useEffect(() => {
    return () => {
      if (firstNameNoteTimeoutRef.current) clearTimeout(firstNameNoteTimeoutRef.current)
      if (lastNameNoteTimeoutRef.current) clearTimeout(lastNameNoteTimeoutRef.current)
    }
  }, [])

  const formatPhoneDisplay = (digits: string) => {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    // Check if user typed non-numeric characters (ignore spaces from formatting)
    if (/[^\d\s]/.test(input)) {
      setPhoneInputError(true)
      setTimeout(() => setPhoneInputError(false), 1500)
    }
    let raw = input.replace(/\D/g, '').slice(0, 10)

    if (raw.length > 0 && raw[0] !== '9') {
      setPhonePrefixError(true)
      raw = raw.slice(1)
    } else {
      setPhonePrefixError(false)
    }

    setPhoneDisplay(formatPhoneDisplay(raw))
    setValue('phone', raw, { shouldValidate: raw.length === 10 })
  }

  const sanitizeNameInput = (value: string) => value.replace(/[^A-Za-z\s'-]/g, '')

  const onSubmit = async (data: InquiryForm) => {
    try {
      await submitInquiry({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        sex: data.sex,
        age: data.age,
        apartment_classification: data.apartmentClassification,
        street_building: data.streetBuilding,
        barangay: data.barangay,
        province: data.province,
        city_municipality: data.cityMunicipality,
        zip_code: data.zipCode,
        number_of_units: data.numberOfUnits || undefined,
        number_of_floors: data.numberOfFloors || undefined,
        number_of_rooms: data.numberOfRooms || undefined,
        other_property_details: data.otherPropertyDetails || undefined,
      })
      toast.success('Inquiry submitted successfully! We will be in touch soon.')
      reset()
      setPhoneDisplay('')
    } catch (err) {
      console.error('Failed to submit inquiry:', err)
      toast.error('Failed to submit inquiry. Please try again.')
    }
  }

  return (
    <section id="contact" ref={ref} className="py-20 lg:py-28 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          {/* Left content */}
          <div className={`lg:pt-8 ${isInView ? 'fade-up-visible' : 'fade-up-hidden'}`}>
            <span className="text-primary font-semibold text-sm tracking-widest uppercase">
              Get Started
            </span>
            <h2 className={`mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Ready to upgrade from Paper-Based Management?
            </h2>
            <p className={`mt-5 text-lg sm:text-xl leading-relaxed ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Submit an inquiry and our team will reach out to help you set up
              PrimeLiving for your apartment building. Join other satisfied
              property owners, apartment managers, and tenants today.
            </p>

            <div className="mt-8 space-y-4">
              {highlights.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Form */}
          <div className={`rounded-2xl p-6 lg:p-8 shadow-xl mt-8 max-w-lg ml-auto ${isInView ? 'fade-up-visible fade-up-delay-2' : 'fade-up-hidden'} ${
            isDark
              ? 'bg-navy-card border border-white/5'
              : 'bg-white border border-gray-200'
          }`}>
            <h3 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Send Us an Inquiry
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* ── Personal Information ── */}
              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Personal Information
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      placeholder="First Name"
                      {...register('firstName', {
                        onChange: (e) => {
                          const sanitized = sanitizeNameInput(e.target.value)
                          if (sanitized !== e.target.value) {
                            setFirstNameInputNote(true)
                            if (firstNameNoteTimeoutRef.current) clearTimeout(firstNameNoteTimeoutRef.current)
                            firstNameNoteTimeoutRef.current = setTimeout(() => setFirstNameInputNote(false), 2000)
                          }
                          e.target.value = sanitized
                        },
                      })}
                      className={errors.firstName ? 'border-red-500/50' : ''}
                    />
                    {errors.firstName ? (
                      <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>
                    ) : firstNameInputNote ? (
                      <p className="text-red-400 text-xs mt-1">Only alphabetic characters are allowed</p>
                    ) : null}
                  </div>
                  <div>
                    <Input
                      placeholder="Last Name"
                      {...register('lastName', {
                        onChange: (e) => {
                          const sanitized = sanitizeNameInput(e.target.value)
                          if (sanitized !== e.target.value) {
                            setLastNameInputNote(true)
                            if (lastNameNoteTimeoutRef.current) clearTimeout(lastNameNoteTimeoutRef.current)
                            lastNameNoteTimeoutRef.current = setTimeout(() => setLastNameInputNote(false), 2000)
                          }
                          e.target.value = sanitized
                        },
                      })}
                      className={errors.lastName ? 'border-red-500/50' : ''}
                    />
                    {errors.lastName ? (
                      <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>
                    ) : lastNameInputNote ? (
                      <p className="text-red-400 text-xs mt-1">Only alphabetic characters are allowed</p>
                    ) : null}
                  </div>
                </div>

                {/* ── Sex & Age ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div ref={sexRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSexOpen((prev) => !prev)}
                      className={`w-full h-11 rounded-lg border px-3 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                        isDark
                          ? 'bg-[#0A1628] border-[#1E293B] text-white'
                          : 'bg-white border-gray-200 text-gray-900'
                      } ${errors.sex ? 'border-red-500/50' : ''} ${!watch('sex') ? (isDark ? 'text-gray-400' : 'text-gray-500') : ''}`}
                    >
                      {watch('sex') || 'Sex'}
                    </button>
                    <input type="hidden" {...register('sex')} />
                    <ChevronDown
                      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform ${isSexOpen ? 'rotate-180' : ''} ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    />
                    {isSexOpen && (
                      <div
                        className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${
                          isDark
                            ? 'bg-[#111C32] border-[#1E293B]'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        {['Male', 'Female'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setValue('sex', option, { shouldValidate: true })
                              setIsSexOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                              isDark
                                ? 'text-gray-200 hover:bg-white/10'
                                : 'text-gray-700 hover:bg-gray-100'
                            } ${option === watch('sex') ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                    {errors.sex && (
                      <p className="text-red-400 text-xs mt-1">{errors.sex.message}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Age"
                      min="18"
                      max="120"
                      {...register('age')}
                      className={errors.age ? '!border-red-500 !ring-2 !ring-red-500/30' : ''}
                    />
                    {errors.age && (
                      <p className="text-red-400 text-xs mt-1">{errors.age.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Input
                    type="email"
                    placeholder="Email address"
                    {...register('email', {
                      onBlur: (e) => {
                        const val = e.target.value
                        setEmailSuggestion(val ? suggestEmailDomain(val) : null)
                      },
                    })}
                    className={errors.email ? 'border-red-500/50' : ''}
                  />
                  {emailSuggestion && !errors.email && (
                    <p className={`text-xs mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                      Did you mean{' '}
                      <button
                        type="button"
                        className="underline font-medium hover:opacity-80"
                        onClick={() => {
                          setValue('email', emailSuggestion, { shouldValidate: true })
                          setEmailSuggestion(null)
                        }}
                      >
                        {emailSuggestion}
                      </button>
                      ?
                    </p>
                  )}
                  {!emailSuggestion && (
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      Use a valid email format (e.g., juandelacruz@gmail.com)
                    </p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium select-none ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>+63</span>
                    <Input
                      type="tel"
                      placeholder="9XX XXX XXXX"
                      value={phoneDisplay}
                      onChange={handlePhoneChange}
                      className={`pl-12 ${errors.phone || phoneInputError ? '!border-red-500 !ring-2 !ring-red-500/30' : ''}`}
                    />
                    <input type="hidden" {...register('phone')} />
                  </div>
                  {errors.phone && (
                    <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>
                  )}
                  {!errors.phone && !phonePrefixError && phoneInputError && (
                    <p className="text-red-400 text-xs mt-1">Please enter numbers only</p>
                  )}
                  {!errors.phone && phonePrefixError && (
                    <p className="text-red-400 text-xs mt-1">Contact number must start with 9 after +63</p>
                  )}
                </div>
              </div>

              {/* ── Divider ── */}
              <div className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`} />

              {/* ── Property Type ── */}
              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Property Type
                </p>

                <div ref={classificationRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsClassificationOpen((prev) => !prev)}
                    className={`w-full h-11 rounded-lg border px-3 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                      isDark
                        ? 'bg-[#0A1628] border-[#1E293B] text-white'
                        : 'bg-white border-gray-200 text-gray-900'
                    } ${errors.apartmentClassification ? 'border-red-500/50' : ''} ${!apartmentClassification ? (isDark ? 'text-gray-400' : 'text-gray-500') : ''}`}
                  >
                    {apartmentClassification || 'Select apartment type'}
                  </button>
                  <input type="hidden" {...register('apartmentClassification')} />
                  <ChevronDown
                    className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform ${isClassificationOpen ? 'rotate-180' : ''} ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  />

                  {isClassificationOpen && (
                    <div
                      className={`absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${
                        isDark
                          ? 'bg-[#111C32] border-[#1E293B]'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      {apartmentClassifications.map((classification) => (
                        <button
                          key={classification}
                          type="button"
                          onClick={() => {
                            setValue('apartmentClassification', classification, { shouldValidate: true })
                            setValue('numberOfUnits', '')
                            setValue('numberOfFloors', '')
                            setValue('numberOfRooms', '')
                            setValue('otherPropertyDetails', '')
                            setIsClassificationOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                            isDark
                              ? 'text-gray-200 hover:bg-white/10'
                              : 'text-gray-700 hover:bg-gray-100'
                          } ${classification === apartmentClassification ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                        >
                          {classification}
                        </button>
                      ))}
                    </div>
                  )}

                  {errors.apartmentClassification && (
                    <p className="text-red-400 text-xs mt-1">{errors.apartmentClassification.message}</p>
                  )}
                </div>

                {apartmentClassification && (needsUnits || needsFloors || needsRooms || needsOtherDetails) && (
                  <div className={`rounded-lg border p-3 space-y-3 animate-in fade-in duration-200 ${
                    isDark
                      ? 'border-[#1E293B] bg-[#0A1628]'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Additional Property Details
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {needsUnits && (
                        <div>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Number of units"
                            {...register('numberOfUnits', {
                              onChange: (e) => {
                                e.target.value = e.target.value.replace(/\D/g, '')
                              },
                            })}
                            className={errors.numberOfUnits ? 'border-red-500/50' : ''}
                          />
                          {errors.numberOfUnits && (
                            <p className="text-red-400 text-xs mt-1">{errors.numberOfUnits.message}</p>
                          )}
                        </div>
                      )}

                      {needsFloors && (
                        <div>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder={apartmentClassification === 'Townhouse' ? 'Number of residential units' : 'Number of floors'}
                            {...register('numberOfFloors', {
                              onChange: (e) => {
                                e.target.value = e.target.value.replace(/\D/g, '')
                              },
                            })}
                            className={errors.numberOfFloors ? 'border-red-500/50' : ''}
                          />
                          {errors.numberOfFloors && (
                            <p className="text-red-400 text-xs mt-1">{errors.numberOfFloors.message}</p>
                          )}
                        </div>
                      )}

                      {needsRooms && (
                        <div>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Number of rooms"
                            {...register('numberOfRooms', {
                              onChange: (e) => {
                                e.target.value = e.target.value.replace(/\D/g, '')
                              },
                            })}
                            className={errors.numberOfRooms ? 'border-red-500/50' : ''}
                          />
                          {errors.numberOfRooms && (
                            <p className="text-red-400 text-xs mt-1">{errors.numberOfRooms.message}</p>
                          )}
                        </div>
                      )}

                      {needsOtherDetails && (
                        <div className="sm:col-span-2">
                          <Input
                            type="text"
                            placeholder="Describe your property (e.g., 12-room rental property)"
                            {...register('otherPropertyDetails')}
                            className={errors.otherPropertyDetails ? 'border-red-500/50' : ''}
                          />
                          {errors.otherPropertyDetails && (
                            <p className="text-red-400 text-xs mt-1">{errors.otherPropertyDetails.message}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Divider ── */}
              <div className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`} />

              {/* ── Property Location ── */}
              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Property Location
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div ref={provinceRef}>
                    <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Province <span className="text-red-500">*</span>
                    </p>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProvinceOpen((prev) => !prev)
                          setIsCityOpen(false)
                          setIsClassificationOpen(false)
                        }}
                        className={`w-full h-11 rounded-lg border px-3 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                          isDark
                            ? 'bg-[#0A1628] border-[#1E293B] text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        } ${errors.province ? 'border-red-500/50' : ''} ${!selectedProvince ? (isDark ? 'text-gray-400' : 'text-gray-500') : ''}`}
                      >
                        {selectedProvince || 'Select province'}
                      </button>
                      <input type="hidden" {...register('province')} />
                      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform ${isProvinceOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />

                      {isProvinceOpen && (
                        <div className={`absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${
                          isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
                        }`}>
                          {PROVINCE_LIST.map((province) => (
                            <button
                              key={province}
                              type="button"
                              onClick={() => {
                                setValue('province', province, { shouldValidate: true })
                                setValue('cityMunicipality', '', { shouldValidate: true })
                                setValue('barangay', '', { shouldValidate: false })
                                setValue('zipCode', '', { shouldValidate: true })
                                setBarangayList([])
                                setIsProvinceOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                                isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                              } ${province === selectedProvince ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                            >
                              {province}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.province && (
                      <p className="text-red-400 text-xs mt-1">{errors.province.message}</p>
                    )}
                  </div>

                  <div ref={cityRef}>
                    <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      City / Municipality <span className="text-red-500">*</span>
                    </p>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedProvince) return
                          setIsCityOpen((prev) => !prev)
                          setIsProvinceOpen(false)
                          setIsClassificationOpen(false)
                        }}
                        disabled={!selectedProvince}
                        className={`w-full h-11 rounded-lg border px-3 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                          isDark
                            ? 'bg-[#0A1628] border-[#1E293B] text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        } ${errors.cityMunicipality ? 'border-red-500/50' : ''} ${!selectedCityMunicipality ? (isDark ? 'text-gray-400' : 'text-gray-500') : ''} ${!selectedProvince ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {selectedCityMunicipality || (selectedProvince ? 'Select city' : 'Select province first')}
                      </button>
                      <input type="hidden" {...register('cityMunicipality')} />
                      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform ${isCityOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />

                      {isCityOpen && selectedProvince && (
                        <div className={`absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${
                          isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
                        }`}>
                          {getCitySuggestions(selectedProvince).map((city) => (
                            <button
                              key={city}
                              type="button"
                              onClick={() => {
                                setValue('cityMunicipality', city, { shouldValidate: true })
                                setValue('barangay', '', { shouldValidate: false })
                                setIsCityOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                                isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                              } ${city === selectedCityMunicipality ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.cityMunicipality && (
                      <p className="text-red-400 text-xs mt-1">{errors.cityMunicipality.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Street / Building <span className="text-red-500">*</span>
                    </p>
                    <Input
                      type="text"
                      placeholder="e.g. 123 Rizal Ave, Bldg A"
                      {...register('streetBuilding')}
                      className={errors.streetBuilding ? 'border-red-500/50' : ''}
                    />
                    {errors.streetBuilding && (
                      <p className="text-red-400 text-xs mt-1">{errors.streetBuilding.message}</p>
                    )}
                  </div>

                  <div ref={barangayRef}>
                    <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Barangay <span className="text-red-500">*</span>
                    </p>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedCityMunicipality || isLoadingBarangays || barangayList.length === 0) return
                          setIsBarangayOpen((prev) => !prev)
                          setIsProvinceOpen(false)
                          setIsCityOpen(false)
                          setIsClassificationOpen(false)
                          setBarangaySearch('')
                          setTimeout(() => barangaySearchRef.current?.focus(), 100)
                        }}
                        disabled={!selectedCityMunicipality || isLoadingBarangays}
                        className={`w-full h-11 rounded-lg border px-3 pr-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                          isDark
                            ? 'bg-[#0A1628] border-[#1E293B] text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        } ${errors.barangay ? 'border-red-500/50' : ''} ${!selectedBarangay ? (isDark ? 'text-gray-400' : 'text-gray-500') : ''} ${!selectedCityMunicipality || isLoadingBarangays ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {isLoadingBarangays ? 'Loading barangays...' : selectedBarangay || (selectedCityMunicipality ? 'Select barangay' : 'Select city first')}
                      </button>
                      <input type="hidden" {...register('barangay')} />
                      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform ${isBarangayOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />

                      {isBarangayOpen && barangayList.length > 0 && (
                        <div className={`absolute z-50 mt-1 w-full max-h-64 rounded-lg border shadow-lg animate-in fade-in zoom-in-95 duration-150 ${
                          isDark ? 'bg-[#111C32] border-[#1E293B]' : 'bg-white border-gray-200'
                        }`}>
                          <div className={`sticky top-0 p-2 border-b ${isDark ? 'border-[#1E293B] bg-[#111C32]' : 'border-gray-100 bg-white'}`}>
                            <input
                              ref={barangaySearchRef}
                              type="text"
                              placeholder="Search barangay..."
                              value={barangaySearch}
                              onChange={(e) => setBarangaySearch(e.target.value)}
                              className={`w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                isDark ? 'bg-[#0A1628] border-[#1E293B] text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                              }`}
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {barangayList
                              .filter((b) => b.toLowerCase().includes(barangaySearch.toLowerCase()))
                              .map((brgy) => (
                                <button
                                  key={brgy}
                                  type="button"
                                  onClick={() => {
                                    setValue('barangay', brgy, { shouldValidate: true })
                                    setIsBarangayOpen(false)
                                    setBarangaySearch('')
                                  }}
                                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                                    isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                                  } ${brgy === selectedBarangay ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
                                >
                                  {brgy}
                                </button>
                              ))}
                            {barangayList.filter((b) => b.toLowerCase().includes(barangaySearch.toLowerCase())).length === 0 && (
                              <p className={`px-3 py-2.5 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No results found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.barangay && (
                      <p className="text-red-400 text-xs mt-1">{errors.barangay.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Zip Code <span className="text-red-500">*</span>
                    </p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Auto-filled"
                      readOnly={!!selectedCityMunicipality && !!getZipCodeForLocation(selectedCityMunicipality)}
                      {...register('zipCode', {
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4)
                        },
                      })}
                      className={`${errors.zipCode ? 'border-red-500/50' : ''} ${
                        selectedCityMunicipality && getZipCodeForLocation(selectedCityMunicipality)
                          ? (isDark ? 'bg-[#0A1628]/50' : 'bg-gray-50')
                          : ''
                      }`}
                    />
                    {selectedCityMunicipality && getZipCodeForLocation(selectedCityMunicipality) && !errors.zipCode && (
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Auto-detected from {selectedCityMunicipality}
                      </p>
                    )}
                    {errors.zipCode && (
                      <p className="text-red-400 text-xs mt-1">{errors.zipCode.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full text-base font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
