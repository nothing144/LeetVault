const ENABLE_NETWORK_INTERCEPTION = true;

class LeetCodeDetector {
  constructor() {
    this.lastProcessedTime = 0;
    this.lastProcessedSlug = '';
    
    // DOM Fallback state
    this.observer = null;
    this.mutationTimeout = null;

    // Network Interception state
    this.networkBuffer = {
      code: null,
      language: null,
      slug: null,
      timestamp: 0,
      runtime: '',
      memory: ''
    };

    this.isNetworkListenerSetup = false;
  }

  /**
   * Starts observing for LeetCode submission results.
   * Initializes both the network interceptor (Main World) and the DOM fallback.
   */
  start() {
    if (ENABLE_NETWORK_INTERCEPTION) {
      this.injectNetworkInterceptors();
      this.setupNetworkListeners();
    }

    this.startDOMObserverFallback();
  }

  injectNetworkInterceptors() {
    if (document.getElementById('leetvault-network-injected')) return;

    // Inject parser and network interceptor into the Main World
    const scripts = ['src/leetcode/parser.js', 'src/leetcode/network.js'];
    
    // Inject scripts sequentially to guarantee dependency order
    const injectNext = (index) => {
      if (index >= scripts.length) return;
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(scripts[index]);
      if (index === 0) script.id = 'leetvault-network-injected';
      script.onload = function() { 
        this.remove(); 
        injectNext(index + 1);
      };
      (document.head || document.documentElement).appendChild(script);
    };
    
    injectNext(0);
  }

  setupNetworkListeners() {
    if (this.isNetworkListenerSetup) return;
    this.isNetworkListenerSetup = true;

    // 1. Buffer the code and language when a submission is made
    document.addEventListener('LeetVault:CodeSubmitted', (e) => {
      let detail = e.detail;
      if (typeof detail === 'string') {
        try { detail = JSON.parse(detail); } catch(err) { console.error("JSON parse failed", err); }
      }
      
      if (detail && detail.code && detail.language) {
        this.networkBuffer.code = detail.code;
        this.networkBuffer.language = detail.language;
        // Fix: Capture slug exactly at the moment of submission to avoid SPA routing race conditions
        const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
        this.networkBuffer.slug = match ? match[1] : '';
        this.networkBuffer.timestamp = Date.now();
      }
    });

    // 2. Trigger upload when the submission is Accepted
    document.addEventListener('LeetVault:SubmissionAccepted', async (e) => {
      const now = Date.now();
      
      // Fix: Use the buffered slug to guarantee we upload to the correct problem, even if the user navigated away.
      const currentSlug = this.networkBuffer.slug || (window.location.pathname.match(/\/problems\/([^\/]+)/)?.[1] || '');

      // Prevent duplicate triggers
      if (this.lastProcessedSlug === currentSlug && (now - this.lastProcessedTime < 10000)) {
        return; 
      }

      this.lastProcessedTime = now;
      this.lastProcessedSlug = currentSlug;

      if (this.networkBuffer.code) {
        // Prevent stale buffer contamination
        if (now - this.networkBuffer.timestamp > 60000) {
          console.warn("LeetVault: Stale network buffer detected and cleared. Falling back to DOM.");
          this.networkBuffer.code = null;
          this.networkBuffer.slug = null;
          this.networkBuffer.runtime = '';
          this.networkBuffer.memory = '';
          this.networkBuffer.timestamp = 0;
          this.onSubmissionAccepted();
          return;
        }

        let detail = e.detail;
        if (typeof detail === 'string') {
          try { detail = JSON.parse(detail); } catch(err) {}
        }

        // Store runtime and memory from the interceptor
        this.networkBuffer.runtime = detail && detail.runtime ? detail.runtime : '';
        this.networkBuffer.memory = detail && detail.memory ? detail.memory : '';

        await this.onNetworkSubmissionAccepted(currentSlug);
        
        // Clear buffer safely after consumption
        this.networkBuffer.code = null;
        this.networkBuffer.slug = null;
        this.networkBuffer.runtime = '';
        this.networkBuffer.memory = '';
        this.networkBuffer.timestamp = 0;
      } else {
        console.warn("[TRACE] >>> DOM FALLBACK selected from SubmissionAccepted listener (networkBuffer.code is empty)");
        this.onSubmissionAccepted();
        this.networkBuffer.timestamp = 0;
      }
    });
  }

