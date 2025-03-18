# Base image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install Python and other dependencies needed for node-gyp
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
