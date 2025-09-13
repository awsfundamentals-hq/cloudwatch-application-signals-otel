# Use the Node.js 22 Alpine image as the base
FROM node:22-alpine
# Install curl
RUN apk add --no-cache curl
# Set the working directory
WORKDIR /app
# Copy package.json and package-lock.json
COPY package*.json .
# Install all dependencies (including devDependencies for build)
RUN npm install
# Copy TypeScript source files and tsconfig
COPY *.ts tsconfig.json .
# Build the TypeScript application
RUN npm run build
# Remove devDependencies to reduce image size
RUN npm prune --production
# Expose port 80
EXPOSE 80
# Start the application
CMD ["npm", "start"]
