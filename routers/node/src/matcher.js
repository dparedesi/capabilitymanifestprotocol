/**
 * Matcher - Intent matching logic
 */

export class Matcher {
  /**
   * Match an intent string to a registered tool
   */
  async match(intentStr, registry) {
    const normalizedIntent = intentStr.toLowerCase().trim();
    const candidates = [];

    // Check all tools for matching patterns
    for (const tool of registry.getAllManifests()) {
      // First, check if intent matches domain keywords in summary
      if (this.matchesSummary(normalizedIntent, tool.summary)) {
        candidates.push({ tool, score: 0.5 });
      }

      // Then, try to load and match against capability patterns
      try {
        const capability = await registry.loadCapability(tool);
        const intentMatch = this.findIntent(capability.intents, normalizedIntent);

        if (intentMatch) {
          candidates.push({ tool, intent: intentMatch, score: 1.0 });
        }
      } catch {
        // Capability not available, skip
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // If top two scores are equal, it's ambiguous
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
      return {
        ambiguous: true,
        candidates: candidates.map(c => ({
          tool: c.tool.name,
          domain: c.tool.domain
        }))
      };
    }

    return candidates[0];
  }

  /**
   * Check if intent matches tool summary keywords
   */
  matchesSummary(intent, summary) {
    const summaryWords = summary.toLowerCase().split(/\W+/);
    const intentWords = intent.split(/\W+/);

    // Simple keyword overlap
    const overlap = intentWords.filter(word =>
      summaryWords.includes(word) && word.length > 2
    );

    return overlap.length >= 1;
  }

  /**
   * Find a matching intent within a capability's intents
   */
  findIntent(intents, intentStr) {
    const normalized = intentStr.toLowerCase().trim();

    for (const intent of intents) {
      for (const pattern of intent.patterns) {
        // Check for regex pattern
        if (pattern.startsWith('re:')) {
          const regex = new RegExp(pattern.slice(3), 'i');
          if (regex.test(normalized)) {
            return intent;
          }
          continue;
        }

        // Substring match
        const normalizedPattern = pattern.toLowerCase();
        if (normalized.includes(normalizedPattern) ||
            normalizedPattern.includes(normalized)) {
          return intent;
        }

        // Word overlap match
        const patternWords = normalizedPattern.split(/\W+/);
        const intentWords = normalized.split(/\W+/);
        const overlap = patternWords.filter(w =>
          intentWords.includes(w) && w.length > 2
        );

        if (overlap.length >= patternWords.length * 0.5) {
          return intent;
        }
      }
    }

    return null;
  }
}

export default Matcher;
