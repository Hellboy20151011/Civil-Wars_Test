// Zod-Schema-Validierung als Middleware
export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                message: result.error.errors[0].message,
                errors: result.error.errors,
            });
        }
        req.body = result.data;
        next();
    };
}
