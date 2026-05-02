// Wickelt async Route-Handler ein – zentrales Error-Handling statt try/catch überall
export const asyncWrapper = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
