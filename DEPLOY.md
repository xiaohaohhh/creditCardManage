# 信用卡管家 - N1盒子部署指南

## 系统要求
- N1盒子刷入 iStoreOS 系统
- Docker 已安装
- 公网 IPv6 地址

## 项目目录
```
/mnt/sda1/project/creditCard/
├── server/          # Go后端代码
├── dist/            # 前端构建产物
├── docker-compose.yml
└── nginx.conf
```

## 快速部署

### 1. 在N1上创建目录
```bash
mkdir -p /mnt/sda1/project/creditCard
cd /mnt/sda1/project/creditCard
```

### 2. 上传文件
将以下文件从开发机上传到N1：
- `server/` 目录（Go后端代码）
- `dist/` 目录（前端构建产物）
- `docker-compose.yml`
- `nginx.conf`

### 3. 构建并启动服务
```bash
cd /mnt/sda1/project/creditCard

# 仅启动API服务（推荐先测试）
docker-compose up -d card-api

# 或完整启动（含Nginx）
docker-compose up -d
```

### 4. 验证服务
```bash
# 检查容器状态
docker-compose ps

# 测试API健康检查
curl http://localhost:8080/api/v1/health
```

## 手机端使用

### 访问地址
在手机浏览器中输入：
```
http://192.168.5.20
```

### 添加到主屏幕
1. 用手机浏览器打开上述地址
2. Safari: 点击分享按钮 → 添加到主屏幕
3. Chrome: 点击菜单 → 添加到主屏幕

添加后即可像原生App一样使用！

### 配置同步
1. 打开App → 设置（右上角齿轮图标）
2. 输入服务器地址：`http://192.168.5.20:8080`
3. 点击"测试连接"确认连通
4. 点击"保存"
5. 点击"立即同步"

## 数据备份

### 备份数据库
```bash
docker cp card-manager-api:/app/data/cards.db /mnt/sda1/backup/
```

### 恢复数据
```bash
docker cp /mnt/sda1/backup/cards.db card-manager-api:/app/data/
docker-compose restart card-api
```

## 常见问题

### 无法访问服务？
1. 检查Docker容器是否运行：`docker-compose ps`
2. 检查端口是否开放：`netstat -tlnp | grep 8080`

### 同步失败？
1. 确认服务器地址格式正确
2. 在设置页面点击"测试连接"
3. 查看日志：`docker-compose logs card-api`

### 如何更新服务？
```bash
cd /mnt/sda1/project/creditCard
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```
