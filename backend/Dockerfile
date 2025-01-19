# Use the Node.js 22 Alpine image as the base
FROM node:22-alpine
# Install curl
RUN apk add --no-cache curl
# Set the working directory
WORKDIR /app
# Copy package.json and install dependencies
COPY package.json .
# Install the dependencies
RUN npm install
# Copy the application code
COPY *.js .
# Expose port 80
EXPOSE 80
# Start the application
CMD ["npm", "start"]