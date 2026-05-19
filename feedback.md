# WIMM Feedback

## v0.5 第四轮反馈 (2026-05-18)

- [x] 日历视图缩小为原来的 1/4 — CalendarView 单元格改为 h-7，字号缩小至 10px/8px
- [x] 日视图移除商户支出排名和账户支出 — 日粒度下隐藏 TrendChart、CategoryPieChart、MerchantRanking、AccountBalances
- [x] 周视图可选择周数并更新饼图和商户支出 — 选中周后传入 date_from/date_to 过滤 category-breakdown 和 merchant-ranking
- [x] 周视图柱状图单位为日期（7天） — 选中周后趋势 API 用 granularity=day + date_from/date_to
- [x] 月视图柱状图单位为日期，左右按钮切换月份 — 新增上月/下月导航，趋势 API 用 granularity=day
- [x] 季度视图单位为月 — 新增上季/下季导航，趋势 API 用 granularity=quarter + quarter 参数按月分组
- [x] 年度视图单位为月 + 季度 — 主图 12 个月柱状图 + 第二图 4 季度柱状图，新增上年/下年导航
- [x] 总布局重构 — 左侧 1/4（日历+统计）+ 右侧 3/4（图表）；日/月/季/年均支持左右导航按钮
