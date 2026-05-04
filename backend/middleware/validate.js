// Zod-Schema-Validierung als Middleware
export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                message: result.error.issues[0].message,
                errors: result.error.issues,
            });
        }
        req.body = result.data;
        next();
    };
}

export function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            return res.status(400).json({
                message: result.error.issues[0].message,
                errors: result.error.issues,
            });
        }
        req.query = result.data;
        next();
    };
}
