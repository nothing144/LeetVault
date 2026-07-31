/**
 * src/leetcode/graphql.js
 * Responsibilities: GraphQL requests, CSRF handling, and highly-structured metadata retrieval.
 */
class LeetCodeGraphQL {
  // Architectural Assumption: The primary GraphQL API is universally mounted at /graphql
  static GRAPHQL_URL = '/graphql';

  /**
   * Extracts the CSRF token from document.cookie.
   * Architectural Assumption: LeetCode uses Django-style CSRF verification where the token 
   * is stored in a cookie named "csrftoken" and must be passed in the "x-csrftoken" header.
   * 
   * @returns {string} The CSRF token, or empty string if unavailable.
   */
  static getCsrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  /**
   * Fetches problem metadata directly from LeetCode's GraphQL API.
   * Architectural Assumption: Executing the query 'questionTitle' with variables {titleSlug} 
   * returns a rigid schema: { data: { question: { title, difficulty, topicTags: [{name}] } } }.
   *
   * @param {string} slug - The problem slug extracted from the URL.
   * @returns {Promise<{title: string, difficulty: string, tags: string[]}|null>} 
   *          A structured object containing the exact metadata, or null on any failure.
   */
  static async getProblemMetadata(slug) {
    if (!slug) return null;

    try {
      const response = await fetch(this.GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrftoken': this.getCsrfToken()
        },
        body: JSON.stringify({
          // We strictly request only the fields we need: title, difficulty, topic tags, frontend ID, and raw HTML content.
          query: "query questionTitle($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title difficulty content topicTags { name } } }",
          variables: { titleSlug: slug }
        })
      });

      // Handle non-200 HTTP statuses (like 403 CSRF failures) gracefully
      if (!response.ok) {
        return null; 
      }

      const json = await response.json();
      
      // Strict null-checking deeply into the expected GraphQL schema
      if (json && json.data && json.data.question) {
        const question = json.data.question;
        
        // Safely extract tags, ensuring it resolves to a flat string array
        const tags = Array.isArray(question.topicTags) 
                     ? question.topicTags.map(tag => tag.name) 
                     : [];

        // Return a strictly structured object
        return {
          frontendId: question.questionFrontendId || '',
          title: question.title || '',
          difficulty: question.difficulty || '',
          content: question.content || '',
          tags: tags
        };
      }
    } catch (e) {
      // Gracefully catch all network disconnects, CORS errors, or JSON parsing failures.
      // Returning null signals the caller to use its DOM scraping fallback without crashing.
      console.warn("LeetVault GraphQL Error:", e);
    }
    
    return null;
  }
}

// Export for availability in the Isolated World (where content.js executes)
if (typeof window !== 'undefined') {
  window.LeetCodeGraphQL = LeetCodeGraphQL;
}
