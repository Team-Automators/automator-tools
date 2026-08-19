export const PROVIDERS = [
  {
    id: 'claude', name: 'Anthropic — Claude', color: '#7C3AED', placeholder: 'sk-ant-api03-...',
    defaultModel: 'claude-sonnet-4-6',
    models: [
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  },
  {
    id: 'openai', name: 'OpenAI — GPT', color: '#10A37F', placeholder: 'sk-proj-...',
    defaultModel: 'gpt-4o',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'o4-mini',
      'o3-mini',
      'o1',
      'o1-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ],
  },
  {
    id: 'groq', name: 'Groq — Llama / Mixtral', color: '#F55036', placeholder: 'gsk_...',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.2-90b-text-preview',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
  },
  {
    id: 'gemini', name: 'Google — Gemini', color: '#4285F4', placeholder: 'AIzaSy...',
    defaultModel: 'gemini-1.5-pro',
    models: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-thinking-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
    ],
  },
  {
    id: 'mistral', name: 'Mistral AI', color: '#FF7000', placeholder: '...',
    defaultModel: 'mistral-large-latest',
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'codestral-latest',
      'mistral-nemo',
    ],
  },
  {
    id: 'perplexity', name: 'Perplexity', color: '#20B2AA', placeholder: 'pplx-...',
    defaultModel: 'llama-3.1-sonar-large-128k-online',
    models: [
      'llama-3.1-sonar-huge-128k-online',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-small-128k-online',
    ],
  },
  {
    id: 'together', name: 'Together AI', color: '#2A7AFF', placeholder: '...',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek', color: '#3B82F6', placeholder: 'sk-...',
    defaultModel: 'deepseek-chat',
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
  },
  {
    id: 'xai', name: 'xAI — Grok', color: '#111827', placeholder: 'xai-...',
    defaultModel: 'grok-2-latest',
    models: [
      'grok-2-latest',
      'grok-2-vision-latest',
      'grok-3',
      'grok-3-mini',
      'grok-beta',
    ],
  },
  {
    id: 'cohere', name: 'Cohere', color: '#39594D', placeholder: '...',
    defaultModel: 'command-r-plus',
    models: [
      'command-r-plus',
      'command-r',
      'command-light',
      'command',
    ],
  },
]

export const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p]))
