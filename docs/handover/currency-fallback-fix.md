# 货币配置 Fallback 值修复

**日期：** 2026-06-26  
**问题：** 计费配置页面显示 0/1，对话页面显示 1/2  
**状态：** ✅ 已修复并合并到 main

---

## 问题描述

用户报告货币配置在不同页面显示不一致：
- **计费配置页面**（`/admin/currency-pricing`）：金币 0，银币 1
- **对话页面**（`/characters/:id/chat`）：金币 1，银币 2

## 根本原因

`src/lib/billing/currency.ts` 中的三个函数使用了硬编码的 fallback 默认值（1/2），当数据库查询失败或返回空时使用这些值，但管理员已在数据库中将价格修改为 0/1，导致不一致。

## 修复方案

将 fallback 默认值从 1/2 改为 0/1，与当前数据库配置对齐。

## 影响范围

- `checkCurrencyBalance()` - 检查用户余额
- `deductCurrency()` - 扣除货币
- `refundCurrency()` - 退还货币

## 验证

- ✅ 所有 241 个单元测试通过
- ✅ 类型检查通过
- ✅ Lint 检查通过
- ✅ 已合并到 main 分支（commit 5ec0bd1）

## 用户操作

修复后需要刷新对话页面（Ctrl+Shift+R）确认货币显示更新为 0/1。

## 附加资源

- **详细分析：** `CURRENCY_MISMATCH_ANALYSIS.md`
- **诊断工具：** `scripts/diagnose-currency-mismatch.ts`
