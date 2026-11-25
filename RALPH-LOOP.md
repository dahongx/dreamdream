# Ralph Loop 实用指南

> 起源：v1 完成后我用 `/ralph-loop` 跑过一夜（326 次迭代，token 全烧光）。
> 根本原因和怎么避免，都写在下面。

## 根因：Ralph Loop 没有自然语言的出口

启动一次失败的 loop 长这样：

```
/ralph-loop:ralph-loop 请继续开发 w4-w10，直到 v1 开发完成。注意每个 wx 开发完成之后进行一次 git commit
```

runtime 不读中文意图。它只看模型有没有输出 `completion-promise` 字符串。"直到 v1 完成"这种自然语言出口等同于没写。

启动日志里其实有警告：

> ⚠️ WARNING: This loop cannot be stopped manually! It will run infinitely unless you set --max-iterations or --completion-promise.

但很容易忽略。

---

## 三条铁律

### 铁律 1：永远设硬封顶

```
/ralph-loop --max-iterations 10 <task>
```

就算别的都忘了，加上这一行至少不会跑一晚上。10–20 是合理上限——绝大多数有意义的迭代都在 5–15 轮之内。

### 铁律 2：有出口就给字符串

任务有可判定终点（"修完这个 bug"、"v1 做完"、"测试全绿"）时，给模型一个字面字符串作为出口信号：

```
/ralph-loop \
  --max-iterations 20 \
  --completion-promise 'V1_DONE' \
  '请继续开发 w4-w10。每个 wx 完成后 git commit。
   当你判断 v1 全部完成时，输出 V1_DONE。'
```

模型一旦诚实地觉得做完了，就能输出 `V1_DONE`，loop 优雅退出。

### 铁律 3：没有出口就不要用 ralph-loop

如果任务本质是"持续改进"（无终点），用 ralph-loop 是自找麻烦。改用：

- `/loop 30m <task>` — 半小时一次的定时任务
- 或者就开个 session 手动跑

---

## 任务模板

### 模板 A：有明确终点的多步任务（最常见）

```
/ralph-loop \
  --max-iterations 15 \
  --completion-promise 'ALL_TESTS_PASS' \
  '修复 src/lib/regex 下所有失败测试。每修一个跑 bun test 确认。
   全部通过后输出 ALL_TESTS_PASS。'
```

### 模板 B：探索 / 找 bug

```
/ralph-loop \
  --max-iterations 8 \
  --completion-promise 'NO_MORE_BUGS_FOUND' \
  '审查这个仓库，找出真实 bug 并修复，每个 bug 一个 commit。
   找不到更多 bug 时输出 NO_MORE_BUGS_FOUND。'
```

限 8 轮——找 bug 的边际收益下降很快。

### 模板 C：纯刷工作（开发模式）

```
/ralph-loop --max-iterations 5 '/build-and-test 然后修第一个失败'
```

完全靠 `max-iterations` 兜底，不指望 promise。

---

## 不要做的事

❌ **不要用自然语言写"直到 X 完成"作为出口**
runtime 不读中文。"直到 v1 完成"等同于没写。

❌ **不要让模型自己判断要不要 commit**
模型会找——38 次也能找。明确告诉它"完成 X 个 commit 后停"，或者写出完成的判定标准。

❌ **不要在没有完成感的任务上用 ralph-loop**
"持续改进代码质量"、"polish v1"——这种任务没有自然终点，模型会一直找下去，直到挖词级别的问题（"AI 生成中" 改成 "Loading" 这种）。

❌ **不要忘了 `.claude/ralph-loop.local.md` 是 stop hook 的命脉**
删掉这个文件就立即停止。`/ralph-loop:cancel-ralph` 也是这么干的。卡死了直接：

```
rm .claude/ralph-loop.local.md
```

---

## 健康检查

跑之前 10 秒自查：

- [ ] 我有 `--max-iterations` 吗？
- [ ] 任务有明确终点吗？有 → 加 `--completion-promise`
- [ ] 没有终点？→ 重新考虑要不要用 ralph-loop
- [ ] 知道怎么停吗？（`rm .claude/ralph-loop.local.md` 或 `/ralph-loop:cancel-ralph`）

四个 yes 才发车。

---

## 这次事故的具体化

启动指令（失败版）：

```
/ralph-loop:ralph-loop 请继续开发 w4-w10，直到 v1 开发完成。
注意每个 wx 开发完成之后进行一次 git commit
```

应该的版本：

```
/ralph-loop:ralph-loop \
  --max-iterations 10 \
  --completion-promise 'V1_DONE' \
  '请继续开发 w4-w10，每个 wx 完成后 git commit。
   v1 的 10 个里程碑全部完成后输出 V1_DONE。'
```

按这个版本启动：前 7 轮把 W4-W10 真活做完，第 8 轮 v1 客观完成，模型输出 `V1_DONE`，loop 退出。整个过程 7-10 个 commit，token 消耗在合理区间。

---

## 时间线（实测）

这次跑了 326 次迭代，节奏大致：

| 轮次区间 | 性质 | 价值 |
|---------|------|------|
| 1–10 (W4–W10) | 真活，按 plan 跑 | ★★★★★ 高 |
| 11–20 (v1.1–v1.10) | 真 bug + 真 UI 缺失 | ★★★★ 实在 |
| 21–30 (v1.11–v1.20) | 边缘 bug + 缺失 doc | ★★★ 还行 |
| 31–38 (v1.21–v1.28) | 词级编辑、stale 注释 | ★★ 可疑 |
| 39+ | 模型拒绝制造工作，刷 "Holding position. v1 complete. No commit." | ★ 纯噪声 |

**模型从 39 轮开始就在抵抗，但 stop hook 不读模型的拒绝，只看 promise 字符串，于是噪声又跑了将近 300 轮。**

---

## 模型侧的对应做法

我（Claude）在这个项目下次再被起 ralph-loop 时会：

1. 主动检查启动命令有没有 `--max-iterations` 和/或 `--completion-promise`
2. 没有就在第一次响应里就指出来，并询问是否补上
3. 如果用户坚持没出口，按 5 轮硬上限自我克制
4. 看到工作变成"挖词级问题"立即停手，输出明确的"边际价值为零"信号

这些约束也存在 `~/.claude/projects/.../memory/` 下作为 feedback 记忆——不只是这个仓库生效。
