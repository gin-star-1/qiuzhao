# 秋招投递追踪

自制秋招网站：基于 Flask 后端 + 原生前端的秋招投递管理应用，支持用户注册/登录，数据存储在服务端 SQLite 数据库中，可多设备同步。

## 功能

- **用户系统**：注册、登录、JWT 鉴权
- **概览页**：近期投递、笔面试日程、快捷统计
- **新增投递**：记录公司、岗位、城市、进度、下一步事件等
- **投递列表**：搜索、筛选、编辑、删除
- **数据可视化**：进度分布、近 30 天投递趋势、岗位类型分布、城市分布
- **公司 Logo**：自动尝试加载对应公司 Logo，失败时显示首字母占位
- **数据管理**：导出/导入 JSON 备份、清空数据

## 本地运行

### 1. 安装依赖

需要 Python 3.8+。

```bash
cd qiuzhao-tracker
pip install -r requirements.txt
```

### 2. 启动后端

```bash
python app.py
```

默认运行在 `http://localhost:5000`，首次启动会自动创建数据库。

### 3. 访问应用

打开浏览器访问 `http://localhost:5000`，注册账号后即可使用。

## 文件结构

```
qiuzhao-tracker/
├── app.py                  # Flask 后端主入口
├── models.py               # 数据库模型（User / Application）
├── config.py               # 配置
├── requirements.txt        # Python 依赖
├── .gitignore
├── static/                 # 前端静态文件
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── initial_data.js     # 从 Excel 导入的初始投递数据
├── scripts/                # 数据处理工具
│   ├── read_xlsx_stdlib.py
│   ├── convert_excel_data.py
│   └── check_syntax.py
└── README.md
```

## 部署

### 后端部署（推荐 Render / Railway / PythonAnywhere）

1. 将代码推送到 GitHub
2. 在 Render/Railway 等平台选择 Python/Flask 项目
3. 设置环境变量（可选）：
   - `SECRET_KEY`：用于 Flask session
   - `JWT_SECRET_KEY`：用于 JWT 签名
   - `DATABASE_URL`：数据库连接字符串，默认使用 SQLite

### 前端

前端由 Flask 直接作为静态文件提供，无需单独部署。

## 从 Excel 更新初始数据

如果 `D:\桌面\2026秋招投递.xlsx` 有更新：

```bash
python scripts/read_xlsx_stdlib.py
python scripts/convert_excel_data.py
```

生成新的 `static/initial_data.js` 后，新注册用户登录时会询问是否导入这些历史数据。

## 注意事项

- 默认使用 SQLite，适合个人或小型使用。如需多人高并发，请替换为 PostgreSQL/MySQL。
- 生产环境务必修改 `SECRET_KEY` 和 `JWT_SECRET_KEY`。
- 公司 Logo 使用 Clearbit Logo API，部分公司可能无法匹配，会自动 fallback 到首字母。
