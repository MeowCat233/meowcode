import fs from 'fs';
import path from 'path';
// 2. 工具 Function Open API 声明
export const writeLocalFileSchema = {
    type: 'function',
    function: {
        name: 'writeLocalFile',
        description: '向本地项目中的文本文件写入或覆盖内容（如代码、配置文件、Markdown等）。若目录不存在会自动创建。',
        parameters: {
            type: 'object',
            properties: {
                relativePath: {
                    type: 'string',
                    description: '文件的相对路径，基于项目根目录，例如 "src/components/Button.tsx" 或 "config.json"'
                },
                content: {
                    type: 'string',
                    description: '要写入文件的完整文本内容。'
                }
            },
            required: ['relativePath', 'content']
        }
    }
};
// 3. 核心常量配置 (保持与读取一致，或根据需要微调)
const MAX_WRITE_SIZE = 1024 * 1024; // 限制单次写入最大 1MB，防止恶意撑爆磁盘
const ALLOWED_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml', '.css', '.html'
]);
// 4. 工具核心逻辑实现
export function writeLocalFile(args) {
    try {
        const rootDir = process.cwd();
        // 安全检查 1：利用 path.resolve 和 path.relative 防范路径穿越攻击
        const fullPath = path.resolve(rootDir, args.relativePath);
        const relative = path.relative(rootDir, fullPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return '错误: 无权在项目目录之外写入文件。';
        }
        // 安全检查 2：文件类型过滤（防止 AI 写入可执行脚本或后门，如 .sh, .exe, .php）
        const ext = path.extname(fullPath).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return `错误: 不支持写入该格式的文件 (${ext})，仅支持代码和文本文档。`;
        }
        // 安全检查 3：内容体积限制
        const contentBuffer = Buffer.from(args.content, 'utf-8');
        if (contentBuffer.length > MAX_WRITE_SIZE) {
            return `错误: 写入内容体积过大 (${(contentBuffer.length / 1024).toFixed(1)} KB)，超过了 1MB 的限制。`;
        }
        // 逻辑处理：如果目标路径的父级目录不存在，递归创建它
        const dirPath = path.dirname(fullPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        // 执行写入 (覆盖写入)
        fs.writeFileSync(fullPath, args.content, 'utf-8');
        return `成功: 文件已成功写入到 ${args.relativePath}`;
    }
    catch (err) {
        return `写入失败: ${err instanceof Error ? err.message : String(err)}`;
    }
}
