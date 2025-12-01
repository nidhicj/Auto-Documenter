FROM node:18-alpine

WORKDIR /app

# Install dependencies first (will be used if volume mount doesn't include node_modules)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 3001

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "start:prod"]




