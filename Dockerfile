# Use a lightweight Node.js base image
FROM node:16-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code to the container
COPY *.js ./

# Create the uploads directory
RUN mkdir -p /app/uploads

# Set environment variables (defaults can be overridden)
ENV PORT=3000
ENV MONGO_URI=mongodb://localhost:27017/imageUploadDB

# Expose the specified port
EXPOSE $PORT

# Start the application
CMD ["sh", "-c", "node index.js --port=$PORT"]
