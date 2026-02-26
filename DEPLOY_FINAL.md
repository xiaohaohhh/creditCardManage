# 信用卡管家 - 完整部署指南

## 项目完成情况

✅ **前端PWA** - 完整功能已实现
✅ **后端API** - Go服务已编写
✅ **数据同步** - 双向同步逻辑已完成
✅ **加密模块** - AES-256-GCM加密已实现
✅ **文件上传** - 所有文件已上传到N1

## N1端手动完成步骤

### 当前状态
- 文件位置: `/mnt/sda1/project/creditCard/`
- Go已安装: ✅
- 依赖已下载: ✅
- 缺少: GCC编译器（用于SQLite）

### 方案1: 安装GCC并编译（推荐）

```bash
# SSH登录N1
ssh root@192.168.5.20
# 密码: zt7194985316

# 1. 安装GCC
opkg update
opkg install gcc

# 2. 编译服务
cd /mnt/sda1/project/creditCard/server
GOPROXY=https://goproxy.cn,direct CGO_ENABLED=1 go build -o card-server .

# 3. 启动服务
mkdir -p /mnt/sda1/project/creditCard/data
cd /mnt/sda1/project/creditCard/server
DATA_DIR=/mnt/sda1/project/creditCard/data PORT=8080 nohup ./card-server > /var/log/card-server.log 2>&1 &

# 4. 测试
curl http://localhost:8080/api/v1/health
```

### 方案2: 使用纯Go SQLite驱动（无需GCC）

```bash
ssh root@192.168.5.20

cd /mnt/sda1/project/creditCard/server

# 1. 修改go.mod
cat > go.mod << 'EOF'
module card-server

go 1.21

require (
	github.com/gin-contrib/cors v1.5.0
	github.com/gin-gonic/gin v1.9.1
	github.com/google/uuid v1.5.0
	modernc.org/sqlite v1.28.0
)
EOF

# 2. 修改main.go中的import
sed -i 's|github.com/mattn/go-sqlite3|modernc.org/sqlite|g' main.go

# 3. 下载依赖并编译
GOPROXY=https://goproxy.cn,direct go mod tidy
GOPROXY=https://goproxy.cn,direct CGO_ENABLED=0 go build -o card-server .

# 4. 启动服务
mkdir -p /mnt/sda1/project/creditCard/data
DATA_DIR=/mnt/sda1/project/creditCard/data PORT=8080 nohup ./card-server > /var/log/card-server.log 2>&1 &

# 5. 测试
curl http://localhost:8080/api/v1/health
```

### 配置开机自启（可选）

```bash
# 创建启动脚本
cat > /mnt/sda1/project/creditCard/start.sh << 'EOF'
#!/bin/sh
cd /mnt/sda1/project/creditCard/server
export DATA_DIR=/mnt/sda1/project/creditCard/data
export PORT=8080
./card-server >> /var/log/card-server.log 2>&1 &
echo $! > /var/run/card-server.pid
EOF

chmod +x /mnt/sda1/project/creditCard/start.sh

# 创建init.d脚本
cat > /etc/init.d/card-server << 'EOF'
#!/bin/sh /etc/rc.common
START=99
STOP=10

start() {
    /mnt/sda1/project/creditCard/start.sh
}

stop() {
    kill $(cat /var/run/card-server.pid 2>/dev/null) 2>/dev/null
}
EOF

chmod +x /etc/init.d/card-server
/etc/init.d/card-server enable
```

## 手机端使用

### 方式1: 开发模式（推荐先测试）

```bash
# 在电脑上运行
cd D:\project\credit_card_management
npm run dev -- --host

# 查看电脑IP
ipconfig

# 手机浏览器访问
http://电脑IP:5173
```

### 方式2: 生产模式（N1部署静态文件）

如果N1上有uhttpd或nginx，可以：

```bash
# 创建软链接
ln -sf /mnt/sda1/project/creditCard/dist /www/card-manager

# 手机访问
http://192.168.5.20/card-manager
```

### 配置同步

1. 打开App
2. 点击右上角设置图标
3. 输入服务器地址: `http://192.168.5.20:8080`
4. 点击"测试连接"
5. 点击"保存"
6. 点击"立即同步"

## 功能清单

### 前端功能
- ✅ 完整卡号输入（自动格式化）
- ✅ CVV输入（带显示/隐藏按钮）
- ✅ 有效期输入（MM/YY格式）
- ✅ 持卡人姓名
- ✅ 卡片正反面照片拍摄/上传
- ✅ 图片自动压缩（最大500KB）
- ✅ 备注字段
- ✅ 账单日/还款日管理
- ✅ 还款提醒（紧急/临近/安全）
- ✅ 离线可用（IndexedDB）
- ✅ PWA支持（可安装到桌面）

### 后端功能
- ✅ RESTful API
- ✅ SQLite数据库
- ✅ 数据同步接口
- ✅ 健康检查接口
- ✅ CORS支持

### 安全功能
- ✅ AES-256-GCM加密
- ✅ PBKDF2密钥派生
- ✅ 本地数据加密存储
- ✅ 端到端加密传输

## 故障排查

### API无法访问
```bash
# 检查进程
ps | grep card-server

# 查看日志
tail -f /var/log/card-server.log

# 检查端口
netstat -tlnp | grep 8080

# 重启服务
killall card-server
/mnt/sda1/project/creditCard/start.sh
```

### 同步失败
1. 确认API可访问: `curl http://192.168.5.20:8080/api/v1/health`
2. 检查服务器地址格式是否正确
3. 查看浏览器控制台错误

## 技术栈

**前端:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Dexie.js (IndexedDB)
- Web Crypto API
- PWA (vite-plugin-pwa)

**后端:**
- Go 1.21
- Gin框架
- SQLite3
- CORS支持

**部署:**
- N1盒子 (iStoreOS)
- Docker (可选)
- Nginx (可选)

## 项目文件结构

```
/mnt/sda1/project/creditCard/
├── server/
│   ├── main.go          # Go后端主文件
│   ├── go.mod           # Go依赖
│   └── card-server      # 编译后的二进制文件
├── dist/                # 前端构建产物
├── data/                # SQLite数据库目录
│   └── cards.db         # 数据库文件
├── docker-compose.yml   # Docker配置
├── nginx.conf           # Nginx配置
└── start.sh             # 启动脚本
```

## 下一步优化建议

1. **HTTPS支持**: 配置SSL证书
2. **备份策略**: 定时备份数据库
3. **监控告警**: 添加服务监控
4. **性能优化**: 图片CDN、缓存策略
5. **功能扩展**: 
   - 消费记录管理
   - 还款提醒推送
   - 数据导出功能
   - 多设备同步冲突解决
