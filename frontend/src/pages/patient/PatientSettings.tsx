import { User, Bell, Shield, Palette, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import { PatientLayout } from '@/components/layout/PatientLayout';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const settingsSections = [
  { icon: User, label: 'Profile Settings', description: 'Update your personal information' },
  { icon: Bell, label: 'Notifications', description: 'Manage notification preferences' },
  { icon: Shield, label: 'Privacy & Security', description: 'Control your data and privacy' },
  { icon: Palette, label: 'Appearance', description: 'Customize the app appearance' },
  { icon: HelpCircle, label: 'Help & Support', description: 'Get help and contact support' },
];

export default function PatientSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <PatientLayout title="Settings" subtitle="Manage your account and preferences">
      {/* Profile Card */}
      <div className="stat-card mb-4 md:mb-6">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
            <User className="w-6 h-6 md:w-8 md:h-8 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-semibold text-foreground truncate">
              {user?.email?.split('@')[0] || 'Patient'}
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">Email: {user?.email || 'N/A'}</p>
            <p className="text-xs md:text-sm text-primary truncate">Patient Account</p>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="stat-card">
        <div className="space-y-1">
          {settingsSections.map((section) => (
            <button
              key={section.label}
              className="w-full flex items-center justify-between p-3 md:p-4 rounded-lg hover:bg-secondary/50 transition-colors"
              onClick={() => {
                // TODO: Implement settings sections
                console.log(`Navigate to ${section.label}`);
              }}
            >
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <h3 className="font-medium text-foreground text-sm md:text-base">{section.label}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{section.description}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>

        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-3 md:p-4 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-sm md:text-base">Sign Out</h3>
                <p className="text-xs md:text-sm opacity-70">Log out of your account</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
          </button>
        </div>
      </div>
    </PatientLayout>
  );
}
