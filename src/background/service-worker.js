// Import the GitHubAPI class helper
// The path is relative to where service-worker.js is located (src/background/)
importScripts('../utils/github-api.js');

// Map LeetCode language names to proper file extensions
const LANGUAGE_EXTENSIONS = {
  'Python': '.py',
  'Python3': '.py',
  'Java': '.java',
  'C++': '.cpp',
  'C': '.c',
  'C#': '.cs',
  'JavaScript': '.js',
  'TypeScript': '.ts',
  'PHP': '.php',
  'Swift': '.swift',
  'Kotlin': '.kt',
  'Dart': '.dart',
  'Go': '.go',
  'Ruby': '.rb',
  'Scala': '.scala',
  'Rust': '.rs',
  'Racket': '.rkt',
  'Erlang': '.erl',
  'Elixir': '.ex'
};

// Add a lock mechanism to prevent race conditions and duplicate simultaneous uploads
const uploadLocks = new Set();

// Helper to show Chrome notifications
function showNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: '../assets/icons/icon128.png',
    title: title,
    message: message
  });
}

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // SECURITY: Validate message origin to prevent spoofed uploads from unauthorized frames/domains
  if (!sender.url || !sender.url.startsWith('https://leetcode.com/')) {
    console.warn('LeetVault: Dropped unauthorized message from origin', sender.url);
    return;
  }

  if (message.action === 'UPLOAD_SUBMISSION') {
    // Process asynchronously without holding up the message channel
    handleSubmissionUpload(message.data);
  }
});

async function handleSubmissionUpload(data) {
  // Prevent duplicate concurrent uploads for the same problem (Race Condition Fix)
  if (uploadLocks.has(data.slug)) {
    return;
  }
  uploadLocks.add(data.slug);

  try {
    await processUpload(data);
  } finally {
    uploadLocks.delete(data.slug);
  }
}

