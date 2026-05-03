// Zentraler Error-Handler – fängt alle Fehler aus asyncWrapper auf
export function errorHandler(err, req, res, _next) {
    console.error(err);
    const status = err.status ?? 500;
    const message = err.message ?? 'Interner Serverfehler';
    const code = err.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
    res.status(status).json({
        message,
        error: { message, code, details: err.details ?? {} },
    });
}
