# Fly.io 部署镜像：以 Node 18 运行 server.mjs（静态 + /api 一体）
FROM node:18-alpine

WORKDIR /app

# 先装依赖，利用镜像层缓存
COPY package.json ./
RUN npm install

# 拷贝站点与后端
COPY . .

# 确保运行时可写本地数据目录（netlify/.data），并以非 root 用户运行
RUN mkdir -p /app/netlify/.data && chown -R node:node /app

USER node

EXPOSE 8080
CMD ["npm", "start"]
