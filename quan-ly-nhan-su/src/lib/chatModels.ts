export type ChatModel = {
  id: string;
  provider: "codex" | "anti" | "gemini";
  model: string;
  label: string;
};
