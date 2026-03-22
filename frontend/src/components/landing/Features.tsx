import {
  Shield,
  Building2,
  Bell,
  CreditCard,
  Wrench,
  MessageSquare,
} from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useInView } from '@/hooks/useInView'

const features = [
  {
    icon: Shield,
    title: 'Apartment Owner Oversight',
    description:
      'Complete apartment monitoring, manager access control, and analytics dashboard for system-wide visibility.',
  },
  {
    icon: Building2,
    title: 'Apartment Management',
    description:
      'Organize tasks, manage tenant records, and monitor rental transactions efficiently.',
  },
  {
    icon: Bell,
    title: 'Real-time Notifications',
    description:
      'SMS-powered announcements and alerts ensure tenants never miss important updates.',
  },
  {
    icon: CreditCard,
    title: 'Payment Tracking',
    description:
      'GCash QR payments with receipt uploads and real-time status tracking.',
  },
  {
    icon: Wrench,
    title: 'Maintenance Requests',
    description:
      'Tenants submit requests, apartment managers track and resolve them with status updates.',
  },
  {
    icon: MessageSquare,
    title: 'FAQs',
    description:
      'Intelligent assistant helps tenants with questions about rent, rules, and more.',
  },
]

export default function Features() {
  const { isDark } = useTheme()
  const { ref, isInView } = useInView()

  return (
    <section id="features" ref={ref} className="py-20 lg:py-28 relative">
      {/* Subtle gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-16">
        {/* Section header */}
        <div className={`text-center mb-16 ${isInView ? 'fade-up-visible' : 'fade-up-hidden'}`}>
          <span className="text-primary font-semibold text-sm tracking-widest uppercase">
            Features
          </span>
          <h2 className={`mt-3 text-4xl sm:text-5xl lg:text-6xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Everything You Need to Manage
          </h2>
          <p className={`mt-4 text-lg sm:text-xl max-w-2xl mx-auto ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            A complete solution for apartment managers and tenants with real-time
            communication and task organization.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative rounded-xl p-6 lg:p-8 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 ${isInView ? 'fade-up-visible' : 'fade-up-hidden'} ${
                isDark
                  ? 'bg-navy-card border border-white/5 hover:border-primary/30'
                  : 'bg-white border border-gray-200 hover:border-primary/40 shadow-sm'
              }`}
              style={{ transitionDelay: isInView ? `${0.1 + index * 0.1}s` : '0s' }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>

              {/* Content */}
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {feature.title}
              </h3>
              <p className={`text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
