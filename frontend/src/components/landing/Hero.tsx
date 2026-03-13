import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'
import { useInView } from '@/hooks/useInView'

export default function Hero() {
  const { isDark } = useTheme()
  const { ref, isInView } = useInView({ threshold: 0.1 })

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden pt-20 lg:pt-24">
      {/* Background gradient effects */}
      <div className="absolute inset-0">
        <div className={`absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px] ${
          isDark ? 'bg-primary/5' : 'bg-primary/10'
        }`} />
      </div>

      <div className="relative max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <div>
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 ${isInView ? 'fade-up-visible' : 'fade-up-hidden'} ${
              isDark
                ? 'bg-primary/10 border border-primary/20'
                : 'bg-primary/10 border border-primary/30'
            }`}>
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-yellow-400" />
              </span>
              <span className="text-sm text-primary font-medium">
                Available Now!
              </span>
            </div>

            {/* Heading */}
            <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight ${isInView ? 'fade-up-visible fade-up-delay-1' : 'fade-up-hidden'} ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Built for Growth.
              <br />
              <span className="text-primary">Designed for Control.</span>
            </h1>

            {/* Description */}
            <p className={`mt-6 text-lg sm:text-xl max-w-xl leading-relaxed ${isInView ? 'fade-up-visible fade-up-delay-2' : 'fade-up-hidden'} ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              PrimeLiving offers a centralized web-based system that streamlines
              apartment monitoring, notifications, and task organization
              for independently owned apartments.
            </p>

            {/* CTA Buttons */}
            <div className={`mt-8 flex flex-col sm:flex-row items-start gap-4 ${isInView ? 'fade-up-visible fade-up-delay-3' : 'fade-up-hidden'}`}>
              <a href="#contact">
                <Button size="lg" className="text-base font-semibold px-8">
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </a>
              <a href="#features">
                <Button variant="outline" size="lg" className="text-base font-semibold px-8">
                  Explore Features
                </Button>
              </a>
            </div>

            {/* Divider */}
            <div className={`mt-10 pt-8 ${isInView ? 'fade-up-visible fade-up-delay-4' : 'fade-up-hidden'} ${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
              {/* Roles */}
              <div className="flex flex-wrap items-center gap-3">
                {['Apartment Owners', 'Apartment Managers', 'Tenants'].map((role) => (
                  <span
                    key={role}
                    className="text-sm font-medium text-primary"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Image */}
          <div className={`relative hidden lg:block ${isInView ? 'fade-up-visible fade-up-delay-2' : 'fade-up-hidden'}`}>
            <div className={`relative rounded-2xl overflow-hidden shadow-2xl ${
              !isDark ? 'ring-1 ring-gray-200' : ''
            }`}>
              <img
                src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=700&h=800&fit=crop&q=80"
                alt="Apartment building at night"
                className="w-full h-[600px] object-cover"
              />
              {/* Dark overlay */}
              <div className={`absolute inset-0 ${
                isDark
                  ? 'bg-gradient-to-t from-dark/60 via-dark/20 to-transparent'
                  : 'bg-gradient-to-t from-black/40 via-black/10 to-transparent'
              }`} />
            </div>

            {/* Floating card */}
            <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-[85%] backdrop-blur-md rounded-xl px-5 py-4 flex items-center gap-4 shadow-xl ${
              isDark
                ? 'bg-navy-card/90 border border-white/10'
                : 'bg-white/90 border border-gray-200'
            }`}>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Real-time Monitoring</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Track apartments, payments, and maintenance live
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
