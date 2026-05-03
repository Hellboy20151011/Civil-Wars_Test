import { API_BASE_URL } from '/scripts/config.js';

function renderHome() {
  document.getElementById("Auth").innerHTML = `
    Register/Login:
     <input id="Input_Username" type="text" placeholder="Username">
     <input id="Input_Password" type="password" placeholder="Password">
     <button class="btn_Auth" id="btn_Register">Register</button>
     <button class="btn_Auth" id="btn_Login">Login</button>
  `;

  document.getElementById("btn_Login").addEventListener("click", renderLogin);
  document.getElementById("btn_Register").addEventListener("click", renderRegister);
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
  const Name = document.getElementById("Input_Username").value.trim();
  const Passwort = document.getElementById("Input_Password").value;

  if (!Name) {
    alert("Bitte Username eingeben");
    return;
  }

  if (Passwort.length < 8) {
    alert("Passwort muss mindestens 8 Zeichen lang sein");
    return;
  }

  pendingRegistration = { username: Name, password: Passwort };

  document.getElementById("Auth").innerHTML = `
    Registrierung Schritt 2:
    <input id="Input_Email" type="email" placeholder="Email">
    <button class="btn_Auth" id="btn_Register_Email">Registrierung abschliessen</button>
    <button class="btn_Auth" id="btn_back_register">Zurueck</button>
  `;

  document.getElementById("btn_Register_Email").addEventListener("click", submitRegisterEmail);
  document.getElementById("btn_back_register").addEventListener("click", renderHome);
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
  } catch (error) {
    alert("Fehler bei der Registrierung. Bitte spaeter erneut versuchen.");
  }
}

async function renderLogin() {
  document.getElementById("Auth").innerHTML = `
    Login:
    <input id="Input_Username" type="text" placeholder="Username">
    <input id="Input_Password" type="password" placeholder="Password">
    <button class="btn_Auth" id="btn_Login">Login</button>
    <button class="btn_Auth" id="btn_back">Zurück</button>
  `;

  document.getElementById("btn_back").addEventListener("click", renderHome);
  document.getElementById("btn_Login").addEventListener("click", submitLogin);
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
  } catch (error) {
    alert("Fehler beim Login. Bitte spaeter erneut versuchen.");
  }
}


// Start
renderHome();