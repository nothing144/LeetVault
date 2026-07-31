class GitHubAPI {
  /**
   * Core helper to construct and send requests to the GitHub REST API.
   * Injects the necessary Authentication and Accept headers.
   */
  static async _request(endpoint, method = 'GET', token, body = null) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const maxRetries = 3;
    let attempt = 0;
    
    // Extract debugging details from endpoint
    const match = endpoint.match(/\/repos\/([^\/]+)\/([^\/]+)(?:\/contents\/(.+))?/);
    const repoOwner = match ? match[1] : 'Unknown';
    const repoName = match ? match[2] : 'Unknown';
    const targetPath = match && match[3] ? match[3] : 'N/A';

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(`https://api.github.com${endpoint}`, options);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const status = response.status;
          
          // Retry on Rate Limiting or Server Errors
          if ([429, 500, 502, 503].includes(status) && attempt < maxRetries) {
            attempt++;
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          
          // Do not retry 401, 403, 404, 422, etc. (Authentication/Permission/Validation)
          const errorMsg = data.message ? `HTTP ${status}: ${data.message}` : `GitHub API Error: ${status} ${response.statusText}`;
          const err = new Error(errorMsg);
          err.status = status;
          throw err;
        }

        return data;
      } catch (error) {
        console.groupCollapsed(`LeetVault GitHub API Request: ${method} ${endpoint} (Attempt ${attempt + 1})`);
        console.error(`Request Failed:`, error);
        console.groupEnd();
        
        // TypeError indicates a network failure (e.g. DNS, offline)
        if (error.name === 'TypeError' && attempt < maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        throw error;
      }
    }
  }

  /**
   * Detect if a file already exists in the repository.
   * @returns {string|null} - The file's SHA if it exists, otherwise null.
   */
  static async getFileSha(username, repo, path, token) {
    try {
      const endpoint = `/repos/${username}/${repo}/contents/${path}`;
      const data = await this._request(endpoint, 'GET', token);
      
      return data.sha || null;
    } catch (error) {
      // 404 means the file doesn't exist yet, which is a normal state for creation.
      if (error.status === 404 || (error.message && error.message.includes('404')) || (error.message && error.message.includes('Not Found'))) {
        return null;
      }
      // Re-throw authentication, rate limit, or network errors
      throw error; 
    }
  }

  /**
   * Safely encodes a UTF-8 string to Base64, avoiding deprecated unescape()
   */
  static _utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    const CHUNK_SIZE = 8192; // Process 8KB chunks to avoid 'Maximum call stack size exceeded'
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      binary += String.fromCharCode.apply(null, bytes.slice(i, i + CHUNK_SIZE));
    }
    return btoa(binary);
  }

  /**
   * Create a new file or update an existing one if it already exists.
   * Handles base64 encoding and automatically resolves the file SHA for updates.
   */
  static async createOrUpdateFile(username, repo, path, content, commitMessage, token) {
    try {
      // 1. Detect if the file already exists
      const existingSha = await this.getFileSha(username, repo, path, token);

      // 2. Base64 encode the content (supports UTF-8 encoding safely without unescape)
      const encodedContent = this._utf8ToBase64(content);

      const body = {
        message: commitMessage,
        content: encodedContent
      };

      // 3. If updating an existing file, the GitHub API requires the old file's SHA
      if (existingSha) {
        body.sha = existingSha;
      }

      // 4. Push the commit
      const endpoint = `/repos/${username}/${repo}/contents/${path}`;
      const data = await this._request(endpoint, 'PUT', token, body);
      
      return {
        success: true,
        commitUrl: data.commit.html_url,
        action: existingSha ? 'updated' : 'created'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if the user has access to the specified repository.
   * Useful for initial validation when saving settings.
   */
  static async verifyRepositoryAccess(username, repo, token) {
    try {
       const endpoint = `/repos/${username}/${repo}`;
       await this._request(endpoint, 'GET', token);
       return { success: true };
    } catch(error) {
       return { 
         success: false, 
         error: error.message 
       };
    }
  }

  /**
   * Performs a one-time scan of the repository root to count existing problem folders.
   * Looks for directories whose names start with a digit (e.g. '1-two-sum').
   */
  static async getSyncedProblemsCount(username, repo, token) {
    try {
      const endpoint = `/repos/${username}/${repo}/contents/`;
      const contents = await this._request(endpoint, 'GET', token);
      
      if (!Array.isArray(contents)) {
        return { success: true, count: 0 };
      }

      // Count directories that start with a digit
      const count = contents.filter(item => 
        item.type === 'dir' && /^\d+-/.test(item.name)
      ).length;

      return { success: true, count };
    } catch(error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}
