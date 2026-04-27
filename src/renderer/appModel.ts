import { DEFAULT_PHASE_ID, type CloudModelProtocol, type Id, type Message, type ModelPresetId, type ModelProvider, type Phase, type SelectionCartItem, type Topic, type WorkspaceManifest, type WorkspaceSnapshot } from '../shared/types';
import { DEFAULT_PHASE_ICON, PHASE_ICON_OPTIONS } from '../shared/phaseIcons';

export type View = { type: 'topic'; id: Id } | { type: 'phase'; id: Id } | { type: 'phases' } | { type: 'workspace' } | { type: 'backup' } | { type: 'settings' } | { type: 'trash' } | { type: 'welcome' };
export type Language = 'zh' | 'en';
export type ThemeId = 'sage' | 'graphite' | 'ocean' | 'paper' | 'rose' | 'aurora' | 'latte' | 'solar';
export type ComposerSettings = { providerId: Id; presetId: ModelPresetId; roleInstruction: string; profileInstruction: string; profileInstructionsByRole: Record<string, string>; temperature: number; maxTokens: number };
export type KeyboardSettings = { enterToSend: boolean };
export type GenerationState = { requestId: Id; topicId: Id; prompt: string; providerLabel: string; startedAt: number; stageIndex: number; processingSummary: string[]; streamedContent: string; attachmentCount?: number; contextCount?: number };
export type SummaryGenerationState = { targetType: 'topic' | 'phase'; targetId: Id; providerLabel: string; startedAt: number; stageIndex: number; processingSummary: string[] };
export type DiscussionGenerationState = { providerLabel: string; startedAt: number; stageIndex: number; processingSummary: string[] };
export type TopicNavGroup = { id: string; title: string; topics: Topic[] };
export type SearchResultKind = 'phase' | 'topic' | 'message' | 'topic-summary' | 'phase-summary';
export type SearchResult = { id: string; kind: SearchResultKind; title: string; subtitle: string; excerpt: string; target: View };

export { DEFAULT_PHASE_ID, DEFAULT_PHASE_ICON, PHASE_ICON_OPTIONS };

