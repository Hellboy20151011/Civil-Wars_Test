export function createServiceError(message, status = 400, code = 'REQUEST_ERROR') {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}
