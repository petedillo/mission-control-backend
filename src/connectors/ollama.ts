/**
 * Ollama Connector
 * Connects to Ollama API for LLM inference
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatResponse {
  model: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaConnector {
  private client: AxiosInstance;
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://ollama.dev:11434';
    this.defaultModel = model || process.env.OLLAMA_MODEL || 'mistral';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Ollama connector initialized', {
      baseUrl: this.baseUrl,
      model: this.defaultModel,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/api/tags');
      logger.info('Ollama connection test successful');
      return true;
    } catch (error) {
      logger.error('Ollama connection test failed', { error });
      return false;
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      logger.info('Retrieved Ollama models', { count: models.length });
      return models;
    } catch (error) {
      logger.error('Failed to list Ollama models', { error });
      throw error;
    }
  }

  async chat(
    messages: OllamaChatMessage[],
    model?: string
  ): Promise<OllamaChatResponse> {
    try {
      const response = await this.client.post('/api/chat', {
        model: model || this.defaultModel,
        messages,
        stream: false,
      });

      logger.info('Ollama chat completed', {
        model: model || this.defaultModel,
        eval_count: response.data.eval_count,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to chat with Ollama', { error });
      throw error;
    }
  }

  async generate(
    prompt: string,
    model?: string
  ): Promise<OllamaGenerateResponse> {
    try {
      const response = await this.client.post('/api/generate', {
        model: model || this.defaultModel,
        prompt,
        stream: false,
      });

      logger.info('Ollama generate completed', {
        model: model || this.defaultModel,
        eval_count: response.data.eval_count,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to generate with Ollama', { error });
      throw error;
    }
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  static isConfigured(): boolean {
    return !!process.env.OLLAMA_BASE_URL;
  }
}