export const copy = {
  zh: {
    appName: '心线',
    brandMark: '心',
    brandSubtitle: '多话题 AI 思考工作区',
    workspace: '工作区',
    navigation: '导航',
    workspaceOverview: '概览',
    workspaceOverviewHelp: '查看当前工作区的阶段、话题和最近更新；选择左侧任一阶段或话题后进入详情。',
    workspaceOverviewEmpty: '还没有阶段或话题。先创建一个阶段或话题，开始沉淀这组思考。',
    workspaceStats: '整体状态',
    quickStart: '快速开始',
    recentTopics: '最近话题',
    phaseDirectory: '阶段目录',
    totalMessages: '总消息',
    summarizedPhases: '已总结阶段',
    unsortedTopics: '默认阶段话题',
    openTopic: '打开话题',
    openPhase: '打开阶段',
    currentWorkspace: '当前工作区',
    switchWorkspace: '打开其他',
    createNewWorkspace: '新建',
    openOrCreateWorkspace: '打开或新建',
    workspacePlaceholder: '/路径/到/工作区',
    pickWorkspace: '选择工作区目录',
    selectWorkspace: '选择工作区',
    create: '创建',
    cancel: '取消',
    open: '打开',
    workspaceHint: '选择任意项目文件夹，Mindline 会自动打开或初始化配置。',
    searchConversation: '搜索话题、阶段、消息...',
    searchSettings: '搜索设置...',
    searchOpen: '打开搜索',
    searchDialogTitle: '搜索中心',
    searchDialogHelp: '输入关键词查找当前工作区的阶段、话题、消息和总结。',
    searchScope: '搜索范围',
    searchScopeAll: '全部内容',
    searchStartTitle: '开始搜索',
    searchStartHelp: '输入关键词，或从最近话题继续。',
    searchResults: '搜索结果',
    searchRecent: '最近话题',
    searchFilterAll: '全部',
    searchFilterSummary: '总结',
    searchNoResults: '没有找到匹配内容',
    searchResultPhase: '阶段',
    searchResultTopic: '话题',
    searchResultMessage: '消息',
    searchResultTopicSummary: '话题总结',
    searchResultPhaseSummary: '阶段总结',
    noFolderSelected: '未选择文件夹。',
    phases: '阶段',
    phasesOverview: '阶段概览',
    phasesOverviewHelp: '按状态查看所有阶段，快速进入某个阶段，或为阶段创建新话题。',
    phasesOverviewEmpty: '还没有阶段。新建一个阶段，用来承接一组相关话题。',
    activePhases: '进行中阶段',
    endedPhases: '已结束阶段',
    phasesWithoutTopics: '空阶段',
    noPhases: '暂无阶段',
    newPhase: '新建阶段',
    refreshPhaseDirectory: '刷新阶段目录',
    collapsePhaseDirectory: '全部折叠',
    phaseNameOptional: '阶段名称，可选',
    phaseNamePlaceholder: '输入阶段名称',
    topics: '话题',
    noTopics: '暂无话题',
    newTopic: '新建话题',
    topicNameOptional: '话题名称，可选',
    topicNamePlaceholder: '输入话题名称',
    noPhase: '默认阶段',
    searchPhases: '搜索阶段...',
    noMatchingPhases: '没有匹配的阶段',
    settings: '设置',
    selection: '上下文',
    cart: '资料篮',
    openCart: '打开资料篮',
    openCartWithCount: '打开资料篮，{count} 项资料',
    closeCart: '收起资料篮',
    clearCart: '清空资料篮',
    cartItemCount: '{count} 项',
    cartCollapsedHint: '已选上下文',
    cartEmpty: '选择消息、话题或总结作为讨论资料。',
    discussSelection: '讨论资料',
    selectionPrompt: '基于上下文继续提问...',
    discuss: '讨论',
    trash: '回收站',
    backup: '备份',
    backupTimeline: 'Git 备份时间线',
    backupHelp: 'Mindline 只备份 .mindline、topics 和 phases，不接管项目代码或模型密钥。',
    backupStatus: '备份状态',
    backupReady: '已启用',
    backupUnavailable: '不可用',
    backupGitUnavailable: '未检测到系统 Git，安装 Git 后可启用本地备份。',
    backupClean: '当前无未备份变更',
    backupHasChanges: '有未备份变更',
    backupLastBackup: '最近备份',
    backupPath: '备份仓库',
    backupCreate: '立即备份',
    backupRefresh: '刷新',
    backupRestore: '恢复',
    backupCurrent: '当前',
    backupFilesChanged: '{count} 个文件',
    backupNoCommits: '还没有备份记录。打开本页或产生写入后会自动创建第一条备份。',
    backupRestoreConfirmTitle: '恢复这个备份？',
    backupRestoreConfirm: '恢复会把 Mindline 数据替换为所选备份点；操作前会自动创建“恢复前自动备份”。',
    backupRestoreSafety: '只会影响 .mindline、topics、phases；项目代码、用户 .git 和模型密钥不受影响。',
    backupRestored: '已恢复备份',
    backupManualCreated: '已创建备份',
    backupRemote: '远端同步',
    backupRemoteConnected: '已连接远端仓库',
    backupRemoteNotConnected: '未连接远端',
    backupRemoteEmptyHelp: '连接已有 GitHub、GitLab 或私有 Git 仓库后，可以在多设备间同步备份。',
    backupRemoteConnect: '连接远端仓库',
    backupRemoteReconnect: '重新连接',
    backupRemoteConnectHelp: '请使用专用空仓库或已有 Mindline 备份仓库。Mindline 不会创建仓库，也不会写入项目代码。',
    backupRemoteProvider: '平台',
    backupRemoteGeneric: '通用 Git',
    backupRemoteUrl: '仓库地址',
    backupRemoteBranch: '分支',
    backupRemoteAuth: '认证方式',
    backupRemoteSystemAuth: '系统 Git / SSH',
    backupRemotePatAuth: '访问令牌',
    backupRemoteUsername: '用户名',
    backupRemoteToken: 'Personal Access Token',
    backupRemoteTokenPlaceholder: '只保存在本机用户密钥目录',
    backupRemoteSshHelp: 'SSH 模式复用系统 ssh-agent、~/.ssh/config、1Password Agent 或 Git Credential Manager，不保存私钥。',
    backupRemoteGithubScope: 'GitHub fine-grained PAT 建议只给目标仓库 Contents: Read and write。',
    backupRemoteGitlabScope: 'GitLab PAT 建议只授予 write_repository 权限；私有化 GitLab 直接填写实例仓库地址。',
    backupRemoteGenericScope: '通用 Git 仓库需要允许当前凭据读取和写入目标分支。',
    backupRemoteTest: '测试连接',
    backupRemoteTestOk: '远端连接可用。',
    backupRemoteSave: '保存并连接',
    backupRemoteSync: '同步远端',
    backupRemoteClear: '断开连接',
    backupRemoteClearConfirm: '断开远端连接只会删除本机远端配置和 token，不会删除本地或远端备份。继续吗？',
    backupRemoteResolve: '处理冲突',
    backupRemoteNeedsAction: '需要处理',
    backupRemoteSynced: '已同步',
    backupRemoteAhead: '本地领先 {count}',
    backupRemoteBehind: '远端领先 {count}',
    backupRemoteSetupTitle: '选择远端初始化方式',
    backupRemoteSetupHelp: '远端分支已有 Mindline 备份。请选择导入远端数据，或用当前本地备份覆盖远端。',
    backupRemoteImport: '导入远端',
    backupRemoteOverwrite: '覆盖远端',
    trashEmpty: '回收站为空。',
    trashHelp: '删除的阶段和话题会先放到这里，可恢复后继续使用，或清空后永久移除。',
    clearTrash: '清空回收站',
    clearTrashConfirm: '清空回收站会永久移除其中的阶段和话题，确定继续吗？',
    clearTrashDialogTitle: '清空回收站？',
    confirmClearTrash: '确认清空',
    clearTrashUnavailable: '清空回收站能力尚未加载，请重启应用后再试。',
    restoreTopic: '恢复',
    restorePhase: '恢复阶段',
    result: '结果',
    welcome: '欢迎',
    createOrOpenWorkspace: '选择项目文件夹',
    openWorkspaceTitle: '打开工作区',
    openWorkspaceDescription: '选择一个项目文件夹，Mindline 会以这个目录作为思考工作区，管理阶段、话题和对话资料。',
    welcomeThoughtPrompt: '今天想沉淀哪条心线？',
    openFolder: '打开文件夹',
    recentWorkspaces: '最近工作区',
    noRecentWorkspaces: '暂无最近工作区',
    workspaceDataLocation: '数据位置',
    workspaceEmptyHelp: 'Mindline 会读取已有配置；没有配置时会在项目目录创建可见的 topics、phases 和内部 .mindline 元数据。',
    noWorkspaceSidebarTitle: '尚未打开工作区',
    noWorkspaceSidebarHelp: '打开一个项目文件夹后，阶段和话题会显示在这里。',
    settingsEyebrow: '设置',
    workspaceAndModels: '工作区与模型',
    workspacePath: '项目路径',
    dataPath: 'Mindline 数据路径',
    noWorkspaceOpen: '尚未打开工作区。请选择一个项目文件夹。',
    storage: '存储',
    storageValue: '阶段、话题、对话和总结保存在项目目录的 topics 与 phases；内部索引在 .mindline；模型设置和密钥保存在用户目录',
    activeModelAdapter: '当前模型适配器',
    noActiveModelProvider: '未配置真实模型',
    apiKeys: 'API 密钥',
    apiKeysValue: '保存在用户目录的 model-providers/secrets，真实调用时读取，不写入项目 Git',
    workspaceSetupHelp: '选择任意项目文件夹。Mindline 会在项目目录创建 topics 和 phases 保存阶段、话题、对话和总结。',
    modelAccess: '模型接入',
    modelAccessHelp: '本地工具通过命令或配置路径接入；云端模型通过 API Key 接入。供应商配置和密钥统一保存在用户目录的 model-providers 下，密钥不写入 Git。',
    addProvider: '添加供应商',
    providerName: '供应商名称',
    providerNamePlaceholder: '例如：MiniMax 团队账号',
    providerKind: '接入类型',
    localTool: '本地工具',
    cloudModel: '云端模型',
    providerPreset: '接入预设',
    command: '命令',
    commandPlaceholder: '例如：claude、codex、openclaw',
    configPath: '配置路径',
    configPathPlaceholder: '可选，例如 ~/.claude/settings.json',
    apiBaseUrl: 'API 地址',
    apiBaseUrlPlaceholder: '例如：https://api.example.com/v1',
    defaultModel: '默认模型',
    defaultModelPlaceholder: '例如：MiniMax-M2',
    apiProtocol: '接口协议',
    openAiChatProtocol: 'OpenAI Chat',
    anthropicMessagesProtocol: 'Anthropic Messages',
    apiKey: 'API Key',
    apiKeyPlaceholder: '只保存到本地 secrets',
    notes: '备注',
    providerNotesPlaceholder: '用途、账号归属或额度说明',
    activeProvider: '当前启用',
    setActive: '启用',
    deleteProvider: '删除',
    hasSecret: '已保存密钥',
    noSecret: '未保存密钥',
    noModelProviders: '还没有模型供应商。先添加 Claude Code、Codex、OpenClaw 或云端 API。',
    composerToolbar: '发送设置',
    model: '模型',
    preset: '预设',
    role: '角色',
    parameters: '参数',
    runtimeProfile: '运行画像',
    runtimeProfileTooltip: '角色画像',
    runtimeProfileHelp: '选择角色后自动匹配输出策略；补充内容会随本次 prompt 一起生效。',
    runtimeProfileInstruction: '画像设定内容',
    runtimeProfileInstructionPlaceholder: '例如：回答时先给结论，重点说明风险、边界和下一步...',
    runtimeProfileAutoStrategy: '自动策略',
    customRoleAutoHelp: '按角色名称自动推断策略，可继续补充要求',
    addCustomRole: '添加角色',
    saveCustomRole: '保存',
    resetProfileInstruction: '重置画像',
    temperature: '温度',
    maxOutput: '最大输出',
    tokensUnit: 'tokens',
    noConfiguredModels: '未配置模型',
    presetBalanced: '均衡',
    presetPrecise: '精确',
    presetCreative: '发散',
    presetLongform: '长文',
    presetCode: '代码',
    roleAssistant: '助手',
    roleProductManager: '产品经理',
    roleCEO: '首席执行官',
    roleCTO: '首席技术官',
    roleCOO: '首席运营官',
    roleCFO: '首席财务官',
    roleDeveloper: '程序开发者',
    roleDesigner: '设计师',
    roleCounselor: '心理咨询师',
    roleDataAnalyst: '数据分析师',
    roleTutor: '家庭教师',
    roleEngineer: '工程师',
    roleWriter: '写作者',
    roleAnalyst: '分析师',
    roleAssistantHelp: '日常问答、整理和直接协助',
    roleProductManagerHelp: '需求边界、优先级、风险和验收标准',
    roleCEOHelp: '战略方向、组织取舍、增长路径和关键决策',
    roleCTOHelp: '技术战略、架构边界、工程效能和长期风险',
    roleCOOHelp: '运营流程、资源配置、执行节奏和交付质量',
    roleCFOHelp: '现金流、预算、成本收益、财务风险和指标约束',
    roleDeveloperHelp: '实现方案、代码质量、测试和边界条件',
    roleDesignerHelp: '信息层级、交互成本、视觉一致性',
    roleCounselorHelp: '支持性表达、澄清问题和低风险建议',
    roleDataAnalystHelp: '数据口径、趋势洞察、异常识别和结论可信度',
    roleTutorHelp: '循序讲解、启发提问、示例练习和学习反馈',
    roleAssistantDefaultInstruction: '直接回答用户问题。先给结论，再补充必要背景、注意事项和下一步。保持清晰、克制，不无故扩展到无关方向。',
    roleProductManagerDefaultInstruction: '从目标用户、使用场景、需求边界和优先级出发。回答时明确问题定义、方案取舍、风险、验收标准和下一步决策。',
    roleCEODefaultInstruction: '以首席执行官视角回应。优先判断问题是否影响战略目标、市场定位、组织能力、增长路径和关键资源配置。回答时先给决策结论，再说明战略取舍、核心风险、关键指标和下一步负责人。',
    roleCTODefaultInstruction: '以首席技术官视角回应。关注技术战略、架构演进、系统边界、安全可靠性、工程效能、技术债和团队能力。回答时给出技术判断、长期影响、短期落地路径、风险控制和验证方式。',
    roleCOODefaultInstruction: '以首席运营官视角回应。关注流程效率、资源调度、跨团队协同、执行节奏、交付质量和运营指标。回答时明确当前瓶颈、优先动作、责任分工、节奏安排和可跟踪的运营指标。',
    roleCFODefaultInstruction: '以首席财务官视角回应。关注现金流、预算约束、成本结构、投入产出、财务风险、合规和可持续性。回答时量化关键假设，区分短期现金影响与长期价值，并给出风险边界和财务检查点。',
    roleDeveloperDefaultInstruction: '从实现路径、系统边界、代码质量和验证方式出发。回答时优先给出可执行方案，并说明边界条件、异常场景、测试步骤和潜在风险。',
    roleDesignerDefaultInstruction: '从用户任务、信息层级、交互成本和视觉一致性出发。回答时说明设计取舍、状态反馈、可访问性、响应式影响和可落地改法。',
    roleCounselorDefaultInstruction: '使用支持性、审慎、非评判的表达。优先倾听、澄清和给出低风险行动建议；不要诊断、开药或替代专业医疗意见。',
    roleDataAnalystDefaultInstruction: '先确认数据口径、样本范围和分析目标。回答时给出关键指标、趋势、异常点、可能原因、置信度限制和建议的下一步验证。',
    roleTutorDefaultInstruction: '像耐心的家庭教师一样循序讲解。先判断用户当前理解水平，再用简单例子解释，适当提问引导，并给出可练习的小任务。',
    customRoleDefaultInstruction: '以“{role}”的视角回应。优先体现该角色最关注的目标、判断标准、约束和下一步；如果角色含义不明确，保持通用助手风格。',
    customRole: '自定义角色',
    customRolePlaceholder: '输入自定义角色...',
    useCustomRole: '使用',
    deleteRole: '删除角色',
    presetBalancedHelp: '日常问答和整理',
    presetPreciseHelp: '低随机性，重事实',
    presetCreativeHelp: '更多方案和灵感',
    presetLongformHelp: '深度展开和总结',
    presetCodeHelp: '代码、调试和实现',
    runtimeProfileLine: '运行画像：{profile}',
    runSettingsLine: '运行：{preset}，温度 {temperature}，最大输出 {maxTokens} tokens。',
    modelProviderAdded: '模型供应商已添加',
    modelProviderDeleted: '模型供应商已删除',
    modelProviderActivated: '模型供应商已启用',
    language: '界面语言',
    theme: '全局主题',
    themeHelp: '主题会应用到侧边栏、对话、设置和上下文篮。',
    chinese: '中文',
    english: 'English',
    unavailableTitle: 'Mindline 需要在 Electron 中运行',
    unavailableHelp: '请用 npm run dev 启动桌面壳，以启用本地工作区能力。',
    viewCrashed: '当前视图遇到错误',
    retry: '重试',
    loadingWorkspace: '正在加载工作区',
    creatingWorkspace: '正在创建工作区',
    openingWorkspace: '正在打开工作区',
    creatingTopic: '正在创建话题',
    creatingPhase: '正在创建阶段',
    updatingWorkspace: '正在更新工作区',
    discussingSelection: '正在讨论已选内容',
    generationTitle: '模型正在处理',
    generationNote: '展示的是可公开的运行状态，不是模型隐藏思维链。',
    generationContext: '整理话题上下文',
    generationProvider: '连接当前模型',
    generationThinking: '等待模型生成',
    generationSaving: '保存回复到本地',
    summarizingTitle: '正在生成总结',
    summaryCollecting: '收集总结范围',
    summaryGenerating: '生成结构化总结',
    summarySaving: '写入 summary.md',
    summaryUpdated: '总结已更新',
    discussionWorkingTitle: '正在讨论上下文',
    discussionUpdated: '讨论结果已生成',
    discussionCollecting: '打包已选上下文',
    discussionGenerating: '生成讨论回复',
    discussionPresenting: '展示结果',
    processingSummary: '推理摘要 / 处理说明',
    summaryContextLine: '上下文：{userCount} 条用户消息，{assistantCount} 条真实助手回复。',
    summaryFilterLine: '过滤：已忽略 {mockCount} 条历史 Mock 回复。',
    summaryProviderLine: '模型：{provider}，协议：{protocol}。',
    summaryStorageLine: '落盘：回复会保存到当前话题的 Markdown 文件。',
    summarySaveLine: '落盘：总结会写入当前目标的 summary.md。',
    topicSummaryScopeLine: '范围：当前话题共 {messageCount} 条消息，其中 {mockCount} 条历史 Mock 不进入模型上下文。',
    phaseSummaryScopeLine: '范围：当前阶段共 {topicCount} 个话题，只聚合阶段内内容。',
    discussionScopeLine: '范围：已选择 {itemCount} 项上下文，按加入顺序打包。',
    discussionPromptLine: '提问：{prompt}',
    discussionResultLine: '输出：结果展示在右侧结果区，不写入话题消息。',
    pendingUser: '你',
    userRole: '用户',
    assistantRole: '助手',
    topic: '话题',
    assignPhase: '指定阶段',
    moveTopicToPhase: '移动到阶段',
    rename: '重命名',
    manageTopic: '管理话题',
    moveTopicToTrash: '移到回收站',
    addTopic: '加入上下文',
    addPhase: '加入上下文',
    summarize: '总结',
    moreActions: '更多操作',
    topicSummary: '话题总结',
    add: '加入',
    noSummaryYet: '暂无总结。',
    topicMessages: '话题消息',
    startTopic: '用一个聚焦的问题开始这个话题。',
    promptPlaceholder: '为这个话题输入提示词...',
    attachImage: '添加图片',
    attachText: '发送文本',
    insertCartContext: '插入资料篮上下文',
    insertedContext: '已插入上下文',
    removeContext: '移除上下文',
    removeAttachment: '移除附件',
    attachments: '附件',
    imageAttachment: '图片附件',
    textAttachment: '文本附件',
    imageCountLabel: '{count} 张图片',
    attachmentCountLabel: '{count} 个附件',
    insertedContextCountLabel: '{count} 项上下文',
    composerDropHint: '松开以添加文件',
    localToolImageUnsupported: '当前本地工具不支持图片发送，请切换到云端模型。',
    imageReadFailed: '图片读取失败，请重新选择。',
    textFileReadFailed: '文本文件读取失败，请重新选择。',
    textFileUnsupported: '仅支持 UTF-8 文本、Markdown、CSV、JSON、YAML、XML、HTML、日志和代码文件；暂不支持 PDF、Office 或密钥配置文件。',
    textFileTooLarge: '单个文本文件不能超过 256KB。',
    textFileTotalTooLarge: '单次发送的文本文件总大小不能超过 512KB。',
    textFileCountLimit: '一次最多发送 6 个文本文件。',
    exportCurrentTopic: '导出当前话题 Markdown',
    send: '发送',
    stopGeneration: '停止生成',
    streamingReply: '正在输出回复',
    exportMarkdown: '导出 Markdown',
    exportedMarkdown: '已导出 Markdown',
    addMessageToCart: '加入上下文',
    copyMessage: '复制消息',
    copiedMessage: '已复制',
    copyCode: '复制代码',
    copiedCode: '已复制代码',
    copySummary: '复制总结',
    copiedSummary: '已复制总结',
    copyDiscussionResult: '复制结果',
    copiedDiscussionResult: '已复制结果',
    addSummaryToCart: '加入上下文',
    expandSummary: '展开总结',
    collapseSummary: '收起总结',
    phase: '阶段',
    managePhase: '管理阶段',
    reorderPhase: '拖拽调整顺序',
    phaseDetails: '阶段详情',
    changePhaseIcon: '更换阶段图标',
    defaultPhaseIcon: '默认图标',
    expandPhase: '展开阶段',
    collapsePhase: '收起阶段',
    reactivatePhase: '重新激活',
    deletePhase: '删除',
    archivePhase: '删除',
    phaseArchived: '阶段已归档',
    topicCountLabel: '{count} 个话题',
    created: '创建于',
    ended: '已结束',
    started: '开始于',
    end: '结束',
    phaseSummary: '阶段总结',
    noPhaseSummaryYet: '暂无阶段总结。',
    noTopicsAssigned: '这个阶段还没有归入任何话题。',
    messages: '条消息',
    removeSelectedItem: '移出上下文',
    errorNotWorkspace: '无法打开这个目录。请选择一个可访问的项目文件夹，Mindline 会自动创建自己的配置。',
    errorAlreadyWorkspace: '这个文件夹已经是 Mindline 工作区。请直接选择它打开。'
  },
  en: {
    appName: 'Mindline',
    brandMark: 'M',
    brandSubtitle: 'Multi-topic AI thought workspace',
    workspace: 'Workspace',
    navigation: 'Navigation',
    workspaceOverview: 'Overview',
    workspaceOverviewHelp: 'Review phases, topics, and recent updates in this workspace. Select a phase or topic from the sidebar to open its detail view.',
    workspaceOverviewEmpty: 'No phases or topics yet. Create a phase or topic to start organizing this line of thought.',
    workspaceStats: 'Workspace status',
    quickStart: 'Quick start',
    recentTopics: 'Recent topics',
    phaseDirectory: 'Phase directory',
    totalMessages: 'Total messages',
    summarizedPhases: 'Summarized phases',
    unsortedTopics: 'Default phase topics',
    openTopic: 'Open topic',
    openPhase: 'Open phase',
    currentWorkspace: 'Current workspace',
    switchWorkspace: 'Open another',
    createNewWorkspace: 'New',
    openOrCreateWorkspace: 'Open or create',
    workspacePlaceholder: '/path/to/workspace',
    pickWorkspace: 'Pick workspace directory',
    selectWorkspace: 'Select workspace',
    create: 'Create',
    cancel: 'Cancel',
    open: 'Open',
    workspaceHint: 'Choose any project folder. Mindline will open or initialize its config automatically.',
    searchConversation: 'Search topics, phases, messages...',
    searchSettings: 'Search settings...',
    searchOpen: 'Open search',
    searchDialogTitle: 'Search',
    searchDialogHelp: 'Find phases, topics, messages, and summaries in the current workspace.',
    searchScope: 'Scope',
    searchScopeAll: 'All content',
    searchStartTitle: 'Start searching',
    searchStartHelp: 'Type a keyword, or continue from recent topics.',
    searchResults: 'Search results',
    searchRecent: 'Recent topics',
    searchFilterAll: 'All',
    searchFilterSummary: 'Summaries',
    searchNoResults: 'No matching results',
    searchResultPhase: 'Phase',
    searchResultTopic: 'Topic',
    searchResultMessage: 'Message',
    searchResultTopicSummary: 'Topic summary',
    searchResultPhaseSummary: 'Phase summary',
    noFolderSelected: 'No folder selected.',
    phases: 'Phases',
    phasesOverview: 'Phase Overview',
    phasesOverviewHelp: 'Review phases by status, open a phase, or create a new topic inside a phase.',
    phasesOverviewEmpty: 'No phases yet. Create a phase to group related topics.',
    activePhases: 'Active phases',
    endedPhases: 'Ended phases',
    phasesWithoutTopics: 'Empty phases',
    noPhases: 'No phases',
    newPhase: 'New phase',
    refreshPhaseDirectory: 'Refresh phase directory',
    collapsePhaseDirectory: 'Collapse all',
    phaseNameOptional: 'Phase name, optional',
    phaseNamePlaceholder: 'Enter phase name',
    topics: 'Topics',
    noTopics: 'No topics',
    newTopic: 'New topic',
    topicNameOptional: 'Topic name, optional',
    topicNamePlaceholder: 'Enter topic name',
    noPhase: 'Default phase',
    searchPhases: 'Search phases...',
    noMatchingPhases: 'No matching phases',
    settings: 'Settings',
    selection: 'Context',
    cart: 'Context Basket',
    openCart: 'Open context basket',
    openCartWithCount: 'Open context basket, {count} item(s)',
    closeCart: 'Collapse context basket',
    clearCart: 'Clear context basket',
    cartItemCount: '{count} item(s)',
    cartCollapsedHint: 'Selected context',
    cartEmpty: 'Select messages, topics, or summaries as context for the next discussion.',
    discussSelection: 'Discuss context',
    selectionPrompt: 'Ask a follow-up using this context...',
    discuss: 'Discuss',
    trash: 'Trash',
    backup: 'Backups',
    backupTimeline: 'Git backup timeline',
    backupHelp: 'Mindline only backs up .mindline, topics, and phases. Project code and model secrets are not managed.',
    backupStatus: 'Backup status',
    backupReady: 'Enabled',
    backupUnavailable: 'Unavailable',
    backupGitUnavailable: 'System Git was not found. Install Git to enable local backups.',
    backupClean: 'No unbacked changes',
    backupHasChanges: 'Unbacked changes',
    backupLastBackup: 'Latest backup',
    backupPath: 'Backup repository',
    backupCreate: 'Back up now',
    backupRefresh: 'Refresh',
    backupRestore: 'Restore',
    backupCurrent: 'Current',
    backupFilesChanged: '{count} file(s)',
    backupNoCommits: 'No backup records yet. Opening this page or writing data creates the first backup.',
    backupRestoreConfirmTitle: 'Restore this backup?',
    backupRestoreConfirm: 'Restoring replaces Mindline data with the selected backup point. A pre-restore backup is created first.',
    backupRestoreSafety: 'Only .mindline, topics, and phases are affected. Project code, user .git, and model secrets are untouched.',
    backupRestored: 'Backup restored',
    backupManualCreated: 'Backup created',
    backupRemote: 'Remote sync',
    backupRemoteConnected: 'Remote repository connected',
    backupRemoteNotConnected: 'No remote',
    backupRemoteEmptyHelp: 'Connect an existing GitHub, GitLab, or private Git repository to sync backups across devices.',
    backupRemoteConnect: 'Connect remote repository',
    backupRemoteReconnect: 'Reconnect',
    backupRemoteConnectHelp: 'Use a dedicated empty repository or an existing Mindline backup repository. Mindline does not create repositories or write project code.',
    backupRemoteProvider: 'Provider',
    backupRemoteGeneric: 'Generic Git',
    backupRemoteUrl: 'Repository URL',
    backupRemoteBranch: 'Branch',
    backupRemoteAuth: 'Authentication',
    backupRemoteSystemAuth: 'System Git / SSH',
    backupRemotePatAuth: 'Access token',
    backupRemoteUsername: 'Username',
    backupRemoteToken: 'Personal Access Token',
    backupRemoteTokenPlaceholder: 'Stored only in local user secrets',
    backupRemoteSshHelp: 'SSH mode reuses ssh-agent, ~/.ssh/config, 1Password Agent, or Git Credential Manager. Private keys are not stored.',
    backupRemoteGithubScope: 'For GitHub fine-grained PATs, grant only Contents: Read and write on the target repository.',
    backupRemoteGitlabScope: 'For GitLab PATs, grant write_repository. For self-managed GitLab, paste the instance repository URL.',
    backupRemoteGenericScope: 'Generic Git repositories must allow the current credentials to read and write the target branch.',
    backupRemoteTest: 'Test connection',
    backupRemoteTestOk: 'Remote connection is available.',
    backupRemoteSave: 'Save and connect',
    backupRemoteSync: 'Sync remote',
    backupRemoteClear: 'Disconnect',
    backupRemoteClearConfirm: 'Disconnecting removes only local remote config and token. Local and remote backups are not deleted. Continue?',
    backupRemoteResolve: 'Resolve conflict',
    backupRemoteNeedsAction: 'Needs action',
    backupRemoteSynced: 'Synced',
    backupRemoteAhead: 'Local ahead {count}',
    backupRemoteBehind: 'Remote ahead {count}',
    backupRemoteSetupTitle: 'Choose remote setup mode',
    backupRemoteSetupHelp: 'The remote branch already contains a Mindline backup. Import remote data, or overwrite the remote with the current local backup.',
    backupRemoteImport: 'Import remote',
    backupRemoteOverwrite: 'Overwrite remote',
    trashEmpty: 'Trash is empty.',
    trashHelp: 'Deleted phases and topics are kept here first. Restore them later, or empty trash to remove them permanently.',
    clearTrash: 'Empty trash',
    clearTrashConfirm: 'Emptying trash permanently removes these phases and topics. Continue?',
    clearTrashDialogTitle: 'Empty trash?',
    confirmClearTrash: 'Empty trash',
    clearTrashUnavailable: 'Empty trash is not loaded yet. Restart the app and try again.',
    restoreTopic: 'Restore',
    restorePhase: 'Restore phase',
    result: 'Result',
    welcome: 'Welcome',
    createOrOpenWorkspace: 'Select a project folder',
    openWorkspaceTitle: 'Open workspace',
    openWorkspaceDescription: 'Choose a project folder and Mindline will use it as the workspace for phases, topics, and conversation context.',
    welcomeThoughtPrompt: 'What line of thought is worth capturing today?',
    openFolder: 'Open folder',
    recentWorkspaces: 'Recent workspaces',
    noRecentWorkspaces: 'No recent workspaces',
    workspaceDataLocation: 'Data location',
    workspaceEmptyHelp: 'Mindline reads existing config or creates visible topics and phases folders plus internal .mindline metadata inside the project.',
    noWorkspaceSidebarTitle: 'No workspace open',
    noWorkspaceSidebarHelp: 'Open a project folder to show phases and topics here.',
    settingsEyebrow: 'Settings',
    workspaceAndModels: 'Workspace & Models',
    workspacePath: 'Project path',
    dataPath: 'Mindline data path',
    noWorkspaceOpen: 'No workspace open. Choose a project folder.',
    storage: 'Storage',
    storageValue: 'Phases, topics, chats, and summaries live in project topics and phases folders; internal indexes live in .mindline; model settings and secrets live in your user directory',
    activeModelAdapter: 'Active model adapter',
    noActiveModelProvider: 'No real model configured',
    apiKeys: 'API keys',
    apiKeysValue: 'Stored under the user directory in model-providers/secrets, read only at runtime, and never committed to the project Git',
    workspaceSetupHelp: 'Choose any project folder. Mindline will create topics and phases folders there for phases, topics, chats, and summaries.',
    modelAccess: 'Model Access',
    modelAccessHelp: 'Local tools connect through commands or config paths. Cloud models connect with API keys. Provider config and secrets are grouped under the user directory model-providers folder, and secrets are not committed to Git.',
    addProvider: 'Add Provider',
    providerName: 'Provider name',
    providerNamePlaceholder: 'e.g., MiniMax team account',
    providerKind: 'Access type',
    localTool: 'Local tool',
    cloudModel: 'Cloud model',
    providerPreset: 'Preset',
    command: 'Command',
    commandPlaceholder: 'e.g., claude, codex, openclaw',
    configPath: 'Config path',
    configPathPlaceholder: 'Optional, e.g., ~/.claude/settings.json',
    apiBaseUrl: 'API base URL',
    apiBaseUrlPlaceholder: 'e.g., https://api.example.com/v1',
    defaultModel: 'Default model',
    defaultModelPlaceholder: 'e.g., MiniMax-M2',
    apiProtocol: 'API protocol',
    openAiChatProtocol: 'OpenAI Chat',
    anthropicMessagesProtocol: 'Anthropic Messages',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'Stored only in local secrets',
    notes: 'Notes',
    providerNotesPlaceholder: 'Purpose, account owner, or quota notes',
    activeProvider: 'Active',
    setActive: 'Activate',
    deleteProvider: 'Delete',
    hasSecret: 'Secret saved',
    noSecret: 'No secret',
    noModelProviders: 'No model providers yet. Add Claude Code, Codex, OpenClaw, or a cloud API.',
    composerToolbar: 'Run settings',
    model: 'Model',
    preset: 'Preset',
    role: 'Role',
    parameters: 'Parameters',
    runtimeProfile: 'Runtime profile',
    runtimeProfileTooltip: 'Runtime profile',
    runtimeProfileHelp: 'Pick a role to auto-match the output strategy. Notes are merged into this prompt.',
    runtimeProfileInstruction: 'Profile notes',
    runtimeProfileInstructionPlaceholder: 'e.g. Start with the conclusion, then focus on risks, boundaries, and next steps...',
    runtimeProfileAutoStrategy: 'Auto strategy',
    customRoleAutoHelp: 'Strategy is inferred from the role name; add notes as needed',
    addCustomRole: 'Add role',
    saveCustomRole: 'Save',
    resetProfileInstruction: 'Reset notes',
    temperature: 'Temperature',
    maxOutput: 'Max output',
    tokensUnit: 'tokens',
    noConfiguredModels: 'No configured models',
    presetBalanced: 'Balanced',
    presetPrecise: 'Precise',
    presetCreative: 'Creative',
    presetLongform: 'Long-form',
    presetCode: 'Code',
    roleAssistant: 'Assistant',
    roleProductManager: 'Product Manager',
    roleCEO: 'Chief Executive Officer',
    roleCTO: 'Chief Technology Officer',
    roleCOO: 'Chief Operating Officer',
    roleCFO: 'Chief Financial Officer',
    roleDeveloper: 'Developer',
    roleDesigner: 'Designer',
    roleCounselor: 'Counselor',
    roleDataAnalyst: 'Data Analyst',
    roleTutor: 'Tutor',
    roleEngineer: 'Engineer',
    roleWriter: 'Writer',
    roleAnalyst: 'Analyst',
    roleAssistantHelp: 'General Q&A, organization, and direct help',
    roleProductManagerHelp: 'Scope, priority, risks, and acceptance criteria',
    roleCEOHelp: 'Strategy, organization tradeoffs, growth path, and key decisions',
    roleCTOHelp: 'Technology strategy, architecture boundaries, engineering velocity, and long-term risk',
    roleCOOHelp: 'Operations, resource allocation, execution cadence, and delivery quality',
    roleCFOHelp: 'Cash flow, budget, cost-benefit, financial risk, and metric constraints',
    roleDeveloperHelp: 'Implementation, code quality, tests, and edge cases',
    roleDesignerHelp: 'Information hierarchy, interaction cost, visual consistency',
    roleCounselorHelp: 'Supportive wording, clarification, and low-risk next steps',
    roleDataAnalystHelp: 'Data definitions, trends, anomalies, and confidence',
    roleTutorHelp: 'Step-by-step explanation, guided questions, practice, and feedback',
    roleAssistantDefaultInstruction: 'Answer directly. Start with the conclusion, then add necessary context, caveats, and next steps. Stay clear and focused.',
    roleProductManagerDefaultInstruction: 'Start from target users, scenarios, scope, and priority. Clarify the problem, tradeoffs, risks, acceptance criteria, and next decisions.',
    roleCEODefaultInstruction: 'Respond from a Chief Executive Officer perspective. Prioritize strategic goals, market positioning, organizational capability, growth path, and key resource allocation. Start with the decision, then explain tradeoffs, major risks, key metrics, and accountable next steps.',
    roleCTODefaultInstruction: 'Respond from a Chief Technology Officer perspective. Focus on technology strategy, architecture evolution, system boundaries, security, reliability, engineering effectiveness, technical debt, and team capability. Provide technical judgment, long-term impact, short-term execution path, risk controls, and validation steps.',
    roleCOODefaultInstruction: 'Respond from a Chief Operating Officer perspective. Focus on process efficiency, resource coordination, cross-functional execution, operating cadence, delivery quality, and operating metrics. Identify bottlenecks, priority actions, owners, cadence, and measurable operating indicators.',
    roleCFODefaultInstruction: 'Respond from a Chief Financial Officer perspective. Focus on cash flow, budget constraints, cost structure, return on investment, financial risk, compliance, and sustainability. Quantify key assumptions, separate short-term cash impact from long-term value, and provide risk boundaries and financial checkpoints.',
    roleDeveloperDefaultInstruction: 'Start from implementation path, system boundaries, code quality, and verification. Give actionable technical steps, edge cases, tests, and risks.',
    roleDesignerDefaultInstruction: 'Start from user tasks, information hierarchy, interaction cost, and visual consistency. Explain design tradeoffs, states, accessibility, responsiveness, and concrete changes.',
    roleCounselorDefaultInstruction: 'Use supportive, careful, non-judgmental wording. Listen, clarify, and suggest low-risk next steps; do not diagnose, prescribe, or replace professional care.',
    roleDataAnalystDefaultInstruction: 'Clarify data definitions, sample scope, and analysis goal first. Provide key metrics, trends, anomalies, likely causes, confidence limits, and validation steps.',
    roleTutorDefaultInstruction: 'Explain like a patient tutor. Assess the learner’s current level, use simple examples, ask guiding questions when useful, and provide a small practice task.',
    customRoleDefaultInstruction: 'Respond from the perspective of “{role}”. Emphasize that role’s goals, judgment criteria, constraints, and next steps; if ambiguous, stay in general assistant mode.',
    customRole: 'Custom role',
    customRolePlaceholder: 'Enter a custom role...',
    useCustomRole: 'Use',
    deleteRole: 'Delete role',
    presetBalancedHelp: 'General Q&A and organization',
    presetPreciseHelp: 'Low randomness, fact-oriented',
    presetCreativeHelp: 'More options and ideas',
    presetLongformHelp: 'Deep expansion and summaries',
    presetCodeHelp: 'Code, debugging, implementation',
    runtimeProfileLine: 'Runtime profile: {profile}',
    runSettingsLine: 'Run: {preset}, temperature {temperature}, max output {maxTokens} tokens.',
    modelProviderAdded: 'Model provider added',
    modelProviderDeleted: 'Model provider deleted',
    modelProviderActivated: 'Model provider activated',
    language: 'Interface language',
    theme: 'Global theme',
    themeHelp: 'Theme applies to the sidebar, conversations, settings, and context basket.',
    chinese: '中文',
    english: 'English',
    unavailableTitle: 'Mindline runs in Electron',
    unavailableHelp: 'Start the desktop shell with npm run dev so the local workspace bridge is available.',
    viewCrashed: 'This view hit an error',
    retry: 'Retry',
    loadingWorkspace: 'Loading workspace',
    creatingWorkspace: 'Creating workspace',
    openingWorkspace: 'Opening workspace',
    creatingTopic: 'Creating topic',
    creatingPhase: 'Creating phase',
    updatingWorkspace: 'Updating workspace',
    discussingSelection: 'Discussing selection',
    generationTitle: 'Model is working',
    generationNote: 'These are visible runtime states, not hidden chain-of-thought.',
    generationContext: 'Preparing topic context',
    generationProvider: 'Connecting active model',
    generationThinking: 'Waiting for generation',
    generationSaving: 'Saving local reply',
    summarizingTitle: 'Generating summary',
    summaryCollecting: 'Collecting summary scope',
    summaryGenerating: 'Generating structured summary',
    summarySaving: 'Writing summary.md',
    summaryUpdated: 'Summary updated',
    discussionWorkingTitle: 'Discussing context',
    discussionUpdated: 'Discussion result ready',
    discussionCollecting: 'Packing selected context',
    discussionGenerating: 'Generating discussion reply',
    discussionPresenting: 'Presenting result',
    processingSummary: 'Reasoning summary / Processing notes',
    summaryContextLine: 'Context: {userCount} user message(s), {assistantCount} real assistant reply/replies.',
    summaryFilterLine: 'Filtering: ignored {mockCount} legacy Mock reply/replies.',
    summaryProviderLine: 'Model: {provider}, protocol: {protocol}.',
    summaryStorageLine: 'Storage: reply will be saved to this topic Markdown file.',
    summarySaveLine: 'Storage: summary will be written to this target summary.md.',
    topicSummaryScopeLine: 'Scope: this topic has {messageCount} message(s); {mockCount} legacy Mock reply/replies are excluded from model context.',
    phaseSummaryScopeLine: 'Scope: this phase has {topicCount} topic(s), using only content inside the phase.',
    discussionScopeLine: 'Scope: {itemCount} selected context item(s), packed in selection order.',
    discussionPromptLine: 'Prompt: {prompt}',
    discussionResultLine: 'Output: result appears in the right panel and is not written to topic messages.',
    pendingUser: 'You',
    userRole: 'User',
    assistantRole: 'Assistant',
    topic: 'Topic',
    assignPhase: 'Assign phase',
    moveTopicToPhase: 'Move to phase',
    rename: 'Rename',
    manageTopic: 'Manage topic',
    moveTopicToTrash: 'Move to trash',
    addTopic: 'Add context',
    addPhase: 'Add context',
    summarize: 'Summarize',
    moreActions: 'More actions',
    topicSummary: 'Topic Summary',
    add: 'Add',
    noSummaryYet: 'No summary yet.',
    topicMessages: 'Topic messages',
    startTopic: 'Start this topic with a focused prompt.',
    promptPlaceholder: 'Write a prompt for this topic...',
    attachImage: 'Attach image',
    attachText: 'Send text',
    insertCartContext: 'Insert context basket',
    insertedContext: 'Inserted context',
    removeContext: 'Remove context',
    removeAttachment: 'Remove attachment',
    attachments: 'Attachments',
    imageAttachment: 'Image attachment',
    textAttachment: 'Text attachment',
    imageCountLabel: '{count} image(s)',
    attachmentCountLabel: '{count} attachment(s)',
    insertedContextCountLabel: '{count} context item(s)',
    composerDropHint: 'Drop to attach files',
    localToolImageUnsupported: 'The selected local tool cannot send images. Switch to a cloud model.',
    imageReadFailed: 'Could not read the image. Try selecting it again.',
    textFileReadFailed: 'Could not read the text file. Try selecting it again.',
    textFileUnsupported: 'Only UTF-8 text, Markdown, CSV, JSON, YAML, XML, HTML, logs, and code files are supported. PDF, Office, and secret config files are not supported.',
    textFileTooLarge: 'Each text file must be 256KB or smaller.',
    textFileTotalTooLarge: 'Text files can total up to 512KB per send.',
    textFileCountLimit: 'You can send up to 6 text files at once.',
    exportCurrentTopic: 'Export current topic Markdown',
    send: 'Send',
    stopGeneration: 'Stop generation',
    streamingReply: 'Streaming reply',
    exportMarkdown: 'Export Markdown',
    exportedMarkdown: 'Markdown exported',
    addMessageToCart: 'Add to context',
    copyMessage: 'Copy message',
    copiedMessage: 'Copied',
    copyCode: 'Copy code',
    copiedCode: 'Code copied',
    copySummary: 'Copy summary',
    copiedSummary: 'Summary copied',
    copyDiscussionResult: 'Copy result',
    copiedDiscussionResult: 'Result copied',
    addSummaryToCart: 'Add to context',
    expandSummary: 'Expand summary',
    collapseSummary: 'Collapse summary',
    phase: 'Phase',
    managePhase: 'Manage phase',
    reorderPhase: 'Drag to reorder',
    phaseDetails: 'Phase details',
    changePhaseIcon: 'Change phase icon',
    defaultPhaseIcon: 'Default icon',
    expandPhase: 'Expand phase',
    collapsePhase: 'Collapse phase',
    reactivatePhase: 'Reactivate',
    deletePhase: 'Delete',
    archivePhase: 'Delete',
    phaseArchived: 'Phase archived',
    topicCountLabel: '{count} topic(s)',
    created: 'Created',
    ended: 'Ended',
    started: 'Started',
    end: 'End',
    phaseSummary: 'Phase Summary',
    noPhaseSummaryYet: 'No phase summary yet.',
    noTopicsAssigned: 'No topics are assigned to this phase.',
    messages: 'messages',
    removeSelectedItem: 'Remove from context',
    errorNotWorkspace: 'Cannot open this folder. Choose an accessible project folder and Mindline will create its own config.',
    errorAlreadyWorkspace: 'This folder already contains a Mindline workspace. Select it directly to open.'
  }
} as const;

