FROM node:20-alpine

WORKDIR /app

# Cài dependencies trước (tận dụng Docker cache)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

EXPOSE 5001

CMD ["npm", "run", "dev"]
