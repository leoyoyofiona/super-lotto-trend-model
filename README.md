# 超级大乐透走势预测模型

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/leoyoyofiona/super-lotto-trend-model)

中国体彩超级大乐透开奖走势分析与预测看板。页面包含实时开奖更新、走势图、冷热遗漏、结构特征、预测号码、开奖历史、奖池和一等奖金额。

线上地址：[https://super-lotto-trend-model.onrender.com](https://super-lotto-trend-model.onrender.com)

## 本地运行

```bash
npm install
npm run dev
```

## 生产运行

```bash
npm run build
PORT=4174 npm run start
```

生产服务由 `server/index.mjs` 托管 `dist`，并代理 `/fjtc-lottery/lottery` 到福建体彩网开奖接口。部署后页面点击“刷新开奖”会通过同一个代理获取最新开奖数据。

## Render 部署

项目根目录已经包含 `render.yaml`，可作为 Render Blueprint 或 Web Service 配置使用：

- Build Command: `npm ci --include=dev --ignore-scripts && npm run build`
- Start Command: `npm run start`
- Node: `22.12.0`

如果通过 Render Dashboard 手动创建服务，选择 Node Web Service，填入上面的构建和启动命令即可。

## 打赏二维码

页面会读取以下两个文件：

- `public/donate/alipay-qr.jpg`
- `public/donate/wechat-qr.jpg`

替换收款码时，保持文件名不变即可；也可以换成 PNG/SVG，但要同步修改 `src/App.tsx` 里的图片路径。