export type Copy = Record<keyof (typeof copy)['zh'], string>;

export const modelPresetOptions: Array<{ id: ModelPresetId; labelKey: keyof Copy; helpKey: keyof Copy; temperature: number; maxTokens: number }> = [
  { id: 'balanced', labelKey: 'presetBalanced', helpKey: 'presetBalancedHelp', temperature: 0.3, maxTokens: 4096 },
  { id: 'precise', labelKey: 'presetPrecise', helpKey: 'presetPreciseHelp', temperature: 0.1, maxTokens: 2048 },
  { id: 'creative', labelKey: 'presetCreative', helpKey: 'presetCreativeHelp', temperature: 0.8, maxTokens: 4096 },
  { id: 'longform', labelKey: 'presetLongform', helpKey: 'presetLongformHelp', temperature: 0.4, maxTokens: 8192 },
  { id: 'code', labelKey: 'presetCode', helpKey: 'presetCodeHelp', temperature: 0.2, maxTokens: 8192 }
];

export const rolePresetOptions: Array<{ labelKey: keyof Copy; helpKey: keyof Copy; profileInstructionKey: keyof Copy; presetId: ModelPresetId; temperature: number; maxTokens: number }> = [
  { labelKey: 'roleAssistant', helpKey: 'roleAssistantHelp', profileInstructionKey: 'roleAssistantDefaultInstruction', presetId: 'balanced', temperature: 0.3, maxTokens: 4096 },
  { labelKey: 'roleProductManager', helpKey: 'roleProductManagerHelp', profileInstructionKey: 'roleProductManagerDefaultInstruction', presetId: 'precise', temperature: 0.2, maxTokens: 4096 },
  { labelKey: 'roleCEO', helpKey: 'roleCEOHelp', profileInstructionKey: 'roleCEODefaultInstruction', presetId: 'precise', temperature: 0.2, maxTokens: 4096 },
  { labelKey: 'roleCTO', helpKey: 'roleCTOHelp', profileInstructionKey: 'roleCTODefaultInstruction', presetId: 'precise', temperature: 0.2, maxTokens: 8192 },
  { labelKey: 'roleCOO', helpKey: 'roleCOOHelp', profileInstructionKey: 'roleCOODefaultInstruction', presetId: 'precise', temperature: 0.2, maxTokens: 4096 },
  { labelKey: 'roleCFO', helpKey: 'roleCFOHelp', profileInstructionKey: 'roleCFODefaultInstruction', presetId: 'precise', temperature: 0.1, maxTokens: 4096 },
  { labelKey: 'roleDeveloper', helpKey: 'roleDeveloperHelp', profileInstructionKey: 'roleDeveloperDefaultInstruction', presetId: 'code', temperature: 0.2, maxTokens: 8192 },
  { labelKey: 'roleDesigner', helpKey: 'roleDesignerHelp', profileInstructionKey: 'roleDesignerDefaultInstruction', presetId: 'creative', temperature: 0.6, maxTokens: 4096 },
  { labelKey: 'roleCounselor', helpKey: 'roleCounselorHelp', profileInstructionKey: 'roleCounselorDefaultInstruction', presetId: 'balanced', temperature: 0.3, maxTokens: 4096 },
  { labelKey: 'roleDataAnalyst', helpKey: 'roleDataAnalystHelp', profileInstructionKey: 'roleDataAnalystDefaultInstruction', presetId: 'precise', temperature: 0.1, maxTokens: 8192 },
  { labelKey: 'roleTutor', helpKey: 'roleTutorHelp', profileInstructionKey: 'roleTutorDefaultInstruction', presetId: 'balanced', temperature: 0.3, maxTokens: 4096 }
];

