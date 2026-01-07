# PhysioCheck Care Portal - Frontend

React + TypeScript + Vite frontend for the PhysioCheck Care Portal digital rehabilitation platform.

## Setup

### Prerequisites

- Node.js 18+ (or Bun)
- npm, yarn, or bun package manager

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   # or
   bun install
   ```

2. **Configure environment variables:**
   
   Copy the example environment file and fill in your credentials from Supabase:
   ```bash
   cp .env.example .env
   ```
   
   Your `.env` should look like this:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_URL=http://localhost:8000/api/v1
   ```
   
   **Where to get these:**
   - **VITE_SUPABASE_URL**: Supabase Dashboard → Settings → API → Project URL
   - **VITE_SUPABASE_ANON_KEY**: Supabase Dashboard → Settings → API → `anon` `public` key
   - **VITE_API_URL**: Your backend API base URL (defaults to localhost)

3. **Run the development server:**
   ```bash
   npm run dev
   # or
   bun dev
   ```
   
   The app will be available at `http://localhost:8080`

4. **Build for production:**
   ```bash
   npm run build
   # or
   bun run build
   ```

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx                 # App entry point
│   ├── App.tsx                  # Root component with routing
│   ├── index.css                # Global styles
│   │
│   ├── pages/                   # Page components
│   │   ├── Index.tsx            # Doctor dashboard
│   │   ├── Login.tsx            # Authentication page
│   │   ├── Patients.tsx         # Patient list (doctor)
│   │   ├── ProtocolBuilder.tsx  # Protocol creation (doctor)
│   │   ├── Sessions.tsx         # Session management (doctor)
│   │   ├── Messages.tsx         # Messaging (doctor)
│   │   ├── Analytics.tsx        # Analytics dashboard (doctor)
│   │   ├── Settings.tsx         # Settings (doctor)
│   │   ├── NotFound.tsx         # 404 page
│   │   └── patient/             # Patient-specific pages
│   │       ├── PatientHome.tsx
│   │       ├── PatientSessions.tsx
│   │       ├── PatientSessionActive.tsx
│   │       ├── PatientProgress.tsx
│   │       ├── PatientMessages.tsx
│   │       └── PatientSettings.tsx
│   │
│   ├── components/              # Reusable components
│   │   ├── layout/              # Layout components
│   │   │   ├── MainLayout.tsx   # Doctor layout with sidebar
│   │   │   ├── PatientLayout.tsx # Patient layout
│   │   │   ├── Sidebar.tsx      # Doctor sidebar navigation
│   │   │   └── TopBar.tsx       # Top navigation bar
│   │   ├── dashboard/           # Dashboard components
│   │   │   ├── StatCard.tsx
│   │   │   ├── AdherenceChart.tsx
│   │   │   ├── RomPainChart.tsx
│   │   │   ├── PatientsAttention.tsx
│   │   │   └── RecentMessages.tsx
│   │   ├── ui/                  # shadcn/ui components
│   │   └── ProtectedRoute.tsx   # Route protection component
│   │
│   ├── context/                 # React contexts
│   │   └── AuthContext.tsx      # Authentication context
│   │
│   ├── lib/                     # Utilities and clients
│   │   ├── supabaseClient.ts    # Supabase client setup
│   │   ├── apiClient.ts         # Axios API client with JWT interceptor
│   │   ├── utils.ts             # Helper functions
│   │   └── database.types.ts    # Supabase TypeScript types
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   │
│   └── data/                    # Mock data (temporary)
│       ├── mockData.ts          # Doctor mock data
│       └── patientMockData.ts   # Patient mock data
│
├── public/                      # Static assets
├── package.json                 # Dependencies
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── .env.example                 # Template for environment variables (copy this)
├── .env                         # Your local environment variables (GIT IGNORED)
```

## Key Features

### Authentication

- **Supabase Auth**: Email/password authentication
- **Role-based routing**: Separate doctor and patient interfaces
- **Protected routes**: Automatic redirects based on authentication state
- **Session persistence**: Login state persists across page refreshes

### Routing

- **Public routes**: `/` (login), `/login`
- **Doctor routes**: `/dashboard`, `/patients`, `/protocol-builder`, `/sessions`, `/messages`, `/analytics`, `/settings`
- **Patient routes**: `/patient/home`, `/patient/sessions`, `/patient/progress`, `/patient/messages`, `/patient/settings`

### State Management

- **React Context**: Authentication state via `AuthContext`
- **React Query**: API data fetching and caching (configured but not yet implemented)
- **Local Storage**: Role storage for simple role-based access

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Test Credentials

For testing, use these credentials (create these users in Supabase):

- **Doctor**: `sanchitdubbewar08@gmail.com` / `test123456`
- **Patient**: `sbcv32@gmail.com` / `test123456`

These are displayed on the login page for quick testing.

## Authentication Flow

1. User visits `/` → Shows login page
2. User selects role (Doctor/Patient) and enters credentials
3. On successful login:
   - Role is stored in `localStorage`
   - User is redirected to appropriate dashboard
   - Supabase session is persisted
4. Protected routes check:
   - Authentication status
   - Role match (if required)
   - Redirects to login or appropriate dashboard if access denied

## API Integration

The frontend uses Axios for API calls with automatic JWT token injection. See `BACKEND_INTEGRATION.md` for detailed API integration guide.

### Making API Calls

```typescript
import api from '@/lib/apiClient';

// GET request
const response = await api.get('/patients');
const patients = response.data;

// POST request
const newPatient = await api.post('/patients', {
  full_name: 'John Doe',
  condition: 'Knee injury'
});
```

The API client automatically:
- Adds `Authorization: Bearer <token>` header
- Uses base URL from `VITE_API_URL`
- Handles authentication errors

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library (Radix UI + Tailwind)
- **Dark theme**: Custom dark theme with teal accents
- **Responsive**: Mobile-first responsive design

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_API_URL` | Backend API base URL | No (defaults to `http://localhost:8000/api/v1`) |

**Note**: All Vite environment variables must be prefixed with `VITE_` to be exposed to the client.

## Next Steps

1. Replace mock data with real API calls (see `BACKEND_INTEGRATION.md`)
2. Implement React Query for data fetching
3. Add error boundaries
4. Implement real-time features (Supabase Realtime)
5. Add loading states and error handling
6. Implement form validation
7. Add unit and integration tests

## Troubleshooting

### "Missing VITE_SUPABASE_URL" error
- Make sure `.env` file exists in the `frontend` directory
- Restart the dev server after creating/modifying `.env`

### CORS errors
- Ensure backend CORS is configured to allow `http://localhost:8080`
- Check `VITE_API_URL` is correct

### Authentication not working
- Verify Supabase credentials in `.env`
- Check browser console for detailed errors
- Ensure users exist in Supabase Authentication

## Support

For backend integration, see:
- `BACKEND_INTEGRATION.md` - Complete API integration guide
- Backend `FRONTEND_INTEGRATION.md` - Backend API reference

---

## Security

This repository is configured with a two-layer `.gitignore` system (root and frontend) to ensure that sensitive files like `.env` are never committed to version control. Always use the `.env.example` file to communicate required variables to other developers or deployment platforms.

---

**Last Updated:** January 2026  
**Frontend Version:** 1.0.1
