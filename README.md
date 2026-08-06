# 秋招投递追踪

自制秋招网站：基于 Flask 后端 + 原生前端的秋招投递管理应用，支持邮箱注册/登录，数据存储在 MySQL 数据库中，可多设备同步。

## 功能

- **用户系统**：注册、登录、JWT 鉴权，数据多用户共享可见
- **概览页**：近期投递、笔面试日程、快捷统计
- **新增投递**：记录公司、岗位、城市、进度、下一步事件等
- **投递列表**：搜索、筛选、编辑、删除，显示创建者
- **投递详情**：查看每家公司投递进度的时间线（谁改了什么、什么时候改的）
- **公司共享面经**：同一家公司的投递详情页可编辑共享备注，所有用户可见
- **数据可视化**：进度分布、近 30 天投递趋势、岗位类型分布、城市分布
- **转化漏斗**：投递 → 笔试 → 面试 → Offer 的转化率漏斗
- **平均响应周期**：统计各阶段之间的平均等待天数
- **截止日期提醒**：记录网申截止日期，即将截止时自动提醒
- **公司 Logo**：自动尝试加载对应公司 Logo，失败时显示首字母占位
- **桌面通知**：每天首次登录提醒当日笔试/面试
- **深色模式**：侧边栏一键切换，偏好自动保存
- **数据管理**：导出/导入 JSON 备份、清空数据

## 本地运行

### 1. 安装依赖

需要 Python 3.8+。

```bash
conda activate flask-qiuzhao
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填入本地 MySQL 与 QQ 邮箱 SMTP 配置。`.env` 已被 Git 忽略，不会提交密码或邮件授权码。

默认数据库配置为：

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=qiuzhao_db
```

### 3. 初始化或升级数据库

```bash
flask --app app db upgrade
```

### 4. 启动后端

```bash
flask --app app run --debug
```

默认运行在 `http://localhost:5000`。

### 5. 访问应用

打开浏览器访问 `http://localhost:5000`，注册账号后即可使用。

## 数据库迁移

项目使用 Flask-Migrate 管理 MySQL 数据库结构。模型发生变更后，生成并应用新的迁移：

```bash
flask --app app db migrate -m "describe schema change"
flask --app app db upgrade
```

服务器部署时只需配置同名环境变量，并执行 `flask --app app db upgrade`，无需运行 `db.create_all()`。

## 认证接口

- `GET /api/email/code?email=you@example.com`：发送 4 位注册验证码，3 分钟有效。
- `POST /api/register`：提交 `email`、`code`、`username`、`password` 注册。
- `POST /api/login`：提交 `email`、`password` 登录。

## 文件结构

```
qiuzhao-tracker/
├── app.py                  # Flask 后端主入口
├── models.py               # 数据库模型（含 EmailCode）
├── config.py               # 数据库和邮件配置
├── migrations/             # Flask-Migrate 迁移文件
├── .env.example            # 环境变量模板
├── requirements.txt        # Python 依赖
├── .gitignore
├── static/                 # 前端静态文件
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```

## 部署

详细的 Ubuntu + Docker Compose 部署步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

### 后端部署（推荐 Render / Railway / PythonAnywhere）

1. 将代码推送到 GitHub
2. 在 Render/Railway 等平台选择 Python/Flask 项目
3. 设置环境变量：
   - `SECRET_KEY`：用于 Flask session
   - `JWT_SECRET_KEY`：用于 JWT 签名
   - `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`：MySQL 配置
   - `MAIL_SERVER`、`MAIL_PORT`、`MAIL_USE_SSL`、`MAIL_USERNAME`、`MAIL_PASSWORD`、`MAIL_DEFAULT_SENDER`：验证码邮件配置
4. 部署后执行 `flask --app app db upgrade`

### 前端

前端由 Flask 直接作为静态文件提供，无需单独部署。

## 数据导入

在「设置」页面可以导出当前投递记录为 JSON 备份，也可以从 JSON 文件恢复。适合换设备或定期备份。

## 注意事项

- 当前默认使用 MySQL，数据库密码与邮件授权码必须仅保存在部署环境的环境变量或 `.env` 文件中。
- 生产环境务必修改 `SECRET_KEY` 和 `JWT_SECRET_KEY`。
- 公司 Logo 使用 Clearbit Logo API，部分公司可能无法匹配，会自动 fallback 到首字母。