  async populateMetadataAndUpload(extractedData) {
    if (window.LeetCodeGraphQL && extractedData.slug && extractedData.slug !== 'Unknown') {
      const metadata = await window.LeetCodeGraphQL.getProblemMetadata(extractedData.slug);
      if (metadata) {
        if (!extractedData.title || extractedData.title === 'Unknown') extractedData.title = metadata.title;
        if (!extractedData.difficulty || extractedData.difficulty === 'Unknown') extractedData.difficulty = metadata.difficulty;
        extractedData.tags = metadata.tags || [];
        extractedData.frontendId = metadata.frontendId || '';
        
        if (metadata.content && window.HtmlToMd) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = metadata.content;
          
          const problemDiv = document.createElement('div');
          const examplesDiv = document.createElement('div');
          const constraintsDiv = document.createElement('div');
          
          let currentState = 'problem'; 
          
          while (tempDiv.firstChild) {
            const node = tempDiv.firstChild;
            const text = (node.textContent || '').trim().toLowerCase();
            
            if (currentState === 'problem' && (text.startsWith('example 1') || text.startsWith('example:'))) {
              currentState = 'examples';
            } else if (currentState !== 'constraints' && text.startsWith('constraints:')) {
              currentState = 'constraints';
            }
            
            if (currentState === 'problem') problemDiv.appendChild(node);
            else if (currentState === 'examples') examplesDiv.appendChild(node);
            else if (currentState === 'constraints') constraintsDiv.appendChild(node);
          }
          
          extractedData.problemMd = window.HtmlToMd.convert(problemDiv);
          extractedData.examplesMd = window.HtmlToMd.convert(examplesDiv);
          extractedData.constraintsMd = window.HtmlToMd.convert(constraintsDiv);
        }
      }
    } else if (!window.LeetCodeGraphQL) {
      console.warn("LeetVault: LeetCodeGraphQL not found in window.");
    }