async function processUpload(data) {
  // 1. Get credentials from storage
  const storageData = await chrome.storage.sync.get(['githubUsername', 'githubToken', 'repoName']);
  
  const { githubUsername, githubToken, repoName } = storageData;

  // Abort if the user hasn't configured the extension yet
  if (!githubUsername || !githubToken || !repoName) {
    console.error("LeetVault: Missing GitHub credentials. Please configure them in the popup.");
    showNotification('leetvault-error', 'LeetVault Error', 'Missing GitHub credentials. Please configure them in the extension popup.');
    return;
  }

  // SECURITY: Prevent Path Traversal (e.g. slug = "../../../")
  const sanitizedSlug = String(data.slug || 'unknown').replace(/[^a-zA-Z0-9-]/g, '');
  const folderName = data.frontendId ? `${data.frontendId}-${sanitizedSlug}` : sanitizedSlug;
  const folderPath = folderName;
  
  // SECURITY: Language maps to a strict allowlist dictionary, preventing arbitrary file extension injection
  const extension = LANGUAGE_EXTENSIONS[data.language] || '.txt';
  
  const readmePath = `${folderPath}/README.md`;
  const codePath = `${folderPath}/solution${extension}`;

  // SECURITY: Basic sanitization for Markdown injection
  const sanitizeStr = (str) => String(str).replace(/[<>\[\]]/g, '');
  const safeTitle = sanitizeStr(data.title);
  const safeDifficulty = sanitizeStr(data.difficulty);
  const safeLanguage = sanitizeStr(data.language);

  // 3. Prepare the contents
  let readmeContent = '';

  // Title & Frontend ID
  if (data.frontendId && safeTitle) {
    readmeContent += `# ${data.frontendId}. ${safeTitle}\n\n`;
  } else if (safeTitle) {
    readmeContent += `# ${safeTitle}\n\n`;
  }

  // Difficulty Badge
  if (safeDifficulty && safeDifficulty !== 'Unknown') {
    const badges = { 'Easy': '🟢', 'Medium': '🟠', 'Hard': '🔴' };
    readmeContent += `${badges[safeDifficulty] || ''} ${safeDifficulty}\n\n`;
  }

  // URL
  if (data.slug && data.slug !== 'Unknown') {
    readmeContent += `https://leetcode.com/problems/${sanitizedSlug}/\n\n`;
  }

  // Tags
  if (data.tags && data.tags.length > 0) {
    const tagsMarkdown = data.tags.map(tag => `\`${sanitizeStr(tag)}\``).join(', ');
    readmeContent += `**Tags:** ${tagsMarkdown}\n\n`;
  }

  readmeContent += `---\n\n`;

  // The Problem Statement
  if (data.problemMd) {
    readmeContent += `## Problem\n\n${data.problemMd}\n\n---\n\n`;
  }

  // Examples
  if (data.examplesMd) {
    readmeContent += `## Examples\n\n${data.examplesMd}\n\n---\n\n`;
  }

  // Constraints
  if (data.constraintsMd) {
    readmeContent += `## Constraints\n\n${data.constraintsMd}\n\n---\n\n`;
  }

  // Dynamic Table
  let tableRows = '';
  if (safeLanguage && safeLanguage !== 'Unknown') tableRows += `| Language | ${safeLanguage} |\n`;
  if (data.runtime) tableRows += `| Runtime | ${data.runtime} |\n`;
  if (data.memory) tableRows += `| Memory | ${data.memory} |\n`;
  
  const dateStr = new Date().toUTCString();
  tableRows += `| Submission Date | ${dateStr} |\n`;

  if (tableRows.length > 0) {
    readmeContent += `## Submission Information\n\n| Field | Value |\n|-------|-------|\n${tableRows}\n---\n\n`;
  }

  readmeContent += `Generated automatically by **LeetVault** 🚀`;
  const codeContent = data.code;
  const commitMessage = `Automated Sync: ${safeTitle} (${safeLanguage})`;

  showNotification('leetvault-uploading', 'LeetVault', `Uploading solution for ${safeTitle}...`);
  chrome.runtime.sendMessage({ action: 'STATUS_UPDATE', status: 'Uploading...' }).catch(() => {});
  chrome.storage.local.set({ currentStatus: 'Uploading...' });

  // 4. Upload README.md
  // We use the previously implemented createOrUpdateFile which handles SHA detection safely
  const readmeResult = await GitHubAPI.createOrUpdateFile(
    githubUsername, 
    repoName, 
    readmePath, 
    readmeContent, 
    `Docs: Add README for ${data.title}`, 
    githubToken
  );

  if (!readmeResult.success) {
    console.error("LeetVault README Upload Failed:", readmeResult.error);
    showNotification('leetvault-error', 'Upload Failed', `Failed to upload README: ${readmeResult.error.message || readmeResult.error}`);
    chrome.runtime.sendMessage({ action: 'STATUS_UPDATE', status: 'Upload Failed' }).catch(() => {});
    chrome.storage.local.set({ currentStatus: 'Upload Failed' });
    // Halt if README fails (e.g., auth error) to prevent a broken sync
    return; 
  }
  

  // 5. Upload Code File
  const codeResult = await GitHubAPI.createOrUpdateFile(
    githubUsername, 
    repoName, 
    codePath, 
    codeContent, 
    commitMessage, 
    githubToken
  );

  if (!codeResult.success) {
    console.error("LeetVault Code Upload Failed:", codeResult.error);
    showNotification('leetvault-error', 'Upload Failed', `Failed to upload Code: ${codeResult.error.message || codeResult.error}`);
    chrome.runtime.sendMessage({ action: 'STATUS_UPDATE', status: 'Upload Failed' }).catch(() => {});
    chrome.storage.local.set({ currentStatus: 'Upload Failed' });
    return;
  }

  showNotification('leetvault-success', 'Upload Successful', `Successfully synced ${data.title} to GitHub!`);
  
  chrome.storage.local.get(['problemsSynced', 'currentStreak', 'lastSolvedDate'], (res) => {
    let newCount = res.problemsSynced || 0;
    let streak = res.currentStreak || 0;
    let lastSolvedDate = res.lastSolvedDate;

    if (codeResult.action === 'created') {
      newCount += 1;

      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!lastSolvedDate) {
        streak = 1;
        lastSolvedDate = todayStr;
      } else if (lastSolvedDate !== todayStr) {
        const [ly, lm, ld] = lastSolvedDate.split('-').map(Number);
        const lastMidnight = new Date(ly, lm - 1, ld);
        
        const [ty, tm, td] = todayStr.split('-').map(Number);
        const todayMidnight = new Date(ty, tm - 1, td);

        const msDiff = todayMidnight - lastMidnight;
        
        if (msDiff > 0) {
          const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));
          if (daysDiff === 1) {
            streak += 1;
          } else {
            streak = 1;
          }
          lastSolvedDate = todayStr;
        }
        // If msDiff < 0, it means lastSolvedDate is in the future. We do not increment or reset the streak.
      }
    }

    chrome.storage.local.set({
      problemsSynced: newCount,
      currentStreak: streak,
      lastSolvedDate: lastSolvedDate,
      lastSyncTime: Date.now(),
      currentStatus: 'Upload Successful',
      lastProblem: {
        title: data.title,
        slug: data.slug,
        frontendId: data.frontendId
      }
    }, () => {
      chrome.runtime.sendMessage({ action: 'STATUS_UPDATE', status: 'Upload Successful' }).catch(() => {});
    });
  });
}
