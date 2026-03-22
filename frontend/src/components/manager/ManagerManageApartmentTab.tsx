import { useState } from 'react'
import { Building2, Users, Megaphone, FileText, ClipboardList } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import ManagerApartmentsTab from './ManagerApartmentsTab'
import ManagerTenantsTab from './ManagerTenantsTab'
import ManagerAnnouncementsTab from './ManagerAnnouncementsTab'
import ManagerDocumentsTab from './ManagerDocumentsTab'
import ManagerApartmentLogsTab from './ManagerApartmentLogsTab'

interface ManagerManageApartmentTabProps {
  clientId: string
  managerName: string
  managerId: string
}

export default function ManagerManageApartmentTab({ clientId, managerName, managerId }: ManagerManageApartmentTabProps) {
  const { isDark } = useTheme()
  const [activeSubTab, setActiveSubTab] = useState<'units' | 'tenants' | 'announcements' | 'documents' | 'logs'>('units')

  const subTabs = [
    { id: 'units' as const, label: 'Units', icon: Building2 },
    { id: 'tenants' as const, label: 'Tenants', icon: Users },
    { id: 'announcements' as const, label: 'Announcements', icon: Megaphone },
    { id: 'documents' as const, label: 'Documents', icon: FileText },
    { id: 'logs' as const, label: 'Activity Logs', icon: ClipboardList },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 animate-fade-up">
      {/* Page Header */}
      <div>
        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Manage Apartment
        </h2>
        <p className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Manage your units, tenants, and announcements
        </p>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {subTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeSubTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-white shadow-md'
                  : isDark
                  ? 'bg-[#111D32] text-gray-400 hover:text-white border border-[#1E293B] hover:border-primary/30'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-primary/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Sub-Tab Content */}
      {activeSubTab === 'units' && <ManagerApartmentsTab clientId={clientId} />}
      {activeSubTab === 'tenants' && <ManagerTenantsTab clientId={clientId} />}
      {activeSubTab === 'announcements' && <ManagerAnnouncementsTab clientId={clientId} managerId={managerId} managerName={managerName} />}
      {activeSubTab === 'documents' && <ManagerDocumentsTab clientId={clientId} managerId={managerId} />}
      {activeSubTab === 'logs' && <ManagerApartmentLogsTab clientId={clientId} managerId={managerId} managerName={managerName} />}
    </div>
  )
}
