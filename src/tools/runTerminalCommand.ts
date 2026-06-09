import { execSync, exec } from 'child_process';
import os from 'os';

// 1. 参数类型定义（增加了 'openApp'）
export interface RunTerminalCommandArgs {
    commandType: 'npm' | 'git' | 'pwd' | 'ls' | 'openApp';
    args: string[];
}

// 2. 工具 Function Open API 声明
export const runTerminalCommandSchema = {
    type: 'function' as const,
    function: {
        name: 'runTerminalCommand',
        description: '在本地运行指定的允许命令，或打开常见本地应用（支持 npm, git, pwd, ls, openApp）。已做跨平台兼容与异步防阻塞处理。',
        parameters: {
            type: 'object',
            properties: {
                commandType: {
                    type: 'string',
                    enum: ['npm', 'git', 'pwd', 'ls', 'openApp'],
                    description: '允许执行的基础命令类型。若想打开应用，请传 openApp'
                },
                args: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '命令参数。若 commandType 为 openApp，则 args[0] 为应用标识，如: vscode, chrome, notepad, calculator, wechat 等；args[1] 可选，为打开的文件或网址'
                }
            },
            required: ['commandType', 'args']
        }
    }
};

// 3. 安全白名单与高级参数校验
const ALLOWED_COMMANDS = new Set(['npm', 'git', 'pwd', 'ls', 'openApp']);
const FORBIDDEN_SHELL_CHARS = /[;&|`$\><\n\r]/;
// 放宽了对 -- 的部分限制，但保持高危拦截
const BLACKLISTED_ARGS = /(--force|rm|-rf)/i; 

// 4. 常见应用在不同系统下的命令映射表
const APP_MAPPING: Record<string, { win32: string[]; darwin: string[]; linux: string[] }> = {
    vscode: { win32: ['code'], darwin: ['-a', 'Visual Studio Code'], linux: ['code'] },
    chrome: { win32: ['chrome'], darwin: ['-a', 'Google Chrome'], linux: ['google-chrome'] },
    notepad: { win32: ['notepad'], darwin: ['-a', 'TextEdit'], linux: ['gedit'] },
    calculator: { win32: ['calc'], darwin: ['-a', 'Calculator'], linux: ['gnome-calculator'] },
    wechat: { win32: ['WeChat'], darwin: ['-a', 'WeChat'], linux: ['wechat'] }, // 微信在Linux通常是wine或非官方，尽力兼容
    browser: { win32: ['start'], darwin: ['open'], linux: ['xdg-open'] } // 默认浏览器打开网页
};

// 5. 工具核心逻辑实现
export function runTerminalCommand(args: RunTerminalCommandArgs): string {
    let { commandType, args: cmdArgs } = args;

    // 安全检查 1：基础命令白名单
    if (!ALLOWED_COMMANDS.has(commandType)) {
        return `拒绝执行: 命令 "${commandType}" 不在允许的白名单中。`;
    }

    // 安全检查 2：深度的参数安全扫描
    for (const arg of cmdArgs) {
        if (FORBIDDEN_SHELL_CHARS.test(arg)) {
            return `拒绝执行: 检测到非法的 Shell 拼接或重定向字符: "${arg}"`;
        }
        if (BLACKLISTED_ARGS.test(arg)) {
            return `拒绝执行: 检测到高危参数: "${arg}"`;
        }
    }

    const platform = os.platform();
    const isWindows = platform === 'win32';

    // ================== 场景 A：打开常见应用（异步非阻塞） ==================
    if (commandType === 'openApp') {
        if (cmdArgs.length === 0) {
            return `拒绝执行: openApp 必须提供应用名称作为参数。`;
        }

        const appInput = cmdArgs[0].toLowerCase();
        const targetPath = cmdArgs[1] || ''; // 用户想让应用打开的文件或URL
        const appConfig = APP_MAPPING[appInput];

        let execCommand = '';

        if (isWindows) {
            // Windows 下有些应用在环境变量中，有些需要用 start
            const winCmd = appConfig?.win32[0] || appInput;
            // start 命令第一个参数如果是双引号，会被当成窗口标题，所以加个空双引号 ""
            execCommand = `start "" "${winCmd}" ${targetPath ? `"${targetPath}"` : ''}`;
        } else if (platform === 'darwin') {
            // macOS 使用 open 命令
            if (appConfig) {
                const macArgs = appConfig.darwin.map(arg => `"${arg}"`).join(' ');
                execCommand = `open ${macArgs} ${targetPath ? `"${targetPath}"` : ''}`;
            } else {
                // 如果不在白名单，尝试直接 open 应用名
                execCommand = `open -a "${appInput}" ${targetPath ? `"${targetPath}"` : ''}`;
            }
        } else {
            // Linux 使用 xdg-open 或直接唤起
            const linuxCmd = appConfig?.linux[0] || appInput;
            execCommand = `"${linuxCmd}" ${targetPath ? `"${targetPath}"` : ''}`;
        }

        // ⭐ 关键：使用异步的 exec，防止 GUI 应用挂起/阻塞大模型的 Node 进程
        exec(execCommand, (err) => {
            if (err) {
                console.error(`异步启动应用 [${appInput}] 失败:`, err.message);
            }
        });

        return `应用 "${appInput}" 已尝试在后台异步启动。`;
    }

    // ================== 场景 B：普通终端命令（同步阻塞获取结果） ==================
    if (isWindows) {
        if (commandType === 'ls') {
            commandType = 'dir' as any;
            cmdArgs = cmdArgs.map(arg => arg.replace(/\//g, '\\'));
            if (!cmdArgs.includes('/B')) {
                cmdArgs.unshift('/B');
            }
        } else if (commandType === 'pwd') {
            commandType = 'cd' as any;
        }
    }

    try {
        const sanitizedArgs = cmdArgs.map(arg => `"${arg}"`).join(' ');
        const fullCommand = `${commandType} ${sanitizedArgs}`.trim();

        const output = execSync(fullCommand, {
            encoding: 'utf-8',
            timeout: 30000,
            maxBuffer: 1024 * 1024 * 10,
            cwd: process.cwd(),
            env: {
                ...process.env,
                CI: 'true'
            }
        });

        return output.trim() || "命令执行成功，无标准输出。";
    } catch (err: any) {
        const stderr = err.stderr ? String(err.stderr) : '';
        const stdout = err.stdout ? String(err.stdout) : '';
        const message = err.message ? String(err.message) : String(err);

        return `命令执行失败:\n错误信息: ${message}\n终端标准输出: ${stdout}\n标准错误输出: ${stderr}`;
    }
}