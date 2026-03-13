import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Bell, BarChart3, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTheme } from '@/context/ThemeContext'
import { useInView } from '@/hooks/useInView'
import { submitInquiry } from '@/lib/api'

const inquirySchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string()
    .regex(/^09\d{9}$/, 'Enter a valid PH mobile number (e.g. 09171234567)'),
  apartmentName: z.string().min(2, 'Apartment name is required'),
  message: z.string().optional(),
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

export default function Contact() {
  const { isDark } = useTheme()
  const { ref, isInView } = useInView()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InquiryForm>({
    resolver: zodResolver(inquirySchema),
  })

  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [phoneInputError, setPhoneInputError] = useState(false)

  const formatPhoneDisplay = (digits: string) => {
    if (digits.length <= 4) return digits
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    // Check if user typed non-numeric characters (ignore spaces from formatting)
    if (/[^\d\s]/.test(input)) {
      toast.error('Please enter numbers only')
      setPhoneInputError(true)
      setTimeout(() => setPhoneInputError(false), 1500)
    }
    const raw = input.replace(/\D/g, '').slice(0, 11)
    setPhoneDisplay(formatPhoneDisplay(raw))
    setValue('phone', raw, { shouldValidate: raw.length === 11 })
  }

  const onSubmit = async (data: InquiryForm) => {
    try {
      await submitInquiry({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        apartment_name: data.apartmentName,
        message: data.message || '',
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
              property owners, managers, and tenants today.
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
          <div className={`rounded-2xl p-6 lg:p-8 shadow-xl mt-8 ${isInView ? 'fade-up-visible fade-up-delay-2' : 'fade-up-hidden'} ${
            isDark
              ? 'bg-navy-card border border-white/5'
              : 'bg-white border border-gray-200'
          }`}>
            <h3 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Send Us an Inquiry
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    placeholder="First Name"
                    {...register('firstName')}
                    className={errors.firstName ? 'border-red-500/50' : ''}
                  />
                  {errors.firstName && (
                    <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Input
                    placeholder="Last Name"
                    {...register('lastName')}
                    className={errors.lastName ? 'border-red-500/50' : ''}
                  />
                  {errors.lastName && (
                    <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Input
                  type="email"
                  placeholder="Email Address"
                  {...register('email')}
                  className={errors.email ? 'border-red-500/50' : ''}
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium select-none ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>+63</span>
                  <Input
                    type="tel"
                    placeholder="09XX XXX XXXX"
                    value={phoneDisplay}
                    onChange={handlePhoneChange}
                    className={`pl-12 ${errors.phone || phoneInputError ? '!border-red-500 !ring-2 !ring-red-500/30' : ''}`}
                  />
                  <input type="hidden" {...register('phone')} />
                </div>
                {errors.phone && (
                  <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <Input
                  placeholder="Apartment Name"
                  {...register('apartmentName')}
                  className={errors.apartmentName ? 'border-red-500/50' : ''}
                />
                {errors.apartmentName && (
                  <p className="text-red-400 text-xs mt-1">{errors.apartmentName.message}</p>
                )}
              </div>

              <div>
                <Textarea
                  placeholder="Message us for your inquiries..."
                  {...register('message')}
                  rows={4}
                />
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
