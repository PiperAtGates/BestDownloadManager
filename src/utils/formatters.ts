export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return 'Unknown';
  if (seconds === 0) return '0s';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const hDisplay = h > 0 ? `${h}h ` : '';
  const mDisplay = m > 0 ? `${m}m ` : '';
  const sDisplay = s > 0 ? `${s}s` : '';
  
  return hDisplay + mDisplay + sDisplay;
}
