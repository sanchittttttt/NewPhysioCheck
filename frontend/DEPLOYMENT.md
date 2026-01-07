# Deployment Guide (Vercel)

This application is ready to be deployed to Vercel. Follow these steps to deploy your React frontend.

## Prerequisites

- A [Vercel](https://vercel.com/) account.
- A [Supabase](https://supabase.com/) project.
- Your GitHub repository connected to Vercel (recommended).

## Security Note: Environment Variables
I have configured the project to exclude sensitive files from Git.
- **Root `.gitignore`**: Protects the entire repository from leaking secrets.
- **`.env.example`**: Located in the `frontend` folder. Use this as a guide for which keys you must provide to Vercel.

## Deployment Steps (GitHub Integration)

1.  **Push to GitHub**: Ensure your latest code is pushed.
2.  **Log in to Vercel**: Import your repository.
3.  **Configure Project**:
    - **Root Directory**: Click "Edit" and select the **`frontend`** directory. (CRITICAL: The `package.json` is inside this folder).
    - **Framework Preset**: Should be auto-detected as **Vite**.
4.  **Environment Variables**:
    - Reference [frontend/.env.example](file:///c:/Users/pavan/Cloned%20repo/NewPhysioCheck/frontend/.env.example) for required keys.
    - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel dashboard.
5.  **Deploy**: Click **"Deploy"**.

## SPA Routing
A `vercel.json` file is present in the `frontend` directory. This handles SPA routing, ensuring that page refreshes on internal routes (like `/patients`) don't result in 404s.

## Troubleshooting
- **Build Errors**: Ensure your "Root Directory" is set to `frontend` in Vercel.
- **Connection Issues**: Verify the Supabase URL and Anon Key match your Supabase project settings.
