# 云谱档案

家谱管理与可视化系统原型。当前包含：

- `frontend/`：正式前端入口，读取后端 API 渲染家谱图、人物档案、时间轴与管理台。
- `backend/`：FastAPI 后端，启动时创建默认 SQLite 家谱文件。
- `prototype/`：早期东方族谱档案感视觉原型。

## 一键启动

Windows:

```powershell
.\scripts\start.ps1
```

或：

```bat
scripts\start.bat
```

macOS/Linux:

```bash
sh scripts/start.sh
```

启动后访问：

```text
http://127.0.0.1:8000
```

## 测试

后端测试：

```powershell
.\.venv\Scripts\python -m pytest backend\tests
```

视觉原型测试：

```powershell
npm run test:prototype
```
