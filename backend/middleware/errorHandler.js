// Zentraler Error-Handler – fängt alle Fehler aus asyncWrapper auf
export function errorHandler(err, req, res, next) {
    console.error(err);
    const status = err.status ?? 500;
    res.status(status).json({ message: err.message ?? 'Interner Serverfehler' });
}