export const themeOptions: Array<{ id: ThemeId; label: Record<Language, string>; description: Record<Language, string>; swatches: string[] }> = [
  {
    id: 'sage',
    label: { zh: '心线绿', en: 'Mindline Green' },
    description: { zh: '默认，安静的本地工作区质感', en: 'Default calm local workspace' },
    swatches: ['#2f6f64', '#f7f7f4', '#20201d']
  },
  {
    id: 'graphite',
    label: { zh: '石墨', en: 'Graphite' },
    description: { zh: '低亮度，适合长时间阅读', en: 'Low-light reading mode' },
    swatches: ['#7bb8a6', '#171a17', '#f3f1e8']
  },
  {
    id: 'ocean',
    label: { zh: '海湾', en: 'Ocean' },
    description: { zh: '清爽冷色，突出结构信息', en: 'Cool tone for structured work' },
    swatches: ['#236c89', '#eef6f7', '#182328']
  },
  {
    id: 'paper',
    label: { zh: '纸本', en: 'Paper' },
    description: { zh: '偏文档阅读和复盘', en: 'Document-like review mode' },
    swatches: ['#7a5a2f', '#faf7ef', '#24211b']
  },
  {
    id: 'rose',
    label: { zh: '胭脂', en: 'Rose' },
    description: { zh: '更柔和的创作和整理氛围', en: 'Softer writing and organizing tone' },
    swatches: ['#9a4d62', '#fbf5f6', '#261e21']
  },
  {
    id: 'aurora',
    label: { zh: '极光', en: 'Aurora' },
    description: { zh: '冷静深色与冰蓝强调', en: 'Dark focus palette with ice-blue accents' },
    swatches: ['#88c0d0', '#2e3440', '#eceff4']
  },
  {
    id: 'latte',
    label: { zh: '拿铁', en: 'Latte' },
    description: { zh: '柔和低压的浅色界面', en: 'Soft, low-pressure light mode' },
    swatches: ['#179299', '#eff1f5', '#4c4f69']
  },
  {
    id: 'solar',
    label: { zh: '日晷', en: 'Solar' },
    description: { zh: '低眩光阅读和代码氛围', en: 'Low-glare reading and coding tone' },
    swatches: ['#268bd2', '#fdf6e3', '#586e75']
  }
];

