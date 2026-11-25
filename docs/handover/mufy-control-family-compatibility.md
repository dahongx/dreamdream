# 迁移按钮色调与继承盒模型续修

产品取舍见 [insights](../insights/mufy-control-family-compatibility.md)。全部是公开样式或有限布局适配；未访问数据库、来源凭据或私有设定。

## 模型配色优先级

2026-10-31 正常 TEST 手机页面逐卡检查27个非留置角色，均核对角色名称、四按钮存在性和聊天区横向边界。江之余出现真实模型按钮差异：旧 `Public DOM appearance compatibility` 生成的十一重ID配色快照压过十重ID的重说按钮家族镜像。只降低背景后，模型文字又被功能文字保护规则覆盖为浅色，已保留该未通过的中间结果。

`buildMufyPublicSemanticSkin` 的默认模型背景快照现为八重ID后备，家族文字颜色对四个按钮共同应用；显式 `source-model-fallback` 仍保留原四按钮统一表面契约。`lowerLegacyMufyModelSnapshot` 只处理带正确来源注释、唯一精确生成选择器和旧三按钮文字家族的内容；拒绝未知、重复、已修内容，不改作者声明、标签、几何或其他选择器。

江之余主题通过正常 studio UI 新鲜备份后保存，刷新回读63972字符，SHA256 `f1207a9a1c5b72e5791c933fb2634aaf22b2260ae052ff6cc2c2798ddb2e13e7`。真实 TEST 四按钮已同为白色渐变底、rgb(180,50,50)文字；截图 `final-acceptance/46/model-family-fixed-mobile-20261031.png`。这是角色主题数据修复，不代表新运行时已构建/部署，也不是整卡通过。

## 已知父级资料标签片段

实际原站 `.censy-gf-tabs` 位于主文档，继承 border-box；隔离重放误用 content-box，边框造成额外宽度和内层横向滚动条。`OpeningSlot` 仅对有迁移来源标记、包含两项精确类名且非完整文档的已知片段，在作者CSS前补该组件范围的border-box，不改overflow，不隐藏内容。路由会将完整文档包装为 `data-nj-doc`，必须一并排除，不能仅检查html/body标签。

真实公开片段本地复验已确认343宽无横向溢出，三个标签正常打开且正文与当前原站逐字一致，发送0；证据 `parent-tabs-box-local-fixed-20261031.json`、`parent-tabs-interaction-local-20261031.json`。此运行时修复尚未 TEST 部署。对应回归检查普通组件、完整独立文档不受影响。
