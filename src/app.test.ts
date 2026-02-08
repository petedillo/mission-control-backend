import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('./db/inventory', () => ({
  getHosts: vi.fn(),
  getWorkloads: vi.fn(),
}));

import { app } from './app';

async function getMockedInventory() {
  const inventoryModule = await import('./db/inventory');
  return inventoryModule as unknown as {
    getHosts: ReturnType<typeof vi.fn>;
    getWorkloads: ReturnType<typeof vi.fn>;
  };
}

describe('App route mounting', () => {
  it('GET /api/v1/inventory responds with 200', async () => {
    const inventory = await getMockedInventory();
    inventory.getHosts.mockResolvedValue([]);
    inventory.getWorkloads.mockResolvedValue([]);

    const response = await request(app).get('/api/v1/inventory');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        hosts: [],
        workloads: [],
      },
    });
  });
});
