import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import WhyPrimeLiving from '@/components/landing/WhyPrimeLiving'
import HowItWorks from '@/components/landing/HowItWorks'
import Contact from '@/components/landing/Contact'
import Footer from '@/components/landing/Footer'
import { useTheme } from '@/context/ThemeContext'

export default function LandingPage() {
  const { isDark } = useTheme()

  return (
    <div className={`min-h-screen ${isDark ? 'bg-dark' : 'bg-white'}`}>
      <Navbar />
      <Hero />
      <Features />
      <WhyPrimeLiving />
      <HowItWorks />
      <Contact />
      <Footer />
    </div>
  )
}
