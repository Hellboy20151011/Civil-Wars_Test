import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createDocsRouter() {
	const openApiPath = path.join(__dirname, '../../docs/openapi.yaml');
	const openApiRaw = fs.readFileSync(openApiPath, 'utf8');
	const openApiDocument = yaml.load(openApiRaw);

	const router = express.Router();
	router.use('/', swaggerUi.serve, swaggerUi.setup(openApiDocument));

	return router;
}
