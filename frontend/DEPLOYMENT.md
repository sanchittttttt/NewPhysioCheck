# Deployment Guide (Vercel)

This application is ready to be deployed to Vercel. Follow these steps to deploy your React frontend.

## Prerequisites

- A [Vercel](https://vercel.com/) account.
- A [Supabase](https://supabase.com/) project (which you already have).
- Your GitHub repository connected to Vercel (recommended) or use Vercel CLI.

## Deployment Steps (GitHub Integration)

1.  **Push to GitHub**: Ensure your latest code is pushed to your GitHub repository.
2.  **Log in to Vercel**: Go to [vercel.com](https://vercel.com) and log in.
3.  **Add New Project**:
    - Click **"Add New..."** -> **"Project"**.
    - Import your GitHub repository.
4.  **Configure Project**:
    - **Framework Preset**: Vercel should auto-detect **Vite**.
    - **Root Directory**: Click "Edit" and select `frontend` (since your `package.json` is in the `frontend` folder).
    - **Build Command**: `vite build` (Default)
    - **Output Directory**: `dist` (Default)
    - **Install Command**: `npm install` (Default)
5.  **Environment Variables**:
    - Expand the **"Environment Variables"** section.
    - Add the following variables from your local `.env` file:
        - `VITE_SUPABASE_URL`: (Your Supabase URL)
        - `VITE_SUPABASE_ANON_KEY`: (Your Supabase Anon Key)
6.  **Deploy**:
    - Click **"Deploy"**.
    - Wait for the build to complete.

## SPA Routing Configuration
I have verified that a `vercel.json` file is present in your `frontend` directory. This ensures that refreshing pages like `/messages` or `/patient/home` works correctly by rewriting all requests to `index.html`.

## Verifying Deployment
Once deployed, click the generated URL (e.g., `https://your-project.vercel.app`).
- Try logging in as a demo user (e.g., `Dr. Sarah Chen`).
- Check if real-time messages works.
- Check if database data loads.

## Troubleshooting
- **404 on Refresh**: Ensure `vercel.json` is in the `frontend` folder and deployment root is set to `frontend`.
- **Database Connection Failed**: Double-check your Environment Variables in Vercel settings.
