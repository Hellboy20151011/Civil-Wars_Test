FROM node:20-alpine

WORKDIR /app

# Abhängigkeiten zuerst kopieren (Cache-Layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Quellcode kopieren
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
