# 超级大乐透走势预测模型

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/leoyoyofiona/super-lotto-trend-model)

中国体彩超级大乐透开奖走势分析与预测看板。页面包含实时开奖更新、走势图、冷热遗漏、结构特征、预测号码、开奖历史、奖池和一等奖金额。

免责声明：本项目仅供爱好者进行预测分析和统计分析，不作为博彩投注的参考依据。

线上地址：[https://super-lotto-trend-model.onrender.com](https://super-lotto-trend-model.onrender.com)

## 宣传图预览

小红书配图和文案在 [`promo`](promo) 目录。

<p>
  <img src="promo/xhs-01-cover.png" width="180" alt="超级大乐透小红书封面" />
  <img src="promo/xhs-02-data-update.png" width="180" alt="实时数据更新" />
  <img src="promo/xhs-03-trend-analysis.png" width="180" alt="走势分析" />
  <img src="promo/xhs-04-smart-recommend.png" width="180" alt="智能推荐" />
  <img src="promo/xhs-05-hot-cold.png" width="180" alt="冷热遗漏" />
</p>

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

访问统计接口为 `/api/visits`。默认计数文件保存在 `.data/visit-counter.json`，也可以通过 `VISIT_COUNTER_FILE` 环境变量指定保存位置。Render 免费实例重启或重新部署可能重置本地文件计数；如需长期保留累计值，可给服务绑定持久化磁盘或改接 Redis/数据库。

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

<p>
  <img src="public/donate/alipay-qr.jpg" width="220" alt="支付宝打赏二维码" />
  <img src="public/donate/wechat-qr.jpg" width="220" alt="微信打赏二维码" />
</p>

替换收款码时，保持文件名不变即可；也可以换成 PNG/SVG，但要同步修改 `src/App.tsx` 里的图片路径。
