/**
 * Ollama Connector Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OllamaConnector } from './ollama';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}));

const mockedAxios = axios as any;

describe('OllamaConnector', () => {
  let connector: OllamaConnector;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockClient);

    connector = new OllamaConnector(
      'http://ollama.test:11434',
      'mistral'
    );
  });

  describe('initialization', () => {
    it('should initialize with provided URL and model', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://ollama.test:11434',
          timeout: 120000,
        })
      );
    });

    it('should return the default model', () => {
      expect(connector.getDefaultModel()).toBe('mistral');
    });

    it('should use environment variables as fallback', () => {
      process.env.OLLAMA_BASE_URL = 'http://env-ollama:11434';
      process.env.OLLAMA_MODEL = 'llama3';

      const connector2 = new OllamaConnector();
      expect(mockedAxios.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          baseURL: 'http://env-ollama:11434',
        })
      );
      expect(connector2.getDefaultModel()).toBe('llama3');

      delete process.env.OLLAMA_BASE_URL;
      delete process.env.OLLAMA_MODEL;
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockClient.get.mockResolvedValueOnce({ data: { models: [] } });

      const result = await connector.testConnection();
      expect(result).toBe(true);
      expect(mockClient.get).toHaveBeenCalledWith('/api/tags');
    });

    it('should return false on connection failure', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await connector.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should retrieve all models', async () => {
      const mockModels = [
        {
          name: 'mistral:latest',
          modified_at: '2024-01-01T00:00:00Z',
          size: 4000000000,
          digest: 'abc123',
          details: { family: 'mistral', parameter_size: '7B' },
        },
        {
          name: 'llama3:latest',
          modified_at: '2024-01-02T00:00:00Z',
          size: 8000000000,
          digest: 'def456',
        },
      ];

      mockClient.get.mockResolvedValueOnce({ data: { models: mockModels } });

      const result = await connector.listModels();
      expect(result).toEqual(mockModels);
      expect(result.length).toBe(2);
      expect(mockClient.get).toHaveBeenCalledWith('/api/tags');
    });

    it('should return empty array if no models', async () => {
      mockClient.get.mockResolvedValueOnce({ data: {} });

      const result = await connector.listModels();
      expect(result).toEqual([]);
    });

    it('should throw on API error', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(connector.listModels()).rejects.toThrow('API Error');
    });
  });

  describe('chat', () => {
    it('should send chat messages and return response', async () => {
      const mockResponse = {
        model: 'mistral',
        message: { role: 'assistant', content: 'Hello! How can I help?' },
        done: true,
        eval_count: 10,
      };

      mockClient.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await connector.chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith('/api/chat', {
        model: 'mistral',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      });
    });

    it('should use custom model when specified', async () => {
      const mockResponse = {
        model: 'llama3',
        message: { role: 'assistant', content: 'Hi!' },
        done: true,
      };

      mockClient.post.mockResolvedValueOnce({ data: mockResponse });

      await connector.chat(
        [{ role: 'user', content: 'Hello' }],
        'llama3'
      );

      expect(mockClient.post).toHaveBeenCalledWith('/api/chat', {
        model: 'llama3',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      });
    });

    it('should throw on chat failure', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('Model not found'));

      await expect(
        connector.chat([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow('Model not found');
    });
  });

  describe('generate', () => {
    it('should generate text from a prompt', async () => {
      const mockResponse = {
        model: 'mistral',
        response: 'Generated text output',
        done: true,
        eval_count: 15,
      };

      mockClient.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await connector.generate('Write a poem');

      expect(result).toEqual(mockResponse);
      expect(mockClient.post).toHaveBeenCalledWith('/api/generate', {
        model: 'mistral',
        prompt: 'Write a poem',
        stream: false,
      });
    });

    it('should use custom model when specified', async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { model: 'llama3', response: 'Output', done: true },
      });

      await connector.generate('Hello', 'llama3');

      expect(mockClient.post).toHaveBeenCalledWith('/api/generate', {
        model: 'llama3',
        prompt: 'Hello',
        stream: false,
      });
    });

    it('should throw on generate failure', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('Inference error'));

      await expect(connector.generate('Hello')).rejects.toThrow(
        'Inference error'
      );
    });
  });

  describe('isConfigured', () => {
    it('should return true when env var is set', () => {
      process.env.OLLAMA_BASE_URL = 'http://ollama.test:11434';
      expect(OllamaConnector.isConfigured()).toBe(true);
      delete process.env.OLLAMA_BASE_URL;
    });

    it('should return false when env var is missing', () => {
      delete process.env.OLLAMA_BASE_URL;
      expect(OllamaConnector.isConfigured()).toBe(false);
    });
  });
});