export function getApi() {
  return window.groupAI;
}

export function newRequestId(): Id {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function initialLanguage(): Language {
  return window.localStorage.getItem('mindline.language') === 'en' || window.localStorage.getItem('groupai.language') === 'en' ? 'en' : 'zh';
}

export function initialTheme(): ThemeId {
  const stored = window.localStorage.getItem('mindline.theme');
  return themeOptions.some((theme) => theme.id === stored) ? (stored as ThemeId) : 'sage';
}

export function initialComposerSettings(): ComposerSettings {
  const fallback: ComposerSettings = { providerId: '', presetId: 'balanced', roleInstruction: copy[initialLanguage()].roleAssistant, profileInstruction: '', profileInstructionsByRole: {}, temperature: 0.3, maxTokens: 4096 };
  const stored = window.localStorage.getItem('mindline.composerSettings');
  if (!stored) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<ComposerSettings>;
    const preset = modelPresetOptions.find((entry) => entry.id === parsed.presetId);
    const roleInstruction = typeof parsed.roleInstruction === 'string' && parsed.roleInstruction.trim() ? parsed.roleInstruction.trim() : fallback.roleInstruction;
    const profileInstruction = typeof parsed.profileInstruction === 'string' ? parsed.profileInstruction.trim() : '';
    const profileInstructionsByRole =
      parsed.profileInstructionsByRole && typeof parsed.profileInstructionsByRole === 'object' && !Array.isArray(parsed.profileInstructionsByRole)
        ? Object.fromEntries(
            Object.entries(parsed.profileInstructionsByRole)
              .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
              .map(([role, instruction]) => [role.trim(), instruction.trim()])
              .filter(([role]) => Boolean(role))
          )
        : {};
    if (profileInstruction && !profileInstructionsByRole[roleInstruction]) {
      profileInstructionsByRole[roleInstruction] = profileInstruction;
    }
    return {
      providerId: typeof parsed.providerId === 'string' ? parsed.providerId : '',
      presetId: preset?.id ?? fallback.presetId,
      roleInstruction,
      profileInstruction: profileInstructionsByRole[roleInstruction] ?? profileInstruction,
      profileInstructionsByRole,
      temperature: typeof parsed.temperature === 'number' ? Math.min(2, Math.max(0, parsed.temperature)) : fallback.temperature,
      maxTokens: typeof parsed.maxTokens === 'number' ? Math.min(32_000, Math.max(256, Math.round(parsed.maxTokens))) : fallback.maxTokens
    };
  } catch {
    return fallback;
  }
}

