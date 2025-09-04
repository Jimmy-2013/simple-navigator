#!/bin/sh

# 切换到后端目录并安装依赖 (如果 Dockerfile 中没有安装，或者需要重新安装)
# 更好的做法是在 Dockerfile 中安装，这里只是一个额外的保障
# cd /app/backend && npm install --production

# 启动 Node.js 后端服务 (在后台运行)
echo "Starting Node.js backend..."
node /app/backend/server.js &

# 启动 Nginx 服务 (在前台运行，作为容器的主进程)
echo "Starting Nginx..."
exec nginx -g "daemon off;"
