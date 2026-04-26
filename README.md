# LANDrive 🌐

**LANDrive** is a fast, secure, and intuitive peer-to-peer file sharing application for local networks (LAN). Think of it as a lightweight Google Drive alternative that works entirely offline on your WiFi network—no internet, no cloud storage fees, no data leaving your network.

Built with **Electron** and **Node.js**, LANDrive lets you instantly share files between computers, phones, and tablets on the same network with just a click.

---

## 🎯 Use Cases

- **Home Networks** — Share files between your laptop, desktop, and phone without USB drives
- **Office Networks** — Quick team file sharing without relying on external cloud services
- **Media Server** — Share photos, videos, and documents across devices
- **Developer Teams** — Share project files and build artifacts across local machines
- **Offline Collaboration** — Work together without internet connectivity
- **Privacy-First** — All data stays on your local network—no third-party servers

---

## ✨ Features
- 📁 Browse, upload, download, rename, delete files & folders
- 🔄 Real-time updates across all connected clients via **Socket.io**
- 🌐 **Browser access** — anyone on your WiFi can visit your IP to access files instantly
- 🎯 **Drag & drop upload** with progress tracking
- 📊 **Multiple view modes** — Grid & list view for flexible browsing
- ⚙️ **Customizable shared folder** — change the shared directory anytime from settings
- 🖥️ **Native Windows app** — `.exe` installer with Start Menu integration
- 📱 **Cross-device compatible** — works on Windows, Mac, Linux (desktop view), and any modern browser
- 🚀 **Zero latency** — instant file operations over local network
- 🔒 **Local network only** — no external internet required, complete data privacy

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Renderer Process)
- **Backend**: Express.js, Socket.io, Node.js
- **Desktop**: Electron (Windows, Mac, Linux support)
- **File Operations**: fs-extra, Multer
- **Network**: MDNS for local discovery
- **Build**: Electron Builder (creates .exe, .dmg, .AppImage)

---

## Requirements

- **Node.js** v18 or newer → https://nodejs.org
- **Windows** (for .exe build) — also works on Mac/Linux

---

## Setup

```bash
# 1. Enter the project folder
cd landrive

# 2. Install dependencies (takes 1-2 minutes)
npm install

# 3. Run in dev mode (no build needed)
npm start
```

---

## Build the .exe installer

```bash
npm run build
```

The installer will be created in the `dist/` folder:
- `dist/LANDrive Setup 1.0.0.exe` — Windows NSIS installer

Double-click the `.exe` to install. It creates a Start Menu shortcut and optionally a desktop shortcut.

---

## How to use

1. **Launch LANDrive** — the app starts and automatically:
   - Creates a `LANDrive` folder in your home directory
   - Starts a local HTTP server on port **7070**

2. **Share files** — copy the URL shown at the top (e.g. `http://192.168.1.5:7070`)

3. **Access from phone/laptop** — open that URL in any browser on the same WiFi

4. **Change shared folder** — click Settings (⚙️) in the sidebar → Change Folder

---

## Project Structure

```
landrive/
├── src/
│   └── main/
│       ├── main.js        ← Electron main process
│       ├── server.js      ← Express + Socket.io file server
│       └── preload.js     ← IPC bridge (main ↔ renderer)
├── public/
│   └── index.html         ← Full UI (renderer process)
├── package.json
└── README.md
```

---

## Troubleshooting

**Port 7070 already in use?**
Edit `serverPort` in `src/main/main.js` to any free port.

**Firewall blocking access?**
Allow Node.js or port 7070 through Windows Firewall when prompted.

**Build fails?**
Make sure you have enough disk space and run `npm install` again.

---

## 🤝 Contributing

Contributions are welcome! If you'd like to help improve LANDrive:

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** and test thoroughly
4. **Commit** with clear messages (`git commit -m 'Add amazing feature'`)
5. **Push** to your branch (`git push origin feature/amazing-feature`)
6. **Open a Pull Request**

### Areas for Contribution
- Bug fixes and performance improvements
- UI/UX enhancements
- Additional file operations (batch operations, search, etc.)
- Authentication/encryption features
- Mobile app versions
- Documentation improvements

---

## 📝 License

This project is open source and available under the MIT License.

---

## 🙋 Support & Feedback

Have questions or suggestions? Feel free to:
- Open an **Issue** on GitHub for bugs or feature requests
- Check **Existing Issues** to see if your question has been answered
- Start a **Discussion** for general questions

---

## 🌟 Show Your Support

If you find LANDrive useful, please consider:
- ⭐ **Starring** this repository
- 🔗 **Sharing** it with others
- 💬 **Providing feedback** to help us improve

Thank you for using LANDrive!
