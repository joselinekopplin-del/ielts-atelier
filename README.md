# IELTS Atelier · 雅思练习室

可以部署到 GitHub Pages 的纯静态 HTML / CSS / JavaScript 题库。无需账号、API Key、数据库或第三方运行依赖；适配桌面浏览器与 iPhone 屏幕。

**内容范围：2022—2026 年官方真题出版物索引 + 官方免费样题入口 + 站内原创仿真题。当前不是近五年全量真题全文库。** Cambridge 17—21 的年份表示出版年，不表示实际考试日期。官方试题全文、配套录音没有被复制进本项目。详细来源与覆盖缺口见 [SOURCES.md](./SOURCES.md)。

## 可以做什么

- 听力：分类答题、合成英语语音、语速调整、答案解析与录音文本。
- 阅读：材料与答题区并排、选择/判断/填空训练、客观题判分。
- 写作：Task 1 / Task 2 练习、自动计词、本机草稿、参考表达与自评。
- 口语：Part 1 / Part 2 / Part 3 练习、准备计时、录音回放与下载、复盘自评。
- 训练：按技能/题型/关键词筛选、分类速刷、每日小练、分科和四科顺序仿真计时。
- 复习：客观错题与主观自评待巩固题、按表现安排到期复习、关联词汇回忆与收藏。
- 提醒：站内提示、可导入系统日历的每日重复 `.ics` 提醒。
- 数据：本机持久化、学习备份导入/导出、个人题库 JSON 导入/导出。

默认 **General Training（培训类）**，适合以 G 类为主要备考方向的使用者；在「学习设置与数据」中可以切换 Academic。听说题共用，读写按模块筛选。G 类阅读围绕日常生活、工作场景和一般兴趣话题组织；G 类 Task 1 练书信，Task 2 练议论文。题库数量以页面实际显示为准，不把外部书目或样题链接计入站内可答题数。

原创短题与合成语音用于练习；仿真计时不意味着材料长度、真实口音、难度已与正式考试等值。写作、口语采用自评，不提供 AI 考官评分或可靠 Band 预测。已使用过旧版的浏览器可能保留之前选择的考试类别，可在设置中改为 General Training。

## 本地使用

直接双击 `index.html` 可以打开基本练习页面；推荐用本地 HTTP 服务，以支持离线缓存与浏览器媒体权限。

安装 Node.js 22 或更高版本后，在本目录执行：

```sh
npm start
```

