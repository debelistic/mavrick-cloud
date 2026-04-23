FROM node:20-slim

# Install dependencies for Railpack and Docker
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Railpack
RUN curl -sSL https://railpack.com/install.sh | sh

# Install Docker CLI
RUN curl -fsSL https://get.docker.com | sh

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

RUN chmod +x ./start.sh
CMD ["./start.sh"]