export function readCustomRoles(): string[] {
  const stored = window.localStorage.getItem('mindline.customRoles');
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const roles: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'string') {
        continue;
      }
      const role = entry.trim();
      if (role && !roles.some((item) => item.toLowerCase() === role.toLowerCase())) {
        roles.push(role);
      }
    }
    return roles;
  } catch {
    return [];
  }
}

export function writeCustomRoles(roles: string[]) {
  const cleaned: string[] = [];
  for (const entry of roles) {
    const role = entry.trim();
    if (role && !cleaned.some((item) => item.toLowerCase() === role.toLowerCase())) {
      cleaned.push(role);
    }
  }
  window.localStorage.setItem('mindline.customRoles', JSON.stringify(cleaned));
}

export function initialKeyboardSettings(): KeyboardSettings {
  const fallback: KeyboardSettings = { enterToSend: true };
  const stored = window.localStorage.getItem('mindline.keyboardSettings');
  if (!stored) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<KeyboardSettings>;
    return {
      enterToSend: typeof parsed.enterToSend === 'boolean' ? parsed.enterToSend : fallback.enterToSend
    };
  } catch {
    return fallback;
  }
}

export function defaultPhaseTitle(manifest: WorkspaceManifest, t: Copy): string {
  return manifest.defaultPhase?.title?.trim() || t.noPhase;
}