打开 [本机预览](http://127.0.0.1:4173)。按 `Ctrl+C` 停止。服务仅绑定本机回环地址，不对局域网开放。无需执行 `npm install`。服务器从脚本目录读取文件，可处理包含中文的工作区路径和 URL 文件名。

```sh
npm test
```

测试由 Node 内置运行器执行。浏览器音频、麦克风与 Safari 设备行为仍需在真实设备验证，单元测试不能代替设备验收。

## GitHub Pages 发布：分支方式

1. 把 **本目录内的文件**上传到目标仓库根目录，保证仓库根下直接有 `index.html`，不要再多套一层 `ielts-studio` 文件夹。隐藏文件 `.nojekyll` 也要上传。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **Deploy from a branch**。
3. 选择存放网站的分支（通常 `main`），文件夹选择 **/(root)**，保存。
4. 等待 GitHub 显示发布地址，通常形如 `https://你的用户名.github.io/仓库名/`。使用实际返回的地址打开。

这是纯静态项目，没有构建步骤。所有资源采用相对路径，可以放在项目仓库子路径。分支发布方式不需要附带的自定义部署工作流：选择此方式时，可不上传 `.github/workflows/pages.yml`，或在 Actions 中停用它，避免两套发布流程同时运行。

## GitHub Pages 发布：Actions 方式

希望发布前自动检查时，保留 `.github/workflows/pages.yml`，并在 **Settings → Pages → Source** 选择 **GitHub Actions**。之后推送到 `main` 会先检查并运行测试，再发布静态文件。也可在 Actions 中手动运行工作流。若默认分支不是 `main`，请修改工作流的 `on.push.branches`。

工作流使用 GitHub 当前官方 Pages 示例中的 `checkout@v6`、`configure-pages@v5`、`upload-pages-artifact@v4` 与 `deploy-pages@v4`。发布需要仓库的 Pages 可用且部署环境规则允许当前分支。流程参见 [GitHub 官方工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)；分支和 Actions 两种来源设置见 [官方配置说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

项目交付本身不代表已上传或已上线；实际发布以目标仓库成功的 Pages 部署结果为准。

## iPhone、离线与提醒

在 iPhone Safari 中打开已发布的 HTTPS 地址，可通过分享菜单「添加到主屏幕」。至少在线打开并等待资源加载完成一次，再尝试离线使用。首次注册服务工作线程后刷新一次，可确保页面已受离线缓存控制。内置题、页面与词汇可被缓存；官方外链始终需要联网。浏览器可能清理缓存和本机数据，所以请定期备份。

语音播放必须由点击开始，并依赖浏览器支持及设备英语语音；未安装离线英语语音时，断网语音不保证可用。录音需要 HTTPS、麦克风权限和浏览器媒体录制支持；若设备不支持，可以使用系统录音工具配合口语题练习。**当前页面的录音不写入学习备份，离开题目前请下载。**

站内提醒在网页运行时检查。此纯静态项目没有推送服务器，也不承诺关闭网页后自动通知。需要离线提醒时，在设置页导出 `.ics` 文件并导入系统日历；是否弹出通知由日历权限、系统专注模式等设置决定。仿真倒计时按截止时间计算，切后台或退出练习不会暂停时间。

PC 与 iPhone 不自动同步。导出学习备份，再到另一设备导入；个人题库需单独导出并先导入目标设备。作答草稿与当前未完成训练保存在当前浏览器，不包含在学习备份里。私密浏览、清除网站数据、换浏览器或换域名都可能造成记录不可用。

## 导入自己的题库

从设置页下载 [question-template.json](./question-template.json)，按 JSON 数组格式编辑，再使用「导入个人题库」。模板本身是原创示例。

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一 ID，仅英文字母、数字、下划线、短横线，不能与内置题冲突 |
| `skill` | `listening` / `reading` / `writing` / `speaking` |
| `module` | `academic` / `general` / `both` |
| `type`, `title`, `topic`, `prompt`, `explanation` | 必填题型、标题、主题、题干、解析文本 |
| `level` | 难度标签，例如「基础」「进阶」 |
| `passage` | 阅读材料，或写作图表的文字数据 |
| `transcript` | 听力文本；听力题必须提供，由设备合成语音 |
| `answer` | 听读题必填的标准答案数组；多个字符串表示可接受答案，不是多选集合 |
| `options` | 可选的单选项数组；正确答案必须与选项全文完全对应 |
| `model`, `checklist`, `minWords` | 口写参考表达、自评清单、写作目标词数 |
| `vocabulary` | 词汇数组，每项包含 `word`、`meaning`、`example` |

单次文件限 5 MB，单次导入 1—2000 题。重复的个人 ID 会更新对应题目。个人内容只保存在当前浏览器；导入操作不修改 GitHub 仓库。不把私人备份或未经授权的第三方试题音频提交到公开仓库。来源与年份不能因为导入而变成已核实真题；导入内容统一显示为「个人导入」。

## 文件与维护

`index.html` 是入口，`styles.css` 是响应式布局，`app.js` 是页面交互，`core.js` 是判题/复习/统计逻辑，`questions.js` 是原创题库，`sources.js` 是核实过的外部来源，`sw.js` 和 `manifest.webmanifest` 提供离线缓存与主屏幕安装支持。

更新静态内容后，在线访问会优先获取网络版本，失败时才使用缓存。变更缓存文件列表时同步更新 `sw.js` 的版本号；新的服务工作线程会在旧标签页关闭后接管。缓存名称包含本站作用域，更新不会清除同域其他项目的缓存。

本项目为独立学习工具，与 IELTS 主办机构没有隶属关系；IELTS 及相关商标属于其权利人。来源目录中的外部材料仍受原站条件约束。
