import { initShell, getAuth } from '/scripts/shell.js';

const auth = getAuth();
if (!auth) throw new Error('Nicht eingeloggt');

await initShell();

const container = document.getElementById('Dashboard');

const heading = document.createElement('h2');
heading.textContent = `Willkommen, ${auth.user.username}!`;

const role = document.createElement('p');
role.textContent = `Rolle: ${auth.user.role}`;

container.append(heading, role);

