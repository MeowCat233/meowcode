import fs from 'fs';
import path from 'path';

// 1. 参数类型定义
export interface ReadLocalFileArgs {
    relativePath: string;
}

// 2. 工具 Function Open API 声明（明确告诉大模型：我既能读文件，又能看文件夹！）
export const readLocalFileSchema = {
    type: 'function' as const,
    function: {
        name: 'readLocalFile',
        description: '读取本地项目中的文件内容。如果传入的是文件夹路径（如 "tools"），则会自动列出该文件夹下的所有文件和子目录列表。',
        parameters: {
            type: 'object',
            properties: {
                relativePath: {
                    type: 'string',
                    description: '文件或文件夹的相对路径，基于项目根目录，例如 "tools"、"src/index.tsx" 或 "package.json"'
                }
            },
            required: ['relativePath']
        }
    }
};

// 3. 核心常量配置
const MAX_FILE_SIZE = 1024 * 1024; // 限制 1MB
const ALLOWED_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml', '.css', '.html'
]);

// 4. 工具核心逻辑实现
export function readLocalFile(args: ReadLocalFileArgs): string {
    try {
        const rootDir = process.cwd();
        // 防范路径穿越攻击
        const fullPath = path.resolve(rootDir, args.relativePath || '.');
        const relative = path.relative(rootDir, fullPath);

        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return '错误: 无权访问项目目录之外的路径。';
        }

        // 检查路径是否存在
        if (!fs.existsSync(fullPath)) {
            return `错误: 路径在当前磁盘中完全不存在: ${args.relativePath}`;
        }

        const stats = fs.statSync(fullPath);

        // ==========================================
        // ⭐ 核心修复 A：如果是文件夹，自动转换为列出目录内容
        // ==========================================
        if (stats.isDirectory()) {
            const files = fs.readdirSync(fullPath);
            if (files.length === 0) {
                return `[目录通知] 这是一个空文件夹: "${args.relativePath}"`;
            }

            // 遍历组装精简明了的目录树结构，直接反馈给大模型
            const dirContents = files.map(file => {
                const subPath = path.join(fullPath, file);
                const subStats = fs.statSync(subPath);
                const type = subStats.isDirectory() ? '📂 [目录]' : '📄 [文件]';
                return `  - ${type} ${file}`;
            }).join('\n');

            return `[目录通知] 成功读取到文件夹 "${args.relativePath}" 的物理内容，列表如下：\n${dirContents}`;
        }

        // ==========================================
        // 核心修复 B：如果是文件，保持原有的安全检查并读取内容
        // ==========================================
        if (stats.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            if (!ALLOWED_EXTENSIONS.has(ext)) {
                return `错误: 不支持读取该格式的文件 (${ext})，仅支持代码和文本文档。`;
            }

            if (stats.size > MAX_FILE_SIZE) {
                return `错误: 文件体积过大 (${(stats.size / 1024).toFixed(1)} KB)，超过了 1MB 的限制。`;
            }

            // 读取并返回
            return fs.readFileSync(fullPath, 'utf-8');
        }

        return `错误: 无法识别的路径类型。`;
    } catch (err) {
        return `读取失败: ${err instanceof Error ? err.message : String(err)}`;
    }
}