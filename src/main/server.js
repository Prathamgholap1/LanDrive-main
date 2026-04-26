const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const mime = require('mime-types');
const archiver = require('archiver');
const os = require('os');

let app, server, io;
let shareDir = path.join(os.homedir(), 'LANDrive');
let mainWin;
let linkedFilesPath = path.join(os.homedir(), 'LANDrive', '.linked-files.json');

function getShareDir() { return shareDir; }

function getLinkedFiles() {
  try {
    if (fs.existsSync(linkedFilesPath)) {
      return JSON.parse(fs.readFileSync(linkedFilesPath, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading linked files:', e);
  }
  return {};
}

function saveLinkedFiles(data) {
  try {
    fs.writeFileSync(linkedFilesPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving linked files:', e);
  }
}

async function changeShareDir(newDir) {
  shareDir = newDir;
  linkedFilesPath = path.join(shareDir, '.linked-files.json');
  if (!fs.existsSync(shareDir)) fs.mkdirSync(shareDir, { recursive: true });
  if (io) io.emit('share-dir-changed', shareDir);
}

function setupMulter() {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const rel = req.query.path || '';
        const dest = path.join(shareDir, rel);
        fse.ensureDirSync(dest);
        cb(null, dest);
      },
      filename: (req, file, cb) => {
        cb(null, Buffer.from(file.originalname, 'latin1').toString('utf8'));
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10GB
  });
}

function getFileTree(dirPath, relPath = '') {
  const items = [];
  let entries;
  try { entries = fs.readdirSync(dirPath); } catch { return []; }

  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, name);
    const rel = relPath ? `${relPath}/${name}` : name;
    let stat;
    try { stat = fs.statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      items.push({
        name, path: rel, type: 'folder',
        modified: stat.mtime.toISOString(),
        size: 0
      });
    } else {
      items.push({
        name, path: rel, type: 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
        mime: mime.lookup(name) || 'application/octet-stream',
        ext: path.extname(name).toLowerCase()
      });
    }
  }

  // Add linked files from database
  const linked = getLinkedFiles();
  const dirPrefix = relPath ? `${relPath}/` : '';
  for (const [linkPath, sourcePath] of Object.entries(linked)) {
    if (linkPath.startsWith(dirPrefix)) {
      const itemPath = linkPath.substring(dirPrefix.length);
      if (!itemPath.includes('/')) {
        // Only add files in this directory, not subdirs
        try {
          const stat = fs.statSync(sourcePath);
          items.push({
            name: path.basename(linkPath),
            path: linkPath,
            type: 'file',
            size: stat.size,
            modified: stat.mtime.toISOString(),
            mime: mime.lookup(sourcePath) || 'application/octet-stream',
            ext: path.extname(sourcePath).toLowerCase(),
            linked: true,
            sourcePath
          });
        } catch (e) {
          // Source file no longer exists, skip it
        }
      }
    }
  }

  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function startServer(port, sharedDir, win) {
  shareDir = sharedDir;
  mainWin = win;
  if (!fs.existsSync(shareDir)) fs.mkdirSync(shareDir, { recursive: true });

  app = express();
  server = http.createServer(app);
  io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e9 });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve web UI for browser clients
  app.get('/', (req, res) => {
    res.send(getBrowserUI());
  });

  // List files
  app.get('/api/files', (req, res) => {
    const rel = req.query.path || '';
    const dir = path.join(shareDir, rel);
    if (!dir.startsWith(shareDir)) return res.status(403).json({ error: 'Forbidden' });
    const items = getFileTree(dir, rel);
    res.json({ items, cwd: rel, shareDir });
  });

  // Download file
  app.get('/api/download', (req, res) => {
    const rel = req.query.path || '';
    const linked = getLinkedFiles();
    
    let fullPath, isLinked = false;
    if (linked[rel]) {
      fullPath = linked[rel];
      isLinked = true;
    } else {
      fullPath = path.join(shareDir, rel);
    }
    
    if (!isLinked && !fullPath.startsWith(shareDir)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}.zip"`);
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.pipe(res);
      archive.directory(fullPath, path.basename(fullPath));
      archive.finalize();
    } else {
      res.download(fullPath, path.basename(fullPath));
    }
  });

  // Stream/preview file
  app.get('/api/preview', (req, res) => {
    const rel = req.query.path || '';
    const linked = getLinkedFiles();
    
    let fullPath, isLinked = false;
    if (linked[rel]) {
      fullPath = linked[rel];
      isLinked = true;
    } else {
      fullPath = path.join(shareDir, rel);
    }
    
    if (!isLinked && !fullPath.startsWith(shareDir)) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });
    
    const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(fullPath).pipe(res);
  });

  // Upload files
  app.post('/api/upload', (req, res) => {
    const upload = setupMulter();
    upload.array('files')(req, res, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      const rel = req.query.path || '';
      io.emit('files-changed', { path: rel });
      if (mainWin) mainWin.webContents.send('files-changed', rel);
      res.json({ uploaded: req.files.length });
    });
  });

  // Link files (store paths without copying)
  app.post('/api/link-files', (req, res) => {
    try {
      const { files, path: destPath } = req.body;
      
      if (!files) {
        return res.status(400).json({ error: 'files parameter is required' });
      }
      if (!Array.isArray(files)) {
        return res.status(400).json({ error: 'files must be an array' });
      }

      const linked = getLinkedFiles();
      const validFiles = [];

      for (const filePath of files) {
        try {
          // Verify file exists
          if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            continue;
          }

          const fileName = path.basename(filePath);
          const linkKey = destPath ? `${destPath}/${fileName}` : fileName;

          // Store the mapping
          linked[linkKey] = filePath;
          validFiles.push(fileName);
        } catch (e) {
          console.error(`Error linking ${filePath}:`, e);
        }
      }

      saveLinkedFiles(linked);
      const parentPath = destPath || '';
      io.emit('files-changed', { path: parentPath });
      if (mainWin) mainWin.webContents.send('files-changed', parentPath);
      res.json({ linked: validFiles.length, files: validFiles });
    } catch (err) {
      console.error('Link-files endpoint error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create folder
  app.post('/api/mkdir', (req, res) => {
    const rel = req.body.path || '';
    const fullPath = path.join(shareDir, rel);
    if (!fullPath.startsWith(shareDir)) return res.status(403).json({ error: 'Forbidden' });
    try {
      fse.ensureDirSync(fullPath);
      const parent = path.dirname(rel);
      io.emit('files-changed', { path: parent });
      if (mainWin) mainWin.webContents.send('files-changed', parent);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete
  app.delete('/api/delete', (req, res) => {
    const rel = req.query.path || '';
    const linked = getLinkedFiles();
    
    // Check if it's a linked file
    if (linked[rel]) {
      delete linked[rel];
      saveLinkedFiles(linked);
      const parent = path.dirname(rel);
      io.emit('files-changed', { path: parent });
      if (mainWin) mainWin.webContents.send('files-changed', parent);
      return res.json({ success: true });
    }
    
    // Otherwise, delete from share directory
    const fullPath = path.join(shareDir, rel);
    if (!fullPath.startsWith(shareDir)) return res.status(403).json({ error: 'Forbidden' });
    try {
      fse.removeSync(fullPath);
      const parent = path.dirname(rel);
      io.emit('files-changed', { path: parent });
      if (mainWin) mainWin.webContents.send('files-changed', parent);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Rename
  app.post('/api/rename', (req, res) => {
    const { oldPath, newName } = req.body;
    const linked = getLinkedFiles();
    
    // Check if it's a linked file
    if (linked[oldPath]) {
      const sourcePath = linked[oldPath];
      const newPath = path.dirname(oldPath).split('/').filter(p => p).join('/');
      const newKey = newPath ? `${newPath}/${newName}` : newName;
      delete linked[oldPath];
      linked[newKey] = sourcePath;
      saveLinkedFiles(linked);
      const parent = path.dirname(oldPath);
      io.emit('files-changed', { path: parent });
      if (mainWin) mainWin.webContents.send('files-changed', parent);
      return res.json({ success: true });
    }
    
    // Otherwise, rename in share directory
    const fullOld = path.join(shareDir, oldPath);
    const fullNew = path.join(path.dirname(fullOld), newName);
    if (!fullOld.startsWith(shareDir)) return res.status(403).json({ error: 'Forbidden' });
    try {
      fse.moveSync(fullOld, fullNew);
      const parent = path.dirname(oldPath);
      io.emit('files-changed', { path: parent });
      if (mainWin) mainWin.webContents.send('files-changed', parent);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Info
  app.get('/api/info', (req, res) => {
    res.json({ hostname: os.hostname(), shareDir, version: '1.0.0' });
  });

  io.on('connection', (socket) => {
    socket.emit('connected', { hostname: os.hostname() });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', (err) => {
      if (err) reject(err);
      else resolve(port);
    });
  });
}

function stopServer() {
  if (server) server.close();
}

function getBrowserUI() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LANDrive</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f11;color:#e8e8f0;min-height:100vh}
.topbar{display:flex;align-items:center;gap:16px;padding:16px 24px;background:#1a1a1f;border-bottom:1px solid #2a2a35}
.logo{font-size:20px;font-weight:700;color:#6c8fff;letter-spacing:-0.5px}
.breadcrumb{display:flex;align-items:center;gap:6px;flex:1;font-size:13px;color:#888}
.breadcrumb span{cursor:pointer;color:#6c8fff}breadcrumb span:hover{text-decoration:underline}
.actions{display:flex;gap:8px}
.btn{padding:7px 14px;border-radius:7px;border:none;cursor:pointer;font-size:13px;font-weight:500}
.btn-primary{background:#6c8fff;color:#fff}.btn-primary:hover{background:#5a7aff}
.btn-ghost{background:#2a2a35;color:#e8e8f0}.btn-ghost:hover{background:#3a3a45}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;padding:24px}
.item{background:#1a1a1f;border:1px solid #2a2a35;border-radius:10px;padding:16px;cursor:pointer;transition:.15s}
.item:hover{background:#22222a;border-color:#6c8fff44}
.item-icon{font-size:36px;margin-bottom:10px;text-align:center}
.item-name{font-size:13px;font-weight:500;word-break:break-word;text-align:center}
.item-size{font-size:11px;color:#666;text-align:center;margin-top:4px}
.empty{text-align:center;padding:80px 24px;color:#555}
.upload-zone{border:2px dashed #2a2a35;border-radius:12px;padding:40px;text-align:center;margin:24px;cursor:pointer;transition:.2s}
.upload-zone:hover,.upload-zone.drag{border-color:#6c8fff;background:#6c8fff11}
a{color:#6c8fff;text-decoration:none}
</style>
</head>
<body>
<div class="topbar">
  <div class="logo">LANDrive</div>
  <div class="breadcrumb" id="breadcrumb"><span onclick="navigate('')">Home</span></div>
  <div class="actions">
    <button class="btn btn-ghost" onclick="document.getElementById('upload-input').click()">Upload</button>
    <button class="btn btn-ghost" onclick="document.getElementById('browse-input').click()">Browse & Link</button>
    <input type="text" id="file-path-input" placeholder="Or paste path..." style="padding:7px 14px;border-radius:7px;border:1px solid #2a2a35;background:#1a1a1f;color:#e8e8f0;font-size:13px;width:200px">
    <button class="btn btn-primary" onclick="linkFileFromPath()">Link</button>
  </div>
</div>
<input type="file" id="upload-input" multiple style="display:none" onchange="uploadFiles(this.files)">
<input type="file" id="browse-input" multiple style="display:none" onchange="handleBrowseFiles(this.files)">
<div class="upload-zone" id="drop-zone" onclick="document.getElementById('upload-input').click()">
  Drop files here to upload, or use buttons above
</div>
<div class="grid" id="file-grid"></div>
<script>
let cwd='';
const icons={folder:'📁',pdf:'📄',jpg:'🖼',jpeg:'🖼',png:'🖼',gif:'🖼',mp4:'🎬',mov:'🎬',mp3:'🎵',wav:'🎵',zip:'🗜',rar:'🗜','7z':'🗜',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📊',pptx:'📊',txt:'📋',js:'💻',py:'💻',html:'🌐',default:'📄'};
function icon(item){if(item.type==='folder')return'📁';const e=item.ext?.replace('.','');return icons[e]||icons.default}
function fmt(b){if(!b)return'';if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(1)+'KB';if(b<1073741824)return(b/1048576).toFixed(1)+'MB';return(b/1073741824).toFixed(1)+'GB'}
async function load(p){cwd=p||'';const r=await fetch('/api/files?path='+encodeURIComponent(cwd));const d=await r.json();render(d.items)}
function render(items){
  const g=document.getElementById('file-grid');
  if(!items.length){g.innerHTML='<div class="empty">This folder is empty</div>';return}
  g.innerHTML=items.map(i=>{
    const path=i.path.replace(/'/g,"\\'");
    const name=i.name.replace(/'/g,"\\'");
    const onclick=i.type==='folder'?"navigate('"+path+"')":"download('"+path+"','"+name+"')";
    return '<div class="item" onclick="'+onclick+'"><div class="item-icon">'+icon(i)+'</div><div class="item-name">'+i.name+'</div><div class="item-size">'+(i.type==='folder'?'Folder':fmt(i.size))+'</div></div>';
  }).join('');
}
function navigate(p){load(p);const bc=document.getElementById('breadcrumb');const parts=p?p.split('/'):[]; bc.innerHTML='<span onclick="navigate(\\'\\')">Home</span>'+parts.map((pt,i)=>' / <span onclick="navigate(\\''+parts.slice(0,i+1).join('/')+'\\')">'+pt+'</span>').join('')}
function download(p,name){window.location='/api/download?path='+encodeURIComponent(p)}
async function uploadFiles(files){
  const fd=new FormData();
  for(const f of files)fd.append('files',f);
  await fetch('/api/upload?path='+encodeURIComponent(cwd),{method:'POST',body:fd});
  load(cwd);
}
async function handleBrowseFiles(files){
  const paths=[];
  for(const f of files){
    paths.push(f.path||f.webkitPath||f.name);
  }
  if(paths.length>0){
    try{
      const r=await fetch('/api/link-files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:paths,path:cwd})});
      const d=await r.json();
      if(d.linked>0){load(cwd)}else{alert('Failed to link files')}
    }catch(e){alert('Error: '+e.message)}
  }
}
async function linkFileFromPath(){
  const pathInput=document.getElementById('file-path-input');
  const filePath=pathInput.value.trim();
  if(!filePath){alert('Please enter a file path');return}
  try{
    const r=await fetch('/api/link-files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:[filePath],path:cwd})});
    const d=await r.json();
    if(d.linked>0){pathInput.value='';load(cwd)}else{alert('Failed to link file. Check if path exists.')}
  }catch(e){alert('Error: '+e.message)}
}
const dz=document.getElementById('drop-zone');
dz.ondragover=e=>{e.preventDefault();dz.classList.add('drag')};
dz.ondragleave=()=>dz.classList.remove('drag');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('drag');uploadFiles(e.dataTransfer.files)};
document.getElementById('file-path-input').addEventListener('keypress',e=>{if(e.key==='Enter')linkFileFromPath()});
load('');
</script>
</body></html>`;
}

module.exports = { startServer, stopServer, getShareDir, changeShareDir };
