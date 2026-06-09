import OpenAI from "openai";
import { agentTools } from "./tools/index.js";
// 动态获取实例的辅助函数，支持显式传入临时的 customApiKey
function getOpenAIInstance(customApiKey) {
    // 优先使用显式传入的 Key（用于验证阶段）；否则降级读取环境变量
    const apiKey = customApiKey;
    return new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey,
    });
}
export async function chat(messages, customApiKey) {
    // 将临时的 customApiKey 传递给辅助函数
    const openai = getOpenAIInstance(customApiKey);
    const sanitizedMessages = messages.map(msg => {
        if (msg.role === 'assistant' && 'reasoning_content' in msg) {
            const { reasoning_content, ...rest } = msg;
            return rest;
        }
        return msg;
    });
    const completion = await openai.chat.completions.create({
        messages: sanitizedMessages,
        model: "deepseek-v4-pro",
        tools: agentTools,
        tool_choice: "auto",
        stream: false,
        reasoning_effort: "high",
        extra_body: {
            thinking: { type: "enabled" }
        }
    });
    return completion.choices[0]?.message;
}
export async function summarize(oldHistory, currentSummary) {
    const openai = getOpenAIInstance();
    const historyText = oldHistory
        .map(m => {
        const content = 'content' in m && typeof m.content === 'string' ? m.content : '';
        return `${m.role}: ${content}`;
    })
        .filter(line => line.split(': ')[1])
        .join("\n");
    const prompt = `你是一个长期记忆管理器。请根据历史对话内容和当前的记忆大纲，生成一份更新后的、精简的记忆大纲。
当前记忆大纲：${currentSummary}
新增对话历史：
${historyText}
请输出最新大纲：`;
    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-v4-flash",
        stream: false,
        reasoning_effort: "low",
    });
    return completion.choices[0]?.message?.content?.trim() ?? currentSummary;
}
