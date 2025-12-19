import { MainLayout } from '@/components/layout/MainLayout';
import { User, Bell, Shield, Palette, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const settingsSections = [
  { icon: User, title: 'Profile Settings', description: 'Manage your account details and preferences' },
  { icon: Bell, title: 'Notifications', description: 'Configure alert and notification preferences' },
  { icon: Shield, title: 'Security', description: 'Password, 2FA, and security settings' },
  { icon: Palette, title: 'Appearance', description: 'Theme and display preferences' },
  { icon: HelpCircle, title: 'Help & Support', description: 'Get help and contact support' },
];

const Settings = () => {
  const { user } = useAuth();

  return (
    <MainLayout title="Settings">
      <div className="max-w-2xl animate-fade-in">
        {/* Profile Info */}
        <div className="stat-card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{user?.email?.split('@')[0] || 'Doctor'}</h2>
              <p className="text-sm text-muted-foreground">Email: {user?.email || 'N/A'}</p>
              <p className="text-sm text-primary">Doctor Account</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {settingsSections.map((section) => (
            <div
              key={section.title}
              className="stat-card flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                // TODO: Implement settings sections
                console.log(`Navigate to ${section.title}`);
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <section.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{section.title}</h3>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
