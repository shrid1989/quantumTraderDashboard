# Frontend Dockerfile - Multi-stage build

# Development stage
FROM node:18-alpine AS development

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application
COPY . .

# Expose port
EXPOSE 3000

# Development command (with hot reload)
CMD ["npm", "start"]

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy application
COPY . .

# Build the app
RUN npm run build

# Use Node to serve (or nginx for production)
EXPOSE 3000

CMD ["npm", "start"]
