#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');

function has(text, pattern, message) {
  assert(pattern.test(text), message);
}

// 管理栏只保留高频动作，演示锁定归入设置。
assert(!html.includes('id="mgQuickLock"'), '管理栏不应保留演示锁定按钮');
assert(!js.includes("$('#mgQuickLock')"), '脚本不应再绑定已移除的演示锁定按钮');

// 五个设置任务分组；展示与品牌共享一个导航分类但保留原功能区。
const targets = [...html.matchAll(/data-settings-target="([^"]+)"/g)].map((match) => match[1]);
assert.deepStrictEqual(targets, ['display', 'business', 'export', 'data', 'advanced'], '设置导航应按五类任务编排');
assert.strictEqual((html.match(/data-settings-group="display"/g) || []).length, 2, '展示与品牌分类应包含两个原功能区');

// 浏览器原生文件按钮由统一按钮替代。
has(html, /id="imgInput"[^>]*hidden/, '菜品图片 input 应隐藏');
has(html, /class="mg-btn secondary" id="imgChooseBtn"/, '菜品图片应使用统一选择按钮');

// 控件尺寸、焦点与主题弹层令牌必须存在。
['--control-h-compact', '--control-h', '--control-h-touch', '--control-disabled-opacity', '--focus-ring', '--button-primary-bg', '--button-secondary-bg', '--popover-bg', '--pad-menu-bg', '--pad-modal-scrim']
  .forEach((token) => assert(css.includes(token + ':'), `缺少设计令牌 ${token}`));
has(css, /\.mg-btn\s*\{[^}]*min-height:var\(--control-h\)/s, '按钮应消费标准高度令牌');
has(css, /\.tablet-banquet-menu\s*\{[^}]*background:var\(--pad-menu-bg\)/s, 'Pad 宴席下拉应消费主题令牌');

// LOGO 使用真实图片等比渲染，禁止恢复成横纵独立背景尺寸。
has(css, /\.tablet-logo-img[^}]*object-fit:contain/s, 'Pad LOGO 必须等比 contain');
has(js, /function applyTabletLogoImage\(/, 'Pad LOGO 应通过图片渲染器输出');
assert(!js.includes('function tabletLogoRegionStyle'), '不得使用会独立计算 X/Y 缩放的旧 LOGO 背景渲染器');

// 键盘与弹窗可达性：隐藏原生 select、支持方向键、锁住并返回焦点。
has(js, /select\.tabIndex\s*=\s*-1/, '隐藏的原生 select 不应进入 Tab 顺序');
has(js, /select\.setAttribute\('aria-hidden',\s*'true'\)/, '隐藏的原生 select 应从可访问树移除');
has(js, /event\.key === 'ArrowDown'/, '自定义下拉必须支持方向键');
has(js, /function initDialogFocusManagement\(/, '弹窗必须启用统一焦点管理');
has(js, /role="button" aria-label="查看菜品/, '展示卡片必须具备键盘语义');
has(js, /settingsCloseGuard\s*=\s*\(\)\s*=>/, '设置关闭时必须检查未保存修改');
has(js, /confirm\('宴席与分类有未保存修改/, '菜单结构切换与关闭必须给出未保存确认');
has(css, /@media \(max-width:680px\)[\s\S]*?#settingsModal \.settings-card\s*\{[^}]*min-width:0/, '窄屏设置工作台必须解除桌面最小宽度');

console.log('✅ UI 令牌、响应式、主题与可访问性约束通过');
