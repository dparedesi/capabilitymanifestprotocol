import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Matcher } from '../../src/matcher.js';

describe('Matcher', () => {
  let matcher;

  beforeEach(() => {
    matcher = new Matcher();
  });

  describe('findIntent', () => {
    const intents = [
      {
        name: 'check_weather',
        patterns: [
          'check weather',
          're:weather in [a-z]+',
          'forecast'
        ]
      },
      {
        name: 'send_email',
        patterns: [
          'send email',
          'email to'
        ]
      }
    ];

    it('should find intent by exact substring match', () => {
      const result = matcher.findIntent(intents, 'please check weather for me');
      expect(result).toBeDefined();
      expect(result.name).toBe('check_weather');
    });

    it('should find intent by regex pattern match', () => {
      const result = matcher.findIntent(intents, 'weather in london');
      expect(result).toBeDefined();
      expect(result.name).toBe('check_weather');
    });

    it('should find intent by word overlap', () => {
      // "forecast" is in patterns. Input "what is the forecast" matches "forecast"
      const result = matcher.findIntent(intents, 'what is the forecast');
      expect(result).toBeDefined();
      expect(result.name).toBe('check_weather');
    });

    it('should return null when no intent matches', () => {
      const result = matcher.findIntent(intents, 'play some music');
      expect(result).toBeNull();
    });

    it('should handle complex word overlap with sufficient percentage', () => {
      // Pattern: "send email" -> words: ["send", "email"] (length 2)
      // Input: "i want to send a quick email" -> overlap: "send", "email" (2 matches)
      // 2 >= 2 * 0.5 is true.
      const result = matcher.findIntent(intents, 'i want to send a quick email');
      expect(result).toBeDefined();
      expect(result.name).toBe('send_email');
    });
  });

  describe('matchesSummary', () => {
    it('should detect keyword overlap', () => {
      const summary = 'A tool for managing database records';
      const intent = 'I need to manage my database';

      const result = matcher.matchesSummary(intent, summary);
      expect(result).toBe(true);
    });

    it('should ignore short words (<= 2 chars)', () => {
      const summary = 'go to the io';
      const intent = 'to go to io';

      // "go", "to", "io" are all length 2 or less
      const result = matcher.matchesSummary(intent, summary);
      expect(result).toBe(false);
    });

    it('should be case insensitive', () => {
      const summary = 'WEATHER FORECAST';
      const intent = 'weather forecast';

      const result = matcher.matchesSummary(intent, summary);
      expect(result).toBe(true);
    });

    it('should return false for no overlap', () => {
      const summary = 'image processing tool';
      const intent = 'text editing';

      const result = matcher.matchesSummary(intent, summary);
      expect(result).toBe(false);
    });
  });

  describe('match', () => {
    let mockRegistry;

    const weatherTool = {
      name: 'weather-cli',
      domain: 'weather',
      summary: 'Get weather forecasts and current conditions'
    };

    const weatherCapability = {
      intents: [
        {
          name: 'get_forecast',
          patterns: ['get forecast', 're:weather in .*']
        }
      ]
    };

    const todoTool = {
      name: 'todo-list',
      domain: 'productivity',
      summary: 'Manage your tasks and todo list'
    };

    const todoCapability = {
      intents: [
        {
          name: 'add_task',
          patterns: ['add task', 'create todo']
        }
      ]
    };

    beforeEach(() => {
      mockRegistry = {
        getAllManifests: vi.fn(),
        loadCapability: vi.fn()
      };
    });

    it('should return null if no tools match', async () => {
      mockRegistry.getAllManifests.mockReturnValue([weatherTool]);
      mockRegistry.loadCapability.mockResolvedValue(weatherCapability);

      const result = await matcher.match('play music', mockRegistry);
      expect(result).toBeNull();
    });

    it('should return a high score match for specific intent match', async () => {
      mockRegistry.getAllManifests.mockReturnValue([weatherTool]);
      mockRegistry.loadCapability.mockResolvedValue(weatherCapability);

      const result = await matcher.match('get forecast for London', mockRegistry);

      expect(result).toBeDefined();
      expect(result.tool).toBe(weatherTool);
      expect(result.intent.name).toBe('get_forecast');
      expect(result.score).toBe(1.0);
    });

    it('should return a lower score match for summary only match', async () => {
      mockRegistry.getAllManifests.mockReturnValue([weatherTool]);
      // Simulate capability loading failure or no intent match inside capability
      mockRegistry.loadCapability.mockResolvedValue({ intents: [] });

      // "conditions" matches "conditions" in summary
      const result = await matcher.match('check conditions', mockRegistry);

      expect(result).toBeDefined();
      expect(result.tool).toBe(weatherTool);
      expect(result.score).toBe(0.5);
      expect(result.intent).toBeUndefined();
    });

    it('should handle ambiguous matches', async () => {
      // Two tools that both match via summary "manage"
      const tool1 = { ...todoTool, name: 'tool1', summary: 'manage stuff' };
      const tool2 = { ...todoTool, name: 'tool2', summary: 'manage things' };

      mockRegistry.getAllManifests.mockReturnValue([tool1, tool2]);
      mockRegistry.loadCapability.mockResolvedValue({ intents: [] });

      const result = await matcher.match('manage', mockRegistry);

      expect(result).toBeDefined();
      expect(result.ambiguous).toBe(true);
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map(c => c.tool)).toContain('tool1');
      expect(result.candidates.map(c => c.tool)).toContain('tool2');
    });

    it('should prioritize intent match over summary match', async () => {
      // Tool 1 has intent match (score 1.0)
      // Tool 2 has summary match (score 0.5)
      mockRegistry.getAllManifests.mockReturnValue([weatherTool, todoTool]);

      mockRegistry.loadCapability.mockImplementation(async (tool) => {
        if (tool.name === 'weather-cli') return weatherCapability;
        return { intents: [] };
      });

      // "weather" matches intent in weatherCapability and summary in weatherTool
      // but let's make sure we test priority.
      // Input "weather" matches regex `re:weather in .*`? No, that regex requires " in ".
      // Wait, let's use a query that matches intent for one and summary for another clearly.

      // Let's refine the test data for clarity in this specific test
      const t1 = { name: 't1', summary: 'foo' };
      const t2 = { name: 't2', summary: 'bar' };

      mockRegistry.getAllManifests.mockReturnValue([t1, t2]);
      mockRegistry.loadCapability.mockImplementation(async (tool) => {
        if (tool.name === 't1') return { intents: [{ name: 'i1', patterns: ['match me'] }] }; // Score 1.0
        if (tool.name === 't2') return { intents: [] }; // Score will be 0.5 if summary matches
      });

      // "match me" matches t1 intent.
      // "match me" has no overlap with t2 summary "bar".
      // This doesn't test priority against a competing summary match.

      // Let's force a summary match for t2
      const t3 = { name: 't3', summary: 'match me' };
      mockRegistry.getAllManifests.mockReturnValue([t1, t3]);
       mockRegistry.loadCapability.mockImplementation(async (tool) => {
        if (tool.name === 't1') return { intents: [{ name: 'i1', patterns: ['match me'] }] };
        return { intents: [] };
      });

      const result = await matcher.match('match me', mockRegistry);
      expect(result).toBeDefined();
      expect(result.tool.name).toBe('t1');
      expect(result.score).toBe(1.0);
    });

    it('should handle capability loading errors gracefully', async () => {
      mockRegistry.getAllManifests.mockReturnValue([weatherTool]);
      mockRegistry.loadCapability.mockRejectedValue(new Error('Load failed'));

      // Should still try to match summary
      const result = await matcher.match('weather', mockRegistry);
      expect(result).toBeDefined();
      expect(result.tool).toBe(weatherTool);
      expect(result.score).toBe(0.5);
    });
  });
});
