#!/usr/bin/env node

import { useState, useRef } from 'react';
import { render, Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { chat } from "./ds.js";
import { MemoryManager } from "./context/memory.js";
import { executeTool } from "./tools/index.js";
import path from 'path';

// 修改系统进程名和标签页标题
process.title = 'meowcode';
process.stdout.write('\x1b]0;meowcode\x07');
process.stdout.write('\x1bc');

// Logo
const MEOW_CODE_LOGO = `
    __   __                       ______            __     
   / |  / /___ ____ _      __    / ____/___  ____  / /____ 
  / /|_/ / _ \\/ __ \\ | /| / /   / /   / __ \\/ __ \\/ / _  /
 / /  / /  __/ /_/ / |/ |/ /   / /___/ /_/ / /_/ / /  __/ 
/_/  /_ \\___/\\____/|__/|__/    \\____/\\____/\\____/_/\\___|  
`;

// 获取敲击命令时的终端当前工作目录
const DIR_NAME = path.resolve(process.cwd());

interface DisplayMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought' | 'logo';
  text: string;
}

function AgentCLI() {
  // 核心状态控制：'auth' (输入/验证Key) 或是 'chat' (正常对话)
  const [stage, setStage] = useState<'auth' | 'chat'>('auth');
  const [apiKey, setApiKey] = useState<string>('');

  // 💾 新增局部状态：用于安全隔离存放通过验证的私有 Key 资产，绝对不注入全局环境变量中
  const [verifiedKey, setVerifiedKey] = useState<string>('');

  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('AI 思考中...');
  const [authError, setAuthError] = useState<string>('');

  // 渲染给用户看的初始消息
  const [messages, setMessages] = useState<DisplayMessage[]>([
    { role: 'logo', text: MEOW_CODE_LOGO },
    { role: 'system', text: `超级喵喵 Agent 已成功在当前目录启动！` }
  ]);

  // 初始化记忆管理器，必须放在组件的最顶层
  const memory = useRef(new MemoryManager({ maxBufferSize: 12, retainCount: 4 }));

  // 核心：验证 API Key 是否合法的函数
  const validateApiKey = async (key: string): Promise<{ success: boolean; message: string }> => {
    try {
      // 直接将输入的 key 传给依赖显式参数的 chat 纯函数进行隔离 ping 测试
      await chat([{ role: 'user', content: 'hi' }], key);
      return { success: true, message: '验证成功！' };
    } catch (err: any) {
      let errorMsg = '未知认证错误，请检查网络连接。';

      // 提取 DeepSeek / OpenAI SDK 抛出的 HTTP 状态码
      const status = err?.status || err?.statusCode || err?.response?.status;

      if (status) {
        switch (status) {
          case 401:
            errorMsg = '【401 Unauthorized】API Key 错误或已被封禁，请检查输入。';
            break;
          case 402:
            errorMsg = '【402 Payment Required】DeepSeek 账户余额不足，请及时充值。';
            break;
          case 403:
            errorMsg = '【403 Forbidden】权限不足，请确认该 Key 是否支持所选模型。';
            break;
          case 429:
            errorMsg = '【429 Rate Limit】请求过于频繁，或触发了当前 Key 的额度并发限制。';
            break;
          case 500:
          case 503:
            errorMsg = `【HTTP ${status}】DeepSeek 服务器当前繁忙或正在维护，请稍后再试。`;
            break;
          default:
            errorMsg = `【HTTP ${status}】API 请求失败，返回了非预期的状态码。`;
        }
      } else if (err instanceof Error) {
        if (err.message.includes('ENOTFOUND') || err.message.includes('fetch failed')) {
          errorMsg = '🌐 网络连接失败，无法连接到 DeepSeek 接口服务器。';
        } else {
          errorMsg = `错误信息: ${err.message}`;
        }
      }

      return { success: false, message: errorMsg };
    }
  };

  // 处理 API Key 提交
  const handleAuthSubmit = async (value: string) => {
    const trimmedKey = value.trim();
    if (!trimmedKey || loading) return;
    if (trimmedKey === '/exit') process.exit(0);

    setLoading(true);
    setLoadingText('正在验证 API Key 的有效性...');
    setAuthError('');

    const res = await validateApiKey(trimmedKey);

    setLoading(false);
    if (res.success) {
      setVerifiedKey(trimmedKey);
      setStage('chat'); // 切换至对话阶段
    } else {
      setAuthError(res.message); // 打印精准的 DeepSeek 错误码提示
      setApiKey(''); // 清空错误的输入
    }
  };

  // 处理正常对话提交
  const handleSubmit = async (value: string) => {
    if (!value.trim() || loading) return;
    if (value === '/exit') process.exit(0);

    // 精准外挂：拦截 /skills 命令
    if (value === '/skills') {
      setMessages(prev => [...prev, { role: 'user', text: value }]);
      setQuery('');

      try {
        const result = await executeTool('readSkills', '{}');
        setMessages(prev => [...prev, { role: 'system', text: result }]);
      } catch (err) {
        setMessages(prev => [
          ...prev,
          { role: 'system', text: `⚙️ 执行 /skills 命令失败: ${err instanceof Error ? err.message : String(err)}` }
        ]);
      }
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text: value }]);
    setQuery('');
    setLoadingText('AI 正在深度思考...');
    setLoading(true);

    memory.current.append('user', value);

    try {
      let keepThinking = true;
      let loopCount = 0;

      while (keepThinking && loopCount < 8) {
        loopCount++;
        const apiMessages = memory.current.getPayload();

        // 显式将本地 React 变量中安全的 verifiedKey 传入 chat 执行单元
        const responseMessage = await chat(apiMessages, verifiedKey);

        if (!responseMessage) {
          keepThinking = false;
          break;
        }

        const thinkingProcess = (responseMessage as any).reasoning_content;
        if (thinkingProcess) {
          setMessages(prev => [...prev, { role: 'thought', text: thinkingProcess.trim() }]);
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          memory.current.append(responseMessage);

          for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.type !== 'function') continue;

            const { name, arguments: args } = toolCall.function;
            setLoadingText(`🔧 正在调用本地工具: [${name}]...`);

            const toolResult = await executeTool(name, args);
            setMessages(prev => [...prev, { role: 'tool', text: `[${name}] 执行成功` }]);

            memory.current.append({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult
            });
          }
          continue;
        }

        if (responseMessage.content) {
          setMessages(prev => [...prev, { role: 'assistant', text: responseMessage.content! }]);
          memory.current.append('assistant', responseMessage.content);
          keepThinking = false;
        } else if (!thinkingProcess) {
          keepThinking = false;
        }
      }

      if (memory.current.shouldCompress()) {
        setLoadingText('喵要长脑子了...');

        // 建议在 MemoryManager 的 compress 接口中同样支持传入临时 Key，例如：compress(apiKey: string)
        await (memory.current as any).compress(verifiedKey);

        setMessages(prev => [...prev, { role: 'system', text: '💡 历史对话细节已沉淀为长期记忆大纲。' }]);
      }

    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'system', text: `异常阻断: ${error instanceof Error ? error.message : String(error)}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      width="100%"
      minHeight={30}
      justifyContent="center"
      alignItems="center"
      paddingY={1}
    >
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="yellow"
        paddingX={3}
        paddingY={1}
        width={85}
      >
        <Box flexDirection="column" alignItems="center" width="100%" marginBottom={1} marginTop={1}>
          <Text color="yellow" bold>{MEOW_CODE_LOGO}</Text>
          <Text color="yellow" dimColor>═══⚡══ Autonomous Agent Terminal Engine ══⚡═══</Text>
        </Box>

        {stage === 'auth' && (
          <Box flexDirection="column" marginY={1}>
            <Text color="cyan" bold>🔐 请输入您的 API Key 以解锁 Agent 终端：</Text>

            {authError && (
              <Box marginTop={1} paddingX={1} borderStyle="round" borderColor="red">
                <Text color="red" bold>❌ 校验未通过：{authError}</Text>
              </Box>
            )}

            {loading && (
              <Box marginTop={1}>
                <Text color="yellow">
                  <Spinner type="dots" /> {loadingText}
                </Text>
              </Box>
            )}

            <Box borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1}>
              <Text color="magenta" bold>Key ❯ </Text>
              <TextInput
                value={apiKey}
                onChange={setApiKey}
                onSubmit={handleAuthSubmit}
                focus={!loading}
                mask="*"
              />
            </Box>
            <Box marginTop={1}>
              <Text color="gray" dimColor>（提示：输入 /exit 退出程序）</Text>
            </Box>
          </Box>
        )}

        {stage === 'chat' && (
          <>
            <Box flexDirection="column" marginBottom={1}>
              {messages.filter(msg => msg.role !== 'logo').map((msg, index) => {
                let color = 'green';
                let prefix = '🤖 AI: ';

                if (msg.role === 'user') {
                  color = 'cyan';
                  prefix = '👤 You: ';
                } else if (msg.role === 'system') {
                  color = 'gray';
                  prefix = '⚙️ ';
                } else if (msg.role === 'tool') {
                  color = 'blue';
                  prefix = '🛠️ ';
                } else if (msg.role === 'thought') {
                  color = 'yellow';
                  prefix = '🧠 Thinking Process:\n';
                }

                const isThought = msg.role === 'thought';

                return (
                  <Box key={index} flexDirection="column" marginBottom={isThought ? 1 : 0}>
                    {isThought ? (
                      <Box borderStyle="round" borderColor="gray" paddingLeft={1} flexDirection="column">
                        <Text color={color} dimColor>{prefix}{msg.text}</Text>
                      </Box>
                    ) : (
                      <Text color={color}>{prefix}{msg.text}</Text>
                    )}
                  </Box>
                );
              })}
            </Box>

            {loading && (
              <Box marginBottom={1}>
                <Text color="yellow">
                  <Spinner type="dots" /> {loadingText}
                </Text>
              </Box>
            )}

            <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
              <Text color="magenta" bold>❯ </Text>
              <TextInput value={query} onChange={setQuery} onSubmit={handleSubmit} focus={!loading} />
            </Box>
            <Text> 目前仅支持: deepseek-v4-pro </Text>
            <Text> 当前工作目录: {DIR_NAME} </Text>
          </>
        )}
      </Box>
    </Box>
  );
}

render(<AgentCLI />);