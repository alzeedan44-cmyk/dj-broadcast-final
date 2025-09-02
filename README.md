DJ Broadcast - Final (Upgraded)
=================================

WHAT YOU GET
- Live DJ broadcast (mic or system/tab audio) via WebRTC
- Listeners join from anywhere when deployed on the internet
- Room names + optional PIN protection (configure ROOM_PINS in server.js)
- Chat with usernames
- Server-side recording: DJ can record the live stream (saved to /recordings/*.webm)
- TURN/STUN configured; instructions to add your own TURN server for stability
- Volume control per listener, mute/unmute, auto-reconnect handled by socket.io

IMPORTANT NOTE ABOUT MOBILE & YOUTUBE/SPOTIFY
- Mobile browsers do NOT allow capturing other apps' audio (YouTube/Spotify). To stream exact YouTube audio:
  - Run DJ on **desktop Chrome**, click **Share System/Tab Audio**, and play YouTube in that tab.
  - Listeners on phones will hear the shared tab audio in high quality.
- If DJ uses a phone and wants to stream YouTube from same phone, capture will be mic-only (room audio) and quality may be lower.

LOCAL TEST (on same Wi-Fi)
1. Download & unzip project.
2. Install Node.js LTS: https://nodejs.org/en/download/
3. Open terminal in project folder:
   npm install
   node server.js
4. Open browser on DJ laptop: http://localhost:3000
5. On phones (same Wi-Fi), open: http://<laptop-ip>:3000  (find IP with ipconfig / ip addr)
6. Enter a room name and optional PIN (set PINs in server.js if you want protection)
7. DJ: Start as DJ -> choose Microphone or System/Tab Audio (desktop)
8. Listeners: Join as Listener -> audio should play

DEPLOY TO RENDER (FREE) - step-by-step
1. Create GitHub repo and push the project:
   - Install Git: https://git-scm.com/downloads
   - Create repo on GitHub: https://github.com/new
   - In terminal:
     git init
     git add .
     git commit -m "dj broadcast"
     git branch -M main
     git remote add origin https://github.com/<yourname>/<repo>.git
     git push -u origin main
   (If you prefer GUI, use GitHub Desktop: https://desktop.github.com/)

2. Create free Render account: https://render.com/
3. In Render dashboard -> New -> Web Service -> Connect to GitHub -> select your repo
4. Set settings:
   - Environment: Node
   - Build Command: npm install
   - Start Command: node server.js
5. Click Create and wait. When done you'll get a public URL like https://your-app.onrender.com
6. Open that URL on any phone or browser, enter same room+PIN, and listen.

TURN SERVER (recommended for reliability)
- Current config uses a public TURN fallback (openrelay.metered.ca) but production needs a private TURN.
- To get a TURN server, use coturn on a VPS (DigitalOcean/AWS). Guides:
  - coturn repo: https://github.com/coturn/coturn
  - DigitalOcean tutorial: https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-coturn-on-ubuntu-20-04

SECURITY & RECORDINGS
- Recordings are saved to /recordings on server. Lock down access if hosting publicly.
- To download recordings, SSH into your server or add an admin download route (I can add that for you).

HELP - I CAN DO THIS FOR YOU
- I can push this repo to GitHub for you (give me the repo URL or run git commands I give).
- I can walk you through Render deploy step-by-step and confirm the public URL.
- I can add admin panel to download recordings or add authentication.

Useful links:
- Node.js: https://nodejs.org/
- Render deploy docs: https://render.com/docs/deploy-node
- GitHub guide: https://docs.github.com/en/get-started/quickstart
- coturn TURN server: https://github.com/coturn/coturn

