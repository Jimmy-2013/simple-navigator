# 使用 Node.js 官方的 LTS 版本作为基础镜像
FROM node:lts-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json (如果存在)
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制应用程序代码
COPY . .

# 暴露端口
EXPOSE 3003

# 启动应用
CMD ["npm", "start"]

