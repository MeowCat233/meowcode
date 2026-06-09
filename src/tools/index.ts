import { readLocalFile, readLocalFileSchema } from './readLocalFile.js';
import { runTerminalCommand, runTerminalCommandSchema } from './runTerminalCommand.js';
import { writeLocalFile, writeLocalFileSchema } from './writeLocalFile.js';
// 1. 引入新工具的实现及它的 Schema 声明
import { readSkills, readSkillsSchema } from './readSkills.js';

// ==========================================
// 1. 统一导出给大模型（LLM）的 Tools 声明数组
// ==========================================
export const agentTools = [
  readLocalFileSchema,
  runTerminalCommandSchema,
  writeLocalFileSchema,
  readSkillsSchema, // 2. 注册到 Schema 数组，让大模型感知到这个新技能模块
];

// ==========================================
// 2. 工具路由映射表 (策略模式)
// ==========================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toolExecutorMap: Record<string, (args: any) => string | Promise<string>> = {
  'readLocalFile': readLocalFile,
  'runTerminalCommand': runTerminalCommand,
  'writeLocalFile': writeLocalFile,
  'readSkills': readSkills, // 3. 注册到执行映射表，确保分发器能找到对应的处理函数
};

// ==========================================
// 3. 统一执行分发器
// ==========================================
export async function executeTool(name: string, argsString: string): Promise<string> {
  let args;
  try {
    args = JSON.parse(argsString);
  } catch (err) {
    return `参数解析失败: ${err instanceof Error ? err.message : String(err)}`;
  }

  const executor = toolExecutorMap[name];
  if (!executor) return `未知工具: ${name}`;

  // 纯净执行：只返回计算结果，由调用者（大模型状态机循环）来决定要不要存入 memory
  return await executor(args);
}