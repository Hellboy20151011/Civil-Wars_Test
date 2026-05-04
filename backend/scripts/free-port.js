import { execSync } from 'node:child_process';

const rawPorts = process.argv.slice(2);
const portInputs = rawPorts.length > 0 ? rawPorts : ['3000'];
const ports = portInputs.map((value) => Number(value));

const invalidPort = ports.find((value) => !Number.isInteger(value) || value <= 0);
if (invalidPort) {
    console.error(`[free-port] Ungueltiger Port in Eingabe: ${portInputs.join(', ')}`);
    process.exit(1);
}

function run(command) {
    return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function freePortOnWindows(targetPort) {
    const command = `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) -join ','"`;
    const output = run(command);
    if (!output) {
        console.log(`[free-port] Port ${targetPort} ist bereits frei.`);
        return;
    }

    const pids = output
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);

    if (pids.length === 0) {
        console.log(`[free-port] Keine beendbaren Prozesse auf Port ${targetPort} gefunden.`);
        return;
    }

    for (const pid of pids) {
        try {
            execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`, { stdio: 'ignore' });
            console.log(`[free-port] Prozess ${pid} auf Port ${targetPort} gestoppt.`);
        } catch {
            console.warn(`[free-port] Prozess ${pid} konnte nicht gestoppt werden.`);
        }
    }
}

function freePortOnUnix(targetPort) {
    let output;
    try {
        output = run(`lsof -ti tcp:${targetPort}`);
    } catch {
        // lsof nicht verfuegbar – Port gilt als frei
    }

    if (!output) {
        console.log(`[free-port] Port ${targetPort} ist bereits frei oder lsof nicht verfuegbar.`);
        return;
    }

    const pids = output
        .split('\n')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);

    for (const pid of pids) {
        try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            console.log(`[free-port] Prozess ${pid} auf Port ${targetPort} gestoppt.`);
        } catch {
            console.warn(`[free-port] Prozess ${pid} konnte nicht gestoppt werden.`);
        }
    }
}

try {
    for (const port of ports) {
        if (process.platform === 'win32') {
            freePortOnWindows(port);
        } else {
            freePortOnUnix(port);
        }
    }
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[free-port] Fehler beim Freigeben von Ports ${portInputs.join(', ')}: ${message}`);
    process.exit(1);
}