export function buildDefaultPhase(snapshot: WorkspaceSnapshot, t: Copy): Phase {
  const phaseIdSet = new Set(snapshot.phases.map((phase) => phase.id));
  const topicIds = snapshot.topics
    .filter((topic) => topic.status !== 'trashed' && (!topic.phaseId || !phaseIdSet.has(topic.phaseId)))
    .map((topic) => topic.id);
  const defaultPhase = snapshot.manifest.defaultPhase;
  return {
    id: DEFAULT_PHASE_ID,
    title: defaultPhaseTitle(snapshot.manifest, t),
    icon: defaultPhase?.icon?.trim() || undefined,
    description: defaultPhase?.description?.trim() || undefined,
    startedAt: defaultPhase?.startedAt ?? snapshot.manifest.createdAt,
    endedAt: defaultPhase?.endedAt?.trim() || undefined,
    topicIds,
    status: 'active',
    shareId: defaultPhase?.shareId
  };
}

export function findPhase(snapshot: WorkspaceSnapshot, phaseId: Id, t: Copy): Phase | undefined {
  if (phaseId === DEFAULT_PHASE_ID) {
    return buildDefaultPhase(snapshot, t);
  }
  return snapshot.phases.find((phase) => phase.id === phaseId && isVisiblePhase(phase));
}

export function workspaceFolderName(workspacePath: string): string {
  const parts = workspacePath.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : workspacePath;
}

export function userFacingError(err: unknown, t: Copy): string {
  const raw = err instanceof Error ? err.message : String(err);
  const cleaned = raw
    .replace(/^Error invoking remote method '[^']+': Error:\s*/, '')
    .replace(/^Error invoking remote method "[^"]+": Error:\s*/, '');

  if (cleaned.includes('not a groupAI workspace') || cleaned.includes('not a Mindline workspace')) {
    return t.errorNotWorkspace;
  }
  if (cleaned.includes('already contains a groupAI workspace') || cleaned.includes('already contains a Mindline workspace')) {
    return t.errorAlreadyWorkspace;
  }
  return cleaned;
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((line, [key, value]) => line.split(`{${key}}`).join(String(value)), template);
}

