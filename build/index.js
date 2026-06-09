#!/usr/bin/env node
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
function AgentCLI() {
    // 核心状态控制：'auth' (输入/验证Key) 或是 'chat' (正常对话)
    const [stage, setStage] = useState('auth');
    const [apiKey, setApiKey] = useState('');
    // 💾 新增局部状态：用于安全隔离存放通过验证的私有 Key 资产，绝对不注入全局环境变量中
    const [verifiedKey, setVerifiedKey] = useState('');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('AI 思考中...');
    const [authError, setAuthError] = useState('');
    // 渲染给用户看的初始消息
    const [messages, setMessages] = useState([
        { role: 'logo', text: MEOW_CODE_LOGO },
        { role: 'system', text: `超级喵喵 Agent 已成功在当前目录启动！` }
    ]);
    // 初始化记忆管理器，必须放在组件的最顶层
    const memory = useRef(new MemoryManager({ maxBufferSize: 12, retainCount: 4 }));
    // 核心：验证 API Key 是否合法的函数
    const validateApiKey = async (key) => {
        try {
            // 直接将输入的 key 传给依赖显式参数的 chat 纯函数进行隔离 ping 测试
            await chat([{ role: 'user', content: 'hi' }], key);
            return { success: true, message: '验证成功！' };
        }
        catch (err) {
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
            }
            else if (err instanceof Error) {
                if (err.message.includes('ENOTFOUND') || err.message.includes('fetch failed')) {
                    errorMsg = '🌐 网络连接失败，无法连接到 DeepSeek 接口服务器。';
                }
                else {
                    errorMsg = `错误信息: ${err.message}`;
                }
            }
            return { success: false, message: errorMsg };
        }
    };
    // 处理 API Key 提交
    const handleAuthSubmit = async (value) => {
        const trimmedKey = value.trim();
        if (!trimmedKey || loading)
            return;
        if (trimmedKey === '/exit')
            process.exit(0);
        setLoading(true);
        setLoadingText('正在验证 API Key 的有效性...');
        setAuthError('');
        const res = await validateApiKey(trimmedKey);
        setLoading(false);
        if (res.success) {
            setVerifiedKey(trimmedKey);
            setStage('chat'); // 切换至对话阶段
        }
        else {
            setAuthError(res.message); // 打印精准的 DeepSeek 错误码提示
            setApiKey(''); // 清空错误的输入
        }
    };
    // 处理正常对话提交
    const handleSubmit = async (value) => {
        if (!value.trim() || loading)
            return;
        if (value === '/exit')
            process.exit(0);
        // 精准外挂：拦截 /skills 命令
        if (value === '/skills') {
            setMessages(prev => [...prev, { role: 'user', text: value }]);
            setQuery('');
            try {
                const result = await executeTool('readSkills', '{}');
                setMessages(prev => [...prev, { role: 'system', text: result }]);
            }
            catch (err) {
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
                const thinkingProcess = responseMessage.reasoning_content;
                if (thinkingProcess) {
                    setMessages(prev => [...prev, { role: 'thought', text: thinkingProcess.trim() }]);
                }
                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    memory.current.append(responseMessage);
                    for (const toolCall of responseMessage.tool_calls) {
                        if (toolCall.type !== 'function')
                            continue;
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
                    setMessages(prev => [...prev, { role: 'assistant', text: responseMessage.content }]);
                    memory.current.append('assistant', responseMessage.content);
                    keepThinking = false;
                }
                else if (!thinkingProcess) {
                    keepThinking = false;
                }
            }
            if (memory.current.shouldCompress()) {
                setLoadingText('喵要长脑子了...');
                // 建议在 MemoryManager 的 compress 接口中同样支持传入临时 Key，例如：compress(apiKey: string)
                await memory.current.compress(verifiedKey);
                setMessages(prev => [...prev, { role: 'system', text: '💡 历史对话细节已沉淀为长期记忆大纲。' }]);
            }
        }
        catch (error) {
            setMessages(prev => [
                ...prev,
                { role: 'system', text: `异常阻断: ${error instanceof Error ? error.message : String(error)}` }
            ]);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx(Box, { width: "100%", minHeight: 30, justifyContent: "center", alignItems: "center", paddingY: 1, children: _jsxs(Box, { flexDirection: "column", borderStyle: "single", borderColor: "yellow", paddingX: 3, paddingY: 1, width: 85, children: [_jsxs(Box, { flexDirection: "column", alignItems: "center", width: "100%", marginBottom: 1, marginTop: 1, children: [_jsx(Text, { color: "yellow", bold: true, children: MEOW_CODE_LOGO }), _jsx(Text, { color: "yellow", dimColor: true, children: "\u2550\u2550\u2550\u26A1\u2550\u2550 Autonomous Agent Terminal Engine \u2550\u2550\u26A1\u2550\u2550\u2550" })] }), stage === 'auth' && (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: "\uD83D\uDD10 \u8BF7\u8F93\u5165\u60A8\u7684 API Key \u4EE5\u89E3\u9501 Agent \u7EC8\u7AEF\uFF1A" }), authError && (_jsx(Box, { marginTop: 1, paddingX: 1, borderStyle: "round", borderColor: "red", children: _jsxs(Text, { color: "red", bold: true, children: ["\u274C \u6821\u9A8C\u672A\u901A\u8FC7\uFF1A", authError] }) })), loading && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "yellow", children: [_jsx(Spinner, { type: "dots" }), " ", loadingText] }) })), _jsxs(Box, { borderStyle: "round", borderColor: "magenta", paddingX: 1, marginTop: 1, children: [_jsx(Text, { color: "magenta", bold: true, children: "Key \u276F " }), _jsx(TextInput, { value: apiKey, onChange: setApiKey, onSubmit: handleAuthSubmit, focus: !loading, mask: "*" })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "\uFF08\u63D0\u793A\uFF1A\u8F93\u5165 /exit \u9000\u51FA\u7A0B\u5E8F\uFF09" }) })] })), stage === 'chat' && (_jsxs(_Fragment, { children: [_jsx(Box, { flexDirection: "column", marginBottom: 1, children: messages.filter(msg => msg.role !== 'logo').map((msg, index) => {
                                let color = 'green';
                                let prefix = '🤖 AI: ';
                                if (msg.role === 'user') {
                                    color = 'cyan';
                                    prefix = '👤 You: ';
                                }
                                else if (msg.role === 'system') {
                                    color = 'gray';
                                    prefix = '⚙️ ';
                                }
                                else if (msg.role === 'tool') {
                                    color = 'blue';
                                    prefix = '🛠️ ';
                                }
                                else if (msg.role === 'thought') {
                                    color = 'yellow';
                                    prefix = '🧠 Thinking Process:\n';
                                }
                                const isThought = msg.role === 'thought';
                                return (_jsx(Box, { flexDirection: "column", marginBottom: isThought ? 1 : 0, children: isThought ? (_jsx(Box, { borderStyle: "round", borderColor: "gray", paddingLeft: 1, flexDirection: "column", children: _jsxs(Text, { color: color, dimColor: true, children: [prefix, msg.text] }) })) : (_jsxs(Text, { color: color, children: [prefix, msg.text] })) }, index));
                            }) }), loading && (_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: "yellow", children: [_jsx(Spinner, { type: "dots" }), " ", loadingText] }) })), _jsxs(Box, { borderStyle: "round", borderColor: "gray", paddingX: 1, marginTop: 1, children: [_jsx(Text, { color: "magenta", bold: true, children: "\u276F " }), _jsx(TextInput, { value: query, onChange: setQuery, onSubmit: handleSubmit, focus: !loading })] }), _jsx(Text, { children: " \u76EE\u524D\u4EC5\u652F\u6301: deepseek-v4-pro " }), _jsxs(Text, { children: [" \u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55: ", DIR_NAME, " "] })] }))] }) }));
}
render(_jsx(AgentCLI, {}));
