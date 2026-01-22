# POW_Citadel

Bitcoin POW(Proof of Work) tracking app with Lightning Network donations.

## Features

- Discord OAuth login with role-based access
- Individual POW timer with achievement tracking
- Group POW creation and participation
- Blink Lightning API integration for sats donation
- Discord sharing with reaction tracking
- Leaderboard with popular POW display
- PWA support

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_CHANNEL_ID`
- `DISCORD_GROUP_POW_CHANNEL_ID`
- `BLINK_API_KEY`
- `BLINK_WALLET_ID`
