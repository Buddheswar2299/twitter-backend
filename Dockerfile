# Use an official Node.js image as the base image
FROM node:18-bullseye

# Install Chromium for Selenium
RUN apt-get update && apt-get install -y chromium

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire application to the container
COPY . .

# Expose the port the app runs on
EXPOSE 5001

# Set environment variables required for Chromium
ENV CHROME_BIN=/usr/bin/chromium \
    NODE_ENV=production

# Start the application
CMD ["npm", "start"]
