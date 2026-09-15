/**
 * 帮助文本。中英文完整成文维护，不做逐句拼接。
 */

const HELP_CN = `
HelloAGENTS v{version} — AI 编码 CLI 的思维激活层

用法
  helloagents <命令> [参数]
  helloagents [--lang cn|en] <命令> [参数]

安装与维护
  install <宿主…|--all> [--standard|--global] [--scope user|project]  安装到宿主（默认优先全局模式，其次标准模式；--scope 用于 OMP）
  uninstall <宿主…|--all> [--purge]            卸载；--purge 同时删除 ~/.helloagents 配置
  update [宿主…]                               刷新运行副本并同步已安装宿主；不指定则全部刷新
  init                                         在当前项目写入 AGENTS.md 内核并建立知识库
  doctor [--json]                              体检安装状态，识别 3.x 残留
  migrate                                      清理 3.x 版本的全部残留

附加组件（可选）
  guard on|off [宿主…]                         危险命令拦截（支持：claude、codex、grok、cursor、hermes）
  notify on|off [宿主…]                        完成提醒（支持：claude、codex、grok、cursor、hermes）

其他
  version                                      显示版本
  help                                         显示本说明

宿主
  claude（Claude Code）    codex（Codex CLI）     grok（Grok Build）
  cursor（Cursor）         hermes（Hermes）       dsh（DeepSeek Harness）
  omp（Oh My Pi）

说明
  安装方式有两种：全局模式使用宿主自带的原生插件市场；标准模式把内核注入宿主的
  用户级规则文件（标记包裹，卸载即还原），并写入 hooks 与软链接。Cursor 没有
  用户级规则文件，标准模式只安装 hooks 与软链接；全局模式额外下发插件规则
  （rules），安装后需在 Cursor 里重载窗口生效。全局模式叠加在标准层之上。
  DeepSeek Harness 标准模式把内核写入 ~/.dsh/AGENTS.md（dsh 原生读取），技能同步到
  ~/.dsh/skills/；全局模式安装本地 bundle 快照并写入 $DSH_HOME/cordis.patch.yml，
  对所有 profile 生效，也可用 dsh plugin --profile <name> add helloagents 从 npm 安装。
  语言可用环境变量 HELLOAGENTS_LANG=cn|en 指定，或在命令前加 --lang cn|en。
  OMP 默认使用原生插件（omp plugin link，仅 user scope），运行副本统一位于 ~/.helloagents/app；使用
  --standard 写入 OMP AGENTS.md，--standard --scope project 时写当前项目 .omp/AGENTS.md。OMP
  插件与上下文文件互斥；project scope 不能用于原生插件链接，找不到 omp 或版本低于 18.1.0 时安装直接失败。
  旧版 --inject/--plugin 别名仍然可用，对应 --standard/--global。
`

const HELP_EN = `
HelloAGENTS v{version} — a thinking-activation layer for AI coding CLIs

Usage
  helloagents <command> [arguments]
  helloagents [--lang cn|en] <command> [arguments]

Install and maintain
  install <hosts…|--all> [--standard|--global] [--scope user|project]  Install (global mode preferred, standard as fallback; --scope is for OMP)
  uninstall <hosts…|--all> [--purge]            Uninstall; --purge also removes ~/.helloagents
  update [hosts…]                               Refresh the runtime copy and installed hosts; all if omitted
  init                                          Write the kernel into ./AGENTS.md and set up the knowledge base
  doctor [--json]                               Check installation health and detect 3.x leftovers
  migrate                                       Clean up everything left behind by version 3.x

Optional add-ons
  guard on|off [hosts…]                         Dangerous-command blocking (claude, codex, grok, cursor, hermes)
  notify on|off [hosts…]                        Completion notifications (claude, codex, grok, cursor, hermes)

Other
  version                                       Show version
  help                                          Show this message

Hosts
  claude (Claude Code)    codex (Codex CLI)     grok (Grok Build)
  cursor (Cursor)         hermes (Hermes)       dsh (DeepSeek Harness)
  omp (Oh My Pi)

Notes
  Two install methods: global mode uses the host's own native plugin marketplace; standard
  mode writes the kernel into the host's user-level rules file (wrapped in markers; uninstalling
  restores the file), plus hooks and a symlink. Cursor has no user-level rules file, so
  standard mode only installs hooks and the symlink; global mode also ships the kernel as a
  plugin rule (reload the Cursor window after installing). Global mode layers on top of the
  standard base. DeepSeek Harness standard mode writes the kernel into ~/.dsh/AGENTS.md
  (read natively by dsh) and syncs skills into ~/.dsh/skills/; global mode installs a local
  bundle snapshot and registers it in $DSH_HOME/cordis.patch.yml (applies to every profile),
  or use dsh plugin --profile <name> add helloagents to install from npm.
  Set HELLOAGENTS_LANG=cn|en or use --lang cn|en to choose the language.
  OMP uses its native plugin link by default at user scope; the runtime copy lives at ~/.helloagents/app.
  Use --standard for OMP AGENTS.md context injection, and --standard --scope project for the
  current project's .omp/AGENTS.md. Project scope is rejected for native plugin linking. The
  two OMP integrations are mutually exclusive, and install fails when omp is missing or older
  than 18.1.0.
  Legacy --inject/--plugin aliases still work, mapping to --standard/--global.
`

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @param {'cn' | 'en'} language
 */
export function runHelp(ctx, language) {
  const text = language === 'cn' ? HELP_CN : HELP_EN
  ctx.log(text.replaceAll('{version}', ctx.version).trim())
}
