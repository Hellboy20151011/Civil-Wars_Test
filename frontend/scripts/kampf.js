import { initShell, getAuth, refreshShellStatus } from '/scripts/shell.js';
import { initMissionPlanning } from '/scripts/modules/mission-planning.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

const container = document.getElementById('kampf-planung');

await initShell();
try {
  await initMissionPlanning({
    kind: 'combat',
    auth,
    container,
    onAfterLaunch: async () => {
      await refreshShellStatus(auth.token);
    },
  });
} catch (err) {
  container.innerHTML = `<div class="spy-error">${err.message}</div>`;
}
