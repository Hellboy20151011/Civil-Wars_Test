import { API_BASE_URL } from '/scripts/config.js';
import { el, render } from '/scripts/ui/component.js';

const authRoot = document.getElementById('Auth');

function labeledInput(id, type, placeholder) {
  return el('input', {
    attrs: { id, type, placeholder },
  });
}

function actionButton(id, label, onClick) {
  return el('button', {
    className: 'btn_Auth',
    attrs: { id },
    text: label,
    on: { click: onClick },
  });
}

function renderHome() {
  render(authRoot, [
    'Register/Login:',
    labeledInput('Input_Username', 'text', 'Username'),
    labeledInput('Input_Password', 'password', 'Password'),
    actionButton('btn_Register', 'Register', renderRegister),
    actionButton('btn_Login', 'Login', renderLogin),
  ]);
}

let pendingRegistration = null;

function goToDashboard(user, token) {
  sessionStorage.setItem('currentUser', JSON.stringify(user));
  sessionStorage.setItem('authToken', token);
  window.location.href = '/dashboard.html';
}

//Registrierungsfunktion: Erst Abfrage nach Namen und Passwort,
//Überprüfen ob Namen vorhanden ist und Passwort mindestens 8 Zeichen hat.
//Nach klick auf Registrieren wechsel in neues Feld Abfrage nach E-Mail Adresse und Überprüfen ob diese gültig ist.
async function renderRegister() {
  const Name = document.getElementById('Input_Username').value.trim();
  const Passwort = document.getElementById('Input_Password').value;

  if (!Name) {
    alert("Bitte Username eingeben");
    return;
  }

  if (Passwort.length < 8) {
    alert("Passwort muss mindestens 8 Zeichen lang sein");
    return;
  }

  pendingRegistration = { username: Name, password: Passwort };

  render(authRoot, [
    'Registrierung Schritt 2:',
    labeledInput('Input_Email', 'email', 'Email'),
    actionButton('btn_Register_Email', 'Registrierung abschliessen', submitRegisterEmail),
    actionButton('btn_back_register', 'Zurueck', renderHome),
  ]);
}

async function submitRegisterEmail() {
  if (!pendingRegistration) {
    alert("Registrierung neu starten.");
    renderHome();
    return;
  }

  const existingEmailInput = document.getElementById("Input_Email");
  const email = existingEmailInput.value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    alert("Bitte eine gueltige E-Mail eingeben");
    return;
  }

  try {
    //Daten an Backend senden
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: pendingRegistration.username,
        password: pendingRegistration.password,
        email
      })
    });

    const data = await response.json();
    if (response.ok) {
      pendingRegistration = null;
      goToDashboard(data.user, data.token);
    } else {
      alert(data.message);
    }
  } catch (_error) {
    alert("Fehler bei der Registrierung. Bitte spaeter erneut versuchen.");
  }
}

async function renderLogin() {
  render(authRoot, [
    'Login:',
    labeledInput('Input_Username', 'text', 'Username'),
    labeledInput('Input_Password', 'password', 'Password'),
    actionButton('btn_Login', 'Login', submitLogin),
    actionButton('btn_back', 'Zurück', renderHome),
  ]);
}

async function submitLogin() {
  const Name = document.getElementById("Input_Username").value.trim();
  const Passwort = document.getElementById("Input_Password").value;

  if (!Name) {
    alert("Bitte Username eingeben");
    return;
  }

  if (!Passwort) {
    alert("Bitte Passwort eingeben");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: Name, password: Passwort })
    });

    const data = await response.json();

    if (response.ok) {
      goToDashboard(data.user, data.token);
      return;
    }

    alert(data.message || "Login fehlgeschlagen");
  } catch (_error) {
    alert("Fehler beim Login. Bitte spaeter erneut versuchen.");
  }
}


// Start
renderHome();