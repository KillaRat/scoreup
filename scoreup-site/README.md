# ScoreUp — SAT & ACT Study Hub

AI-powered adaptive test prep for SAT and ACT students.

## Deploy to Vercel (2 minutes)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create scoreup --public --push
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com) → New Project
   - Import your GitHub repo
   - Add these environment variables in the Vercel dashboard:

   | Variable | Value | Where to get it |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
   | `VITE_SUPABASE_URL` | `https://xyz.supabase.co` | [supabase.com](https://supabase.com) → your project → Settings → API |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Same place as above |

3. Click **Deploy** — that's it. You'll get a live URL like `scoreup.vercel.app`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                   # opens at http://localhost:5173
```

## How it works

```
Browser  →  /api/generate  →  Anthropic API  (key stays server-side, never exposed)
Browser  →  Supabase Auth  (email/password, magic link)
```

## Features

- 5-step onboarding (name, test, goal, avatar, difficulty)
- SAT: Reading/Writing + Math (MCQ)
- ACT: English, Math, Science, Writing (MCQ or FRQ)
- AI-generated questions via Claude, targeted to weak subtopics
- 10-question assessments with subtopic breakdown
- 90-day streak calendar
- Leaderboard (weekly / monthly / all-time)
- Profile page with mastery bars, badges, session history
- Dark/light mode toggle
- Fully mobile-responsive
