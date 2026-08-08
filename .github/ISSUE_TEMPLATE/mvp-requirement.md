---
name: MVP 需求拆分
about: 按标准敏捷流程拆分 MVP 需求（状态用 label 管理：backlog / todo / doing / done）
title: '[需求] '
labels: ['backlog']
assignees: ''
---

<!--
状态流转规则（在 issue 上切换 label）：
- backlog：进入待办池，尚未排期（创建时默认）
- todo：已排期，待开始开发
- doing：开发中（关联 PR 打开时）
- done：PR 已合并、交付完成（由 PR 的 Fixes #N 自动或人工关闭时同步切换）
Blocking 关系通过下方字段互相引用表达，如 "Blocked by #12"。
-->

## 需求描述

<!-- 要解决的问题与背景，为什么需要这个需求 -->

## 验收标准

- [ ] <!-- 可验证的验收点 1 -->
- [ ] <!-- 可验证的验收点 2 -->

## Blocking 关系

- 本需求被阻塞：<!-- Blocked by #issue 号，无则填"无" -->
- 本需求阻塞其他需求：<!-- Blocks #issue 号，无则填"无" -->

## 测试目标

<!-- 手动验证对象与目标，供 PR 阶段核对 -->

## 关联交付

- 分支：<!-- 建议分支命名：feat/<issue号>-<短描述> -->
- PR：#<!-- PR 创建后回填编号，PR 描述中需包含 C4 图 / UML / 数据流图与测试记录 -->
