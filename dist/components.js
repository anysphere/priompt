"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantMessage = exports.UserMessage = exports.SystemMessage = void 0;
function SystemMessage(props) {
    return {
        type: "chat",
        role: "system",
        children: props.children !== undefined
            ? Array.isArray(props.children)
                ? props.children.flat()
                : [props.children]
            : [],
    };
}
exports.SystemMessage = SystemMessage;
function UserMessage(props) {
    return {
        type: "chat",
        role: "user",
        children: props.children !== undefined
            ? Array.isArray(props.children)
                ? props.children.flat()
                : [props.children]
            : [],
    };
}
exports.UserMessage = UserMessage;
function AssistantMessage(props) {
    return {
        type: "chat",
        role: "assistant",
        children: props.children !== undefined
            ? Array.isArray(props.children)
                ? props.children.flat()
                : [props.children]
            : [],
    };
}
exports.AssistantMessage = AssistantMessage;
//# sourceMappingURL=components.js.map