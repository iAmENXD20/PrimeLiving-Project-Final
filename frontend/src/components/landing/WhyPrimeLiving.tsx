import { CheckCircle } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useInView } from '@/hooks/useInView'

const benefits = [
  'Centralized apartment management across multiple buildings',
  'Real-time SMS notifications for rent and announcements',
  'Secure role-based access for admins, apartment managers, and tenants',
  'Interactive maps showing apartment locations',
  'Automated account creation with secure credentials',
  'Digital payment receipts and transaction history',
]

export default function WhyPrimeLiving() {
  const { isDark } = useTheme()
  const { ref, isInView } = useInView()

  return (
    <section id="benefits" ref={ref} className="py-20 lg:py-28 relative">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          {/* Left content */}
          <div>
            <span className={`text-primary font-semibold text-sm tracking-widest uppercase ${isInView ? 'fade-up-visible' : 'fade-up-hidden'}`}>
              Why PrimeLiving
            </span>
            <h2 className={`mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight ${isInView ? 'fade-up-visible fade-up-delay-1' : 'fade-up-hidden'} ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Centralized System. Independent Control.
            </h2>

            <div className={`mt-8 space-y-5 ${isInView ? 'fade-up-visible fade-up-delay-2' : 'fade-up-hidden'}`}>
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 group"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className={`text-base sm:text-lg transition-colors duration-200 ${
                    isDark
                      ? 'text-gray-300 group-hover:text-white'
                      : 'text-gray-600 group-hover:text-gray-900'
                  }`}>
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right image */}
          <div className={`relative ${isInView ? 'fade-up-visible fade-up-delay-3' : 'fade-up-hidden'}`}>
            <div className={`relative rounded-2xl overflow-hidden shadow-2xl ${
              isDark ? 'border border-white/10' : 'ring-1 ring-gray-200'
            }`}>
              <img
                src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=500&fit=crop&q=80"
                alt="Modern apartment living"
                className="w-full h-[450px] lg:h-[550px] object-cover"
              />
              {/* Overlay gradient */}
              <div className={`absolute inset-0 ${
                isDark
                  ? 'bg-gradient-to-t from-dark/40 to-transparent'
                  : 'bg-gradient-to-t from-black/20 to-transparent'
              }`} />
            </div>
            {/* Decorative glow */}
            <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  )
}
