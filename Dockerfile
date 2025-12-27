# Use the official Microsoft Playwright image
# This comes with Node.js and all browser dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies 
# (We skip the playwright install here because they are in the base image)
RUN npm ci

# Copy the rest of your code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# The command to run your worker
CMD ["npm", "run", "worker"]