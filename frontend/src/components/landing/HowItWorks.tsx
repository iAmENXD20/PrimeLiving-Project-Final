import { Home, Building2, Users } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useInView } from '@/hooks/useInView'

const roles = [
  {
    number: 1,
    icon: Home,
    title: 'Apartment Owner',
    description:
      'Oversees all apartments, manages manager accounts, views analytics, and handles system-wide inquiries.',
  },
  {
    number: 2,
    icon: Building2,
    title: 'Apartment Manager',
    description:
      'Creates tenant accounts, posts announcements, tracks payments, manages maintenance requests.',
  },
  {
    number: 3,
    icon: Users,
    title: 'Tenant',
    description:
      'Views rent status, receives announcements, submits maintenance requests, uses chatbot, and pays via GCash.',
  },
]

export default function HowItWorks() {
  const { isDark } = useTheme()
  const { ref, isInView } = useInView()

  return (
    <section ref={ref} className={`py-20 lg:py-28 relative ${isDark ? 'bg-navy/50' : 'bg-gray-50'}`}>
      {/* Top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-16">
        {/* Section header */}
        <div className={`text-center mb-16 ${isInView ? 'fade-up-visible' : 'fade-up-hidden'}`}>
          <span className="text-primary font-semibold text-sm tracking-widest uppercase">
            How It Works
          </span>
          <h2 className={`mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Three Roles, One Platform
          </h2>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {roles.map((role) => (
            <div
              key={role.title}
              className={`relative rounded-xl p-8 text-center transition-all duration-300 group hover:shadow-lg hover:shadow-primary/5 ${isInView ? 'fade-up-visible' : 'fade-up-hidden'} ${
                isDark
                  ? 'bg-navy-card border border-white/5 hover:border-primary/30'
                  : 'bg-white border border-gray-200 hover:border-primary/40 shadow-sm'
              }`}
              style={{ transitionDelay: isInView ? `${0.15 + role.number * 0.15}s` : '0s' }}
            >
              {/* Number badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/30">
                  {role.number}
                </div>
              </div>

              {/* Icon */}
              <div className={`w-16 h-16 mx-auto mt-4 mb-5 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                isDark
                  ? 'bg-white/5 border border-white/10 group-hover:border-primary/30'
                  : 'bg-gray-50 border border-gray-200 group-hover:border-primary/30'
              }`}>
                <role.icon className="w-8 h-8 text-primary" />
              </div>

              {/* Content */}
              <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {role.title}
              </h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {role.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
