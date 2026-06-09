import fs from 'fs';
import path from 'path';
// 2. 工具 Function Open API 声明，让大模型能理解并自主调用此能力
export const readSkillsSchema = {
    type: 'function',
    function: {
        name: 'readSkills',
        description: '读取本地特定 skills 文件夹下的标准技能模板。支持列出所有技能 Markdown 文件，或读取特定合规技能的详细输入输出规范。',
        parameters: {
            type: 'object',
            properties: {
                skillName: {
                    type: 'string',
                    description: '可选。具体技能的 Markdown 文件名（例如 "deploy_agent.md"）。如果不填，则默认列出所有可用的标准技能。'
                }
            }
        }
    }
};
// 3. 核心常量与标准格式定义
const SKILLS_DIR_NAME = 'skills';
const MAX_FILE_SIZE = 512 * 1024; // 限制技能文件最大 512KB
// 标准技能文档必须包含的 4 个核心二级标题
const REQUIRED_SECTIONS = [
    '## 技能描述',
    '## 参数说明',
    '## 使用示例',
    '## 注意事项'
];
/**
 * 校验 Markdown 内容是否符合标准格式
 * @param content 文件的文本内容
 */
function validateSkillFormat(content) {
    // 1. 基础结构检查：必须包含特定的二级标题
    const missingSections = REQUIRED_SECTIONS.filter(section => !content.includes(section));
    if (missingSections.length > 0) {
        return {
            valid: false,
            missing: `缺少必需的结构章节: ${missingSections.join(', ')}`
        };
    }
    // 2. 增强检查：开头必须有 # 一级标题作为技能名称
    if (!/^#\s+.+/m.test(content)) {
        return {
            valid: false,
            missing: '缺少技能主标题（例如：# 自动部署技能）'
        };
    }
    return { valid: true };
}
// 4. 工具核心逻辑实现
export function readSkills(args) {
    try {
        const rootDir = process.cwd();
        // 锁定特定命名的 skills 文件夹物理路径
        const skillsFullPath = path.resolve(rootDir, SKILLS_DIR_NAME);
        // 如果本地没有这个文件夹，则自动帮用户建一个
        if (!fs.existsSync(skillsFullPath)) {
            fs.mkdirSync(skillsFullPath, { recursive: true });
            return `[Skills通知] 检测到本地暂无 "${SKILLS_DIR_NAME}" 文件夹，已自动为您初始化。目前里面空空如也，请放入符合标准格式的 .md 技能文件。`;
        }
        // ==========================================
        // 分支 A：未指定文件名 -> 列出所有技能并透视合规状态
        // ==========================================
        if (!args.skillName || args.skillName.trim() === '') {
            const files = fs.readdirSync(skillsFullPath);
            // 严格过滤：只保留 .md 结尾的文件
            const mdFiles = files.filter(file => path.extname(file).toLowerCase() === '.md');
            if (mdFiles.length === 0) {
                return `[Skills通知] 当前 "${SKILLS_DIR_NAME}" 文件夹下未发现任何 .md 格式的技能文件。`;
            }
            // 核心优化：循环检测每个 md 文件的合规性状态
            const skillList = mdFiles.map(file => {
                const filePath = path.join(skillsFullPath, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const check = validateSkillFormat(content);
                    if (check.valid) {
                        return `  - 📄 **${file}** | ✅ 立即可用`;
                    }
                    else {
                        return `  - 📄 **${file}** | ❌ 不符合标准规范（${check.missing}）`;
                    }
                }
                catch {
                    return `  - 📄 **${file}** | ⚠️ 文件读取异常`;
                }
            }).join('\n');
            return `[Skills通知] 成功读取到本地技能列表与合规状态：\n\n${skillList}`;
        }
        // ==========================================
        // 分支 B：指定了文件名 -> 读取并严格审计格式
        // ==========================================
        const targetSkillName = args.skillName.trim();
        // 强校验一：必须是 .md 后缀
        if (path.extname(targetSkillName).toLowerCase() !== '.md') {
            return `错误: 拒绝读取！[${targetSkillName}] 不是 Markdown 文件。Skills 模块仅支持读取以 ".md" 结尾的标准格式文件。`;
        }
        // 安全检查：防止路径穿越攻击（如传入 ../../../etc/passwd）
        const targetSkillPath = path.resolve(skillsFullPath, targetSkillName);
        const relativeToSkills = path.relative(skillsFullPath, targetSkillPath);
        if (relativeToSkills.startsWith('..') || path.isAbsolute(relativeToSkills)) {
            return `错误: 拒绝访问！指定的技能路径超出了 "${SKILLS_DIR_NAME}" 文件夹的安全范围。`;
        }
        if (!fs.existsSync(targetSkillPath)) {
            return `错误: 未找到名为 "${targetSkillName}" 的技能文件。`;
        }
        const stats = fs.statSync(targetSkillPath);
        if (stats.isDirectory()) {
            return `错误: "${targetSkillName}" 是一个子目录，而非标准的技能 Markdown 文件。`;
        }
        if (stats.size > MAX_FILE_SIZE) {
            return `错误: 该技能文件体积过大，超过了 512 KB 限制。`;
        }
        // 读取技能文本
        const content = fs.readFileSync(targetSkillPath, 'utf-8');
        // 强校验二：内容格式审计
        const formatCheck = validateSkillFormat(content);
        if (!formatCheck.valid) {
            return `拒绝解析: 技能文件 [${targetSkillName}] 内容不符合标准规范！\n原因: ${formatCheck.missing}\n\n标准技能模板必须包含以下骨架：\n# 技能名称\n## 技能描述\n## 参数说明\n## 使用示例\n## 注意事项`;
        }
        // 格式完全合规，放行返回
        return `[Skills通知] 成功读取并验证标准技能 [${targetSkillName}]，内容如下：\n\n${content}`;
    }
    catch (err) {
        return `读取 Skills 失败: ${err instanceof Error ? err.message : String(err)}`;
    }
}
