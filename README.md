# 太化新材料价格看板 - GitHub Pages 版

## 文件说明

```
太化价格看板-GitHub版/
├── index.html              # 看板页面（从 data.json 加加载数据）
├── fetch_prices.py         # 价格抓取脚本（输出 data.json + price_history.json）
├── data.json               # 价格数据文件（脚本自动生成）
├── price_history.json      # 价格历史记录（脚本每日追加，保留最近90天）
├── manifest.json           # PWA 应用清单（支持添加到手机桌面）
├── sw.js                   # Service Worker（离线缓存）
├── .github/workflows/
│   └── update-prices.yml   # GitHub Actions 定时任务
└── README.md               # 本文件
```

## 部署步骤

### 1. 创建 GitHub 仓库

在 GitHub 上新建一个**公开**仓库（私有仓库无法免费使用 GitHub Pages）。

### 2. 上传文件

将本文件夹内所有文件上传到仓库根目录：

```bash
cd 太化价格看板-GitHub版
git init
git add .
git commit -m "太化价格看板 GitHub Pages 版"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

### 3. 开启 GitHub Pages

1. 进入仓库的 **Settings → Pages**
2. Source 选择 **Deploy from a branch**
3. Branch 选择 **main**，文件夹选择 **/ (root)**
4. 点击 Save

等待 1-2 分钟，页面会显示访问地址：`https://你的用户名.github.io/你的仓库名/`

### 4. 开启 GitHub Actions

1. 进入仓库的 **Settings → Actions → General**
2. 确认 Actions permissions 为 **Allow all actions and reusable workflows**
3. 进入 **Settings → Actions → Workflow permissions**，改为 **Read and write permissions**（否则定时任务无法自动提交 data.json 和 price_history.json）

### 5. 验证自动更新

- 每天北京时间早上 8:00，GitHub Actions 会自动运行 `fetch_prices.py`
- 脚本从生意社抓取最新价格，生成新的 `data.json` 和 `price_history.json` 并自动提交到仓库
- Pages 页面会自动更新

也可以手动触发：进入仓库 **Actions** 页 → 左侧选 **Update Prices** → 点击 **Run workflow**

## 功能说明

### 价格总览
- 13 个化工产品实时价格（产品/原料/中间体分类展示）
- 每张价格卡片可点击查看 30 日趋势图
- **真实历史趋势**：趋势图基于 `price_history.json` 中的真实每日价格绘制，数据每天自动积累

### 公告/市场要闻
- **自动抓取**：每次 `fetch_prices.py` 运行时，自动从生意社各化工品新闻页抓取最新行业资讯（装置检修、市场动态、行业快讯、价格预警、安全事故、政策法规等分类），标记为 `autoFetched: true`
- **自动+手动合并**：自动抓取的新闻与手动维护的新闻合并展示，自动去重（按标题），手动新闻优先
- **自动更新徽章**：当存在自动抓取的新闻时，标题旁显示"自动更新"徽章
- **点击跳转**：自动抓取的新闻标题可点击，跳转到生意社原文
- **手动编辑**：在 `data.json` 的 `news` 数组中手动添加的条目（不带 `autoFetched` 字段）会被永久保留，不会被自动抓取覆盖
- 数据来源：生意社 (100ppi.com) 各化工品新闻列表页

### 利润分析
- 基于当日原料价格和消耗定额计算各产品线吨毛利
- 可手动调整氢气/蒸汽/电价，实时重算利润
- **多周期利润分析**：支持切换"当日 / 7日均值 / 30日均值"三种周期，对比不同时间窗口下的利润走势，判断利润趋势是在改善还是恶化

### PWA 离线支持
- 在手机浏览器打开看板后，可"添加到主屏幕"作为独立 App 使用
- 离线时自动使用缓存数据，顶部显示离线状态提示
- `manifest.json` 配置应用图标和主题色，`sw.js` 实现 Service Worker 缓存策略

## 数据说明

- 数据来源：生意社 (100ppi.com)
- 包含 13 个化工产品价格（已排除无数据源的 6 个产品）
- 价格每天自动更新一次
- 价格历史保留最近 90 天，存储在 `price_history.json`
- 利润分析基于内置的成本参数，可在看板上手动调整氢气/蒸汽/电价

## 手动更新

在本地运行：

```bash
python fetch_prices.py
```

会重新抓取价格并更新 `data.json` 和 `price_history.json`，然后刷新 `index.html` 即可看到最新数据。
