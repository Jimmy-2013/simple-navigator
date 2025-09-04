# 步骤 1: 选择一个基础镜像
# 我们使用 Node.js 的 LTS Alpine 版本，因为它包含了 Node.js 和 npm，并且体积小
FROM node:lts-alpine

# 步骤 2: 安装 Nginx
# Alpine Linux 使用 apk 包管理器
RUN apk add --no-cache nginx

# 步骤 3: 设置工作目录
WORKDIR /app

# 步骤 4: 复制 Node.js 后端文件并安装依赖
# 先复制 package.json 以利用 Docker 缓存
COPY ./backend/package*.json ./backend/
RUN cd backend && npm install --production # 只安装生产依赖

# 复制所有 Node.js 后端代码
COPY ./backend ./backend/

# 步骤 5: 复制前端静态文件到 Nginx 的默认网站根目录
COPY ./app /usr/share/nginx/html

# 步骤 6: 复制我们自定义的 Nginx 配置文件
# 将完整的 Nginx 配置复制到主配置文件位置
COPY ./nginx.conf /etc/nginx/nginx.conf

# 步骤 7: 复制并设置启动脚本
COPY ./entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 步骤 8: 声明容器将监听的端口 (Nginx 监听 80)
EXPOSE 80

# 步骤 9: 定义容器启动时执行的命令
# 使用 entrypoint.sh 来启动两个服务
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