export function isLegacyMockAssistantMessage(message: Message): boolean {
  return message.role === 'assistant' && (message.modelId === 'mock-local' || /^Mock reply for /i.test(message.content.trim()));
}

export function isVisibleTopic(topic: Topic): boolean {
  return topic.status !== 'trashed';
}

export function isVisiblePhase(phase: Phase): boolean {
  return phase.status !== 'trashed';
}

export function providerProtocolLabel(provider: ModelProvider | undefined, t: Copy): string {
  if (!provider) {
    return t.noActiveModelProvider;
  }

  if (provider.kind === 'local-tool') {
    return t.localTool;
  }

  const protocol = (provider.config as { protocol?: CloudModelProtocol }).protocol ?? 'openai-chat';
  return protocol === 'anthropic-messages' ? t.anthropicMessagesProtocol : t.openAiChatProtocol;
}

export function searchResultKindLabel(kind: SearchResultKind, t: Copy): string {
  switch (kind) {
    case 'phase':
      return t.searchResultPhase;
    case 'topic':
      return t.searchResultTopic;
    case 'message':
      return t.searchResultMessage;
    case 'topic-summary':
      return t.searchResultTopicSummary;
    case 'phase-summary':
      return t.searchResultPhaseSummary;
  }
}

export function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function resultMatches(result: SearchResult, query: string): boolean {
  const haystack = `${result.title} ${result.subtitle} ${result.excerpt}`.toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

export function buildSearchResults(snapshot: WorkspaceSnapshot | null, query: string, t: Copy): SearchResult[] {
  if (!snapshot) {
    return [];
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const visiblePhases = snapshot.phases.filter(isVisiblePhase);
  const visibleTopics = snapshot.topics.filter(isVisibleTopic);
  const phaseById = new Map(visiblePhases.map((phase) => [phase.id, phase]));
  const fallbackDefaultPhaseTitle = defaultPhaseTitle(snapshot.manifest, t);
  const topicById = new Map(visibleTopics.map((topic) => [topic.id, topic]));
  const results: SearchResult[] = [];

  for (const phase of visiblePhases) {
    const excerpt = compactText(snapshot.phaseSummaries[phase.id]?.content ?? phase.description ?? '');
    results.push({
      id: `phase:${phase.id}`,
      kind: 'phase',
      title: phase.title,
      subtitle: `${t.phase} · ${fillTemplate(t.topicCountLabel, { count: phase.topicIds.length })}`,
      excerpt,
      target: { type: 'phase', id: phase.id }
    });
  }

  for (const topic of visibleTopics) {
    const phase = topic.phaseId ? phaseById.get(topic.phaseId) : undefined;
    const messages = snapshot.messagesByTopic[topic.id] ?? [];
    const summary = snapshot.topicSummaries[topic.id];
    results.push({
      id: `topic:${topic.id}`,
      kind: 'topic',
      title: topic.title,
      subtitle: `${phase?.title ?? fallbackDefaultPhaseTitle} · ${messages.length} ${t.messages}`,
      excerpt: compactText(summary?.content ?? messages[messages.length - 1]?.content ?? ''),
      target: { type: 'topic', id: topic.id }
    });

    for (const message of messages) {
      results.push({
        id: `message:${message.id}`,
        kind: 'message',
        title: topic.title,
        subtitle: `${t.searchResultMessage} · ${message.role === 'user' ? t.userRole : message.role === 'assistant' ? t.assistantRole : message.role}`,
        excerpt: compactText(message.content),
        target: { type: 'topic', id: topic.id }
      });
    }

    if (summary) {
      results.push({
        id: `topic-summary:${summary.id}`,
        kind: 'topic-summary',
        title: topic.title,
        subtitle: t.topicSummary,
        excerpt: compactText(summary.content),
        target: { type: 'topic', id: topic.id }
      });
    }
  }

  for (const phase of visiblePhases) {
    const summary = snapshot.phaseSummaries[phase.id];
    if (!summary) {
      continue;
    }
    results.push({
      id: `phase-summary:${summary.id}`,
      kind: 'phase-summary',
      title: phase.title,
      subtitle: t.phaseSummary,
      excerpt: compactText(summary.content),
      target: { type: 'phase', id: phase.id }
    });
  }

  return results.filter((result) => resultMatches(result, trimmedQuery)).slice(0, 12);
}

export function presetLabel(presetId: ModelPresetId, t: Copy): string {
  const preset = modelPresetOptions.find((entry) => entry.id === presetId) ?? modelPresetOptions[0];
  return t[preset.labelKey];
}

export function buildProcessingSummary(snapshot: WorkspaceSnapshot | null, topicId: Id, provider: ModelProvider | undefined, t: Copy, options: ComposerSettings & { attachments?: unknown[]; contextItems?: unknown[] }): string[] {
  const messages = snapshot?.messagesByTopic[topicId] ?? [];
  const userCount = messages.filter((message) => message.role === 'user').length + 1;
  const mockCount = messages.filter(isLegacyMockAssistantMessage).length;
  const assistantCount = messages.filter((message) => message.role === 'assistant' && !isLegacyMockAssistantMessage(message)).length;
  const attachmentLine = options.attachments?.length ? fillTemplate(t.attachmentCountLabel, { count: options.attachments.length }) : '';
  const contextLine = options.contextItems?.length ? fillTemplate(t.insertedContextCountLabel, { count: options.contextItems.length }) : '';

  return [
    fillTemplate(t.summaryContextLine, { userCount, assistantCount }),
    attachmentLine,
    contextLine,
    fillTemplate(t.summaryFilterLine, { mockCount }),
    fillTemplate(t.summaryProviderLine, { provider: provider?.name ?? t.noActiveModelProvider, protocol: providerProtocolLabel(provider, t) }),
    fillTemplate(t.runtimeProfileLine, { profile: `${options.roleInstruction} × ${presetLabel(options.presetId, t)}` }),
    fillTemplate(t.runSettingsLine, { preset: presetLabel(options.presetId, t), temperature: options.temperature.toFixed(1), maxTokens: options.maxTokens }),
    t.summaryStorageLine
  ].filter(Boolean);
}

export function buildTopicSummaryProcessingSummary(snapshot: WorkspaceSnapshot | null, topicId: Id, provider: ModelProvider | undefined, t: Copy): string[] {
  const messages = snapshot?.messagesByTopic[topicId] ?? [];
  const mockCount = messages.filter(isLegacyMockAssistantMessage).length;

  return [
    fillTemplate(t.topicSummaryScopeLine, { messageCount: messages.length, mockCount }),
    fillTemplate(t.summaryProviderLine, { provider: provider?.name ?? t.noActiveModelProvider, protocol: providerProtocolLabel(provider, t) }),
    t.summarySaveLine
  ];
}

export function buildPhaseSummaryProcessingSummary(snapshot: WorkspaceSnapshot | null, phaseId: Id, provider: ModelProvider | undefined, t: Copy): string[] {
  const phase = snapshot ? findPhase(snapshot, phaseId, t) : undefined;

  return [
    fillTemplate(t.phaseSummaryScopeLine, { topicCount: phase?.topicIds.length ?? 0 }),
    fillTemplate(t.summaryProviderLine, { provider: provider?.name ?? t.noActiveModelProvider, protocol: providerProtocolLabel(provider, t) }),
    t.summarySaveLine
  ];
}

export function buildDiscussionProcessingSummary(items: SelectionCartItem[], prompt: string, provider: ModelProvider | undefined, t: Copy): string[] {
  const compactPrompt = prompt.length > 80 ? `${prompt.slice(0, 80)}...` : prompt;

  return [
    fillTemplate(t.discussionScopeLine, { itemCount: items.length }),
    fillTemplate(t.discussionPromptLine, { prompt: compactPrompt }),
    fillTemplate(t.summaryProviderLine, { provider: provider?.name ?? t.noActiveModelProvider, protocol: providerProtocolLabel(provider, t) }),
    t.discussionResultLine
  ];
}

export function groupTopicsByPhase(topics: Topic[], phases: Phase[], t: Copy): TopicNavGroup[] {
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]));
  const unassignedTopics = topics.filter((topic) => !topic.phaseId || !phaseById.has(topic.phaseId));
  const groups: TopicNavGroup[] = [];

  if (unassignedTopics.length > 0) {
    groups.push({ id: 'unassigned', title: t.noPhase, topics: unassignedTopics });
  }

  for (const phase of phases) {
    const phaseTopics = topics.filter((topic) => topic.phaseId === phase.id);
    if (phaseTopics.length > 0) {
      groups.push({ id: phase.id, title: phase.title, topics: phaseTopics });
    }
  }

  return groups;
}
