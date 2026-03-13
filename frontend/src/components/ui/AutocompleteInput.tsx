import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ChevronDown } from 'lucide-react'

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
  isDark?: boolean
}

export default function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  isDark = false,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [filtered, setFiltered] = useState<string[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      const lower = value.toLowerCase()
      setFiltered(suggestions.filter((s) => s.toLowerCase().includes(lower)))
    } else {
      setFiltered(suggestions)
    }
  }, [value, suggestions])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`${className} pr-8`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(!open)}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div
          className={`absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border shadow-lg ${
            isDark
              ? 'bg-[#111C32] border-[#1E293B]'
              : 'bg-white border-gray-200'
          }`}
        >
          {filtered.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                onChange(item)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                isDark
                  ? 'text-gray-200 hover:bg-white/10'
                  : 'text-gray-700 hover:bg-gray-100'
              } ${item === value ? (isDark ? 'bg-white/5 font-medium' : 'bg-gray-50 font-medium') : ''}`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
