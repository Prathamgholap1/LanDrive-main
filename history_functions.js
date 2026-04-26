// Download History Functions
function addToDownloadHistory(name) {
  let history = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
  history.unshift({
    name,
    size: '-',
    time: new Date().toLocaleString(),
    timestamp: Date.now()
  });
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem('downloadHistory', JSON.stringify(history));
}

function refreshDownloadHistory() {
  const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
  const content = document.getElementById('history-content');
  
  if (history.length === 0) {
    content.innerHTML = '<div class="history-empty"><div class="history-empty-icon">📥</div><div>No downloads yet</div></div>';
    return;
  }
  
  content.innerHTML = history.map((item, i) => {
    const getIcon = (name) => {
      const ext = name.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
      if (['mp4', 'avi', 'mkv', 'mov'].includes(ext)) return '🎬';
      if (['mp3', 'wav', 'flac'].includes(ext)) return '🎵';
      if (['zip', 'rar', '7z'].includes(ext)) return '📦';
      if (['pdf'].includes(ext)) return '📄';
      if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
      return '📁';
    };
    return `<div class="history-item">
      <div class="history-icon">${getIcon(item.name)}</div>
      <div class="history-info">
        <div class="history-filename">${item.name}</div>
        <div class="history-meta">
          <span>${item.size}</span>
          <span>${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function showDownloadHistory() {
  refreshDownloadHistory();
  document.getElementById('history-modal').classList.add('open');
}

function closeDownloadHistory() {
  document.getElementById('history-modal').classList.remove('open');
}

function clearDownloadHistory() {
  if (confirm('Clear all download history?')) {
    localStorage.setItem('downloadHistory', '[]');
    refreshDownloadHistory();
  }
}
