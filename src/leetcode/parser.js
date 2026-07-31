/**
 * src/leetcode/parser.js
 * Responsibilities: Safely parse intercepted JSON payloads and normalize LeetCode data.
 */
const LeetCodeParser = {
  // Architectural Assumption: Submit requests are routed to /problems/<slug>/submit/
  SUBMIT_REGEX: /\/problems\/[^\/]+\/submit\/?/,
  // Architectural Assumption: Status checks are routed to /submissions/detail/<id>/check/
  CHECK_REGEX: /\/submissions\/detail\/\d+\/check\/?/,

  /**
   * Safely parses the submission request body to extract the language and code.
   * Assumption: The payload contains 'lang' and 'typed_code' keys.
   *
   * @param {string} bodyString - The raw stringified JSON body from the fetch/XHR payload.
   * @returns {{language: string, code: string}|null} - The parsed data, or null on invalid/malformed input.
   */
  parseSubmitPayload: (bodyString) => {
    if (typeof bodyString !== 'string') return null;
    
    try {
      const parsed = JSON.parse(bodyString);
      if (parsed && typeof parsed.lang === 'string' && typeof parsed.typed_code === 'string') {
        return {
          language: parsed.lang,
          code: parsed.typed_code
        };
      }
    } catch (e) {
      // Safely ignore malformed JSON without throwing exceptions
      console.warn("LeetVault Parser Error (parseSubmitPayload):", e);
    }
    return null; // Return null if schema validation or parsing fails
  },

  /**
   * Safely parses the polling response to determine if the submission was accepted,
   * and extracts runtime and memory metrics.
   *
   * @param {string} bodyString - The raw stringified JSON response from the server.
   * @returns {{runtime: string, memory: string}|false|null} - The metrics if accepted, false if not, or null on malformed JSON.
   */
  isAccepted: (bodyString) => {
    if (typeof bodyString !== 'string') return null;

    try {
      const parsed = JSON.parse(bodyString);
      if (parsed && typeof parsed.status_msg === 'string') {
        if (parsed.status_msg === 'Accepted') {
          return {
            runtime: parsed.status_runtime || '',
            memory: parsed.status_memory || ''
          };
        }
      }
      return false; // Valid JSON, but not accepted
    } catch (e) {
      // Safely ignore malformed JSON
      console.warn("LeetVault Parser Error (isAccepted):", e);
      return null;
    }
  },

  /**
   * Normalizes LeetCode's internal language slugs to standard human-readable names.
   * 
   * @param {string} slug - The language slug (e.g., 'python3', 'cpp').
   * @returns {string} - The normalized language name, or the original slug if unmapped.
   */
  normalizeLanguage: (slug) => {
    if (typeof slug !== 'string') return '';

    const map = {
      'cpp': 'C++',
      'java': 'Java',
      'python': 'Python',
      'python3': 'Python3',
      'c': 'C',
      'csharp': 'C#',
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'php': 'PHP',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'dart': 'Dart',
      'golang': 'Go',
      'ruby': 'Ruby',
      'scala': 'Scala',
      'rust': 'Rust',
      'racket': 'Racket',
      'erlang': 'Erlang',
      'elixir': 'Elixir'
    };
    
    return map[slug] || slug;
  }
};

// Export to window so it is accessible in both the Main World (network.js) 
// and the Isolated World (content.js) depending on injection method.
if (typeof window !== 'undefined') {
  window.LeetCodeParser = LeetCodeParser;
}
