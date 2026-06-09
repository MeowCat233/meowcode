import { summarize } from "../ds.js";
export class MemoryManager {
    currentSummary = "";
    // 严格遵循官方类型的标准历史容器
    uncompressedHistory = [];
    maxBufferSize;
    retainCount;
    compressionPrompt;
    constructor(config) {
        this.maxBufferSize = config?.maxBufferSize ?? 10;
        this.retainCount = config?.retainCount ?? 4;
        this.compressionPrompt = config?.compressionPrompt ?? `你是一个长期记忆管理器。请根据历史对话内容和当前的记忆大纲，生成一份更新后的、精简的记忆大纲。
请遵循以下核心原则：
1. 保持精炼：删除所有客套话和重复提问，只保留核心事实。
2. 提取关键要素：包括用户偏好、习惯、未完成的任务进展以及核心实体。
3. 动态更新：如果新对话修正了旧记忆，请以新信息为准。
请直接输出更新后的摘要。`;
    }
    /**
     * 支持直接推入完全符合官方规范的 ChatMessage 对象
     */
    append(roleOrObj, content) {
        if (typeof roleOrObj === 'object' && roleOrObj !== null) {
            // 深度拷贝，防止外部引用污染
            this.uncompressedHistory.push({ ...roleOrObj });
        }
        else {
            this.uncompressedHistory.push({
                role: roleOrObj,
                content: content || ""
            });
        }
    }
    /**
     * 吐出完美的 Payload 链条，绝不破坏 tool 状态机逻辑
     */
    getPayload() {
        const payload = [];
        if (this.currentSummary) {
            payload.push({
                role: 'system',
                content: `前情提要（长期记忆总结）:\n${this.currentSummary}`
            });
        }
        payload.push(...this.uncompressedHistory);
        return payload;
    }
    shouldCompress() {
        return this.uncompressedHistory.length >= this.maxBufferSize;
    }
    /**
     * 安全执行长期记忆合并
     */
    async compress() {
        if (!this.shouldCompress())
            return this.currentSummary;
        // 1. 寻找安全的切分点（初始预设为保留最后 retainCount 条消息）
        let splitIndex = this.uncompressedHistory.length - this.retainCount;
        // 2. 强安全修正：如果切分点刚好把 tool 消息和它前面的 tool_calls 隔开了，就向前平移切分点
        while (splitIndex > 0) {
            const currentMsg = this.uncompressedHistory[splitIndex];
            const prevMsg = this.uncompressedHistory[splitIndex - 1];
            // 场景 A: 如果切分点留在一条 tool 消息上，代表不安全，必须将它和它的前置节点划在一起
            // 场景 B: 如果前一条消息有 tool_calls，而当前不是为了闭环，也必须往前推，确保不把他们切开
            if (currentMsg.role === 'tool' ||
                (prevMsg && prevMsg.role === 'assistant' && prevMsg.tool_calls && prevMsg.tool_calls.length > 0)) {
                splitIndex--;
            }
            else {
                break; // 找到了安全的“非工具调用”干净边界，退出循环
            }
        }
        // 兜底保护：如果整个缓冲区全是密密麻麻的 tool call，甚至找不到安全边界
        if (splitIndex <= 0) {
            // 本轮强行放弃压缩，直接返回，等待下一轮会话缓冲区更大、出现干净边界时再处理
            return this.currentSummary;
        }
        // 3. 基于安全切分点进行内容分割
        const messagesToSummarize = this.uncompressedHistory.slice(0, splitIndex);
        const retainedMessages = this.uncompressedHistory.slice(splitIndex);
        const decoratedMessages = [
            {
                role: 'system',
                content: this.compressionPrompt
            },
            ...messagesToSummarize
        ];
        const newSummary = await summarize(decoratedMessages, this.currentSummary);
        this.currentSummary = newSummary;
        this.uncompressedHistory = retainedMessages;
        return this.currentSummary;
    }
}