    chrome.runtime.sendMessage({ action: 'UPLOAD_SUBMISSION', data: extractedData });
  }

  async onNetworkSubmissionAccepted(slug) {
    const mappedLang = (window.LeetCodeParser && window.LeetCodeParser.normalizeLanguage) 
                       ? window.LeetCodeParser.normalizeLanguage(this.networkBuffer.language) 
                       : this.networkBuffer.language;

    const extractedData = {
      title: 'Unknown',
      slug: slug,
      frontendId: '',
      difficulty: 'Unknown',
      language: mappedLang,
      code: this.networkBuffer.code,
      tags: [],
      runtime: this.networkBuffer.runtime || '',
      memory: this.networkBuffer.memory || '',
      problemMd: '',
      examplesMd: '',
      constraintsMd: ''
    };

    await this.populateMetadataAndUpload(extractedData);
  }

  startDOMObserverFallback() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver(() => {
      if (this.mutationTimeout) clearTimeout(this.mutationTimeout);
      this.mutationTimeout = setTimeout(() => {
        this.checkForAcceptedSubmission();
      }, 500); 
    });
    
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  checkForAcceptedSubmission() {
    // 1. Duplicate Prevention
    // Check if we've processed an accepted submission for this specific problem recently.
    const now = Date.now();
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    const currentSlug = match ? match[1] : '';

    if (this.lastProcessedSlug === currentSlug && (now - this.lastProcessedTime < 10000)) {
      return; 
    }

    // 2. Locate Potential Success Elements
    // We search for elements with the exact text "Accepted".
    // We filter for leaf nodes (children === 0) to avoid matching giant container wrappers.
    const elements = Array.from(document.querySelectorAll('span, div, a, p')).filter(el => {
       return el.textContent.trim() === 'Accepted' && el.children.length === 0;
    });

    if (elements.length === 0) return;

    // 3. Contextual Verification (Stable Detection)
    // We verify this is actually the active submission result panel, not just a random string on the page.
    // We walk up the DOM tree looking for typical submission stats ("Runtime", "Memory", or "Beats").
    const isTrueSubmission = elements.some(el => {
       let parent = el.parentElement;
       let depth = 0;
       
       while (parent && depth < 12) { // Traverse up to 12 levels up
          const text = parent.textContent.toLowerCase();
          
          if (text.includes('runtime') || text.includes('memory') || text.includes('beats')) {
             return true; 
          }
          
          parent = parent.parentElement;
          depth++;
       }
       return false;
    });

    // 4. Trigger Action
    if (isTrueSubmission) {
       this.lastProcessedTime = now;
       this.lastProcessedSlug = currentSlug;
       if (this.networkBuffer.code && (now - this.networkBuffer.timestamp < 60000)) {
         this.onNetworkSubmissionAccepted(currentSlug);
         this.networkBuffer.code = null;
         this.networkBuffer.timestamp = 0;
       } else if (!ENABLE_NETWORK_INTERCEPTION || (this.networkBuffer.timestamp > 0 && (now - this.networkBuffer.timestamp < 60000))) {
         this.onSubmissionAccepted();
         this.networkBuffer.timestamp = 0;
       }
    }
  }

  async onSubmissionAccepted() {
    try {
      const extractedData = this.extractSubmissionData();
      await this.populateMetadataAndUpload(extractedData);
    } catch (err) {
      console.error("==> Error in onSubmissionAccepted:", err);
    }
  }

  extractSubmissionData() {
    const data = {
      title: 'Unknown',
      slug: 'Unknown',
      difficulty: 'Unknown',
      language: 'Unknown',
      code: '',
      tags: []
    };

    // 1. Extract Slug from URL
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    if (match) {
      data.slug = match[1];
    }

    // 2. Extract Problem Title
    // LeetCode sets the document title to something like "1. Two Sum - LeetCode"
    if (document.title) {
      data.title = document.title.split('-')[0].trim();
    }

    // 3. Extract Difficulty
    // The difficulty is usually a leaf node containing exactly Easy, Medium, or Hard
    const difficultyEl = Array.from(document.querySelectorAll('span, div, p')).find(el => 
      (el.textContent.trim() === 'Easy' || el.textContent.trim() === 'Medium' || el.textContent.trim() === 'Hard') &&
      el.children.length === 0
    );
    if (difficultyEl) {
      data.difficulty = difficultyEl.textContent.trim();
    }

    // 4. Extract Programming Language
    // Known languages used in LeetCode
    const knownLangs = ['C++', 'Java', 'Python', 'Python3', 'C', 'C#', 'JavaScript', 'TypeScript', 'PHP', 'Swift', 'Kotlin', 'Dart', 'Go', 'Ruby', 'Scala', 'Rust', 'Racket', 'Erlang', 'Elixir'];
    const langBtn = Array.from(document.querySelectorAll('button, div, span')).find(el => 
      knownLangs.includes(el.textContent.trim()) && el.children.length === 0
    );
    if (langBtn) {
      data.language = langBtn.textContent.trim();
    }

    // 5. Extract User Code
    // Code is typically inside the Monaco editor (.view-line) or static code blocks on submission view
    const codeLines = document.querySelectorAll('.view-line');
    if (codeLines.length > 0) {
      data.code = Array.from(codeLines).map(line => {
         // Replace non-breaking spaces with normal spaces to preserve standard indentation
         return line.textContent.replace(/\u00a0/g, ' ');
      }).join('\n');
    } else {
      // Fallback for older DOM structures or direct submission details view
      const codeTag = document.querySelector('code');
      if (codeTag) {
        data.code = codeTag.textContent;
      }
    }

    // Clean up invisible zero-width spaces often generated by Monaco
    data.code = data.code.replace(/\u200B/g, '');

    return data;
  }
}

// Initialize the detector when the script loads
const detector = new LeetCodeDetector();
detector.start();
