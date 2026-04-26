# LANDrive Auto-Update Setup Guide

Auto-updates are now built into LANDrive! Users will automatically receive updates without reinstalling.

## How It Works

1. **Users get notified** when a new version is available
2. **Auto-downloads** the update in the background
3. **One-click install** - users click "Update Now" or "Restart Now"
4. **App restarts** with the new version

## Setting Up Your Update Server

### Option 1: GitHub Releases (Easiest)

1. Create a GitHub repository for LANDrive
2. Build the app: `npm run build`
3. Go to Releases and upload the installer file
4. Update `package.json` `publish` section:

```json
"publish": {
  "provider": "github",
  "owner": "your-github-username",
  "repo": "landrive"
}
```

### Option 2: HTTP Server (Local Network)

1. Create an updates folder at: `c:/landrive/updates/`
2. Build the app: `npm run build`
3. Copy the files from `dist/` to your updates folder:
   - `latest.yml`
   - `LANDrive-1.1.0.exe` or the latest executable

4. Set up a simple HTTP server to serve these files:

```javascript
// Example: Simple update server
const express = require('express');
const app = express();
app.use('/updates', express.static('c:/landrive/updates/'));
app.listen(8888, () => console.log('Update server on http://localhost:8888/updates'));
```

5. Allow it through Windows Firewall for network access

6. Update `package.json`:

```json
"publish": {
  "provider": "generic",
  "url": "http://your-server-ip:8888/updates"
}
```

### Option 3: S3 or Cloud Storage

Update `package.json`:

```json
"publish": {
  "provider": "s3",
  "bucket": "your-bucket-name",
  "region": "us-east-1"
}
```

## Building for Distribution

```bash
# Install dependencies
npm install

# Build the installer
npm run build

# The installer will be in dist/
```

## Testing Updates

1. Build version 1.0.0
2. Install it on a test machine
3. Update package.json to version 1.1.0
4. Build again with new features
5. Upload to your update server
6. Launch the 1.0.0 app - it will detect the update!

## For Users

When an update is available:
1. A banner appears at the top saying "New update available"
2. Click "Update Now" to download and install
3. The app restarts automatically with the new version

No manual reinstalling needed!

## Troubleshooting

- **Updates not showing?** Check if the publish URL is correct in package.json
- **Installation fails?** Make sure the update files are in the correct folder
- **Still seeing issues?** Check the console for error messages (F12)

