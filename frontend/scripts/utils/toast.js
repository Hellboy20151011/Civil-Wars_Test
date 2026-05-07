/**
 * Zeigt eine kurze Toast-Benachrichtigung an.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'danger'} type
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Einblenden
  globalThis.requestAnimationFrame(() => toast.classList.add('toast--visible'));

  // Nach 5 s ausblenden + entfernen
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 5000);
}
