document.addEventListener('DOMContentLoaded', () => {
  // Settings Form Elements
  const usernameInput = document.getElementById('github-username');
  const tokenInput = document.getElementById('github-token');
  const repoInput = document.getElementById('repo-name');
  const saveBtn = document.getElementById('save-btn');
  const statusLabel = document.getElementById('status-label');
  
  // View Elements
  const dashboardView = document.getElementById('dashboard-view');
  const settingsView = document.getElementById('settings-view');
  
  // Dashboard Elements
  const connectionBadge = document.getElementById('connection-badge');
  const dashUsername = document.getElementById('dash-username');
  const dashRepo = document.getElementById('dash-repo');
  const openRepoBtn = document.getElementById('open-repo-btn');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const backBtn = document.getElementById('back-btn');
  const refreshStatsBtn = document.getElementById('refresh-stats-btn');

  // New Status/Stats Elements
  const dashStreak = document.getElementById('dash-streak');
  const dashSynced = document.getElementById('dash-synced');
  const dashLastSync = document.getElementById('dash-last-sync');
  const extensionStatus = document.getElementById('extension-status');

  let currentRepoUrl = '';

  // Utility to format time
  function formatRelativeTime(timestamp) {
    if (!timestamp) return '--';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  function updateStatusIndicator(status) {
    extensionStatus.textContent = status || 'Ready';
    if (status === 'Uploading...') {
      extensionStatus.className = 'badge loading';
    } else if (status === 'Upload Successful' || status === 'Ready') {
      extensionStatus.className = 'badge online';
    } else if (status === 'Upload Failed' || status === 'GitHub Not Configured' || status === 'Connection Error') {
      extensionStatus.className = 'badge offline';
    } else {
      extensionStatus.className = 'badge neutral';
    }
  }

  // Listen for broadcast messages from service-worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'STATUS_UPDATE') {
      updateStatusIndicator(message.status);
      if (message.status === 'Upload Successful') {
        // Refresh local data to show new count and timestamp
        loadData();
      }
    }
  });

  // Load saved values and render dashboard
  function loadData() {
    chrome.storage.sync.get(['githubUsername', 'githubToken', 'repoName'], (syncResult) => {
      chrome.storage.local.get(['problemsSynced', 'lastSyncTime', 'currentStatus', 'currentStreak', 'repoValidationCache'], async (localResult) => {
        const hasConfig = syncResult.githubUsername && syncResult.githubToken && syncResult.repoName;
        
        // Populate Settings Inputs
        if (syncResult.githubUsername) usernameInput.value = syncResult.githubUsername;
        if (syncResult.githubToken) tokenInput.value = syncResult.githubToken;
        if (syncResult.repoName) repoInput.value = syncResult.repoName;

        // Set Last Sync Time
        dashLastSync.textContent = formatRelativeTime(localResult.lastSyncTime);
        
        // Set Current Streak
        dashStreak.textContent = localResult.currentStreak || 0;
        
        // Set Current Status
        if (!hasConfig) {
          updateStatusIndicator('GitHub Not Configured');
        } else {
          updateStatusIndicator(localResult.currentStatus || 'Ready');
        }

        if (hasConfig) {
          dashUsername.textContent = syncResult.githubUsername;
          dashRepo.textContent = syncResult.repoName;
          currentRepoUrl = `https://github.com/${syncResult.githubUsername}/${syncResult.repoName}`;
          openRepoBtn.disabled = false;

          // 1. Initial counter load (one-time GitHub query if problemsSynced is missing)
          if (localResult.problemsSynced === undefined) {
            dashSynced.textContent = 'Loading...';
            const countResult = await GitHubAPI.getSyncedProblemsCount(
              syncResult.githubUsername,
              syncResult.repoName,
              syncResult.githubToken
            );
            
            if (countResult.success) {
              dashSynced.textContent = countResult.count;
              chrome.storage.local.set({ problemsSynced: countResult.count });
            } else {
              dashSynced.textContent = 'Error';
            }
          } else {
            dashSynced.textContent = localResult.problemsSynced;
          }

          // 2. Validate Repository with Cache (5 minutes)
          const now = Date.now();
          const cache = localResult.repoValidationCache || {};
          const cacheKey = `${syncResult.githubUsername}/${syncResult.repoName}`;
          
          if (cache[cacheKey] && (now - cache[cacheKey].timestamp < 300000)) {
            // Use cached validation result
            if (cache[cacheKey].valid) {
              connectionBadge.textContent = 'Connected';
              connectionBadge.className = 'badge online';
            } else {
              connectionBadge.textContent = 'Invalid Repository';
              connectionBadge.className = 'badge offline';
              updateStatusIndicator('Connection Error');
            }
          } else {
            // Fetch and validate
            connectionBadge.textContent = 'Checking...';
            connectionBadge.className = 'badge neutral';
            
            const validation = await GitHubAPI.verifyRepositoryAccess(
              syncResult.githubUsername,
              syncResult.repoName,
              syncResult.githubToken
            );

            cache[cacheKey] = {
              valid: validation.success,
              timestamp: now
            };
            chrome.storage.local.set({ repoValidationCache: cache });

            if (validation.success) {
              connectionBadge.textContent = 'Connected';
              connectionBadge.className = 'badge online';
            } else {
              connectionBadge.textContent = 'Invalid Repository';
              connectionBadge.className = 'badge offline';
              updateStatusIndicator('Connection Error');
            }
          }
          
        } else {
          // No config
          connectionBadge.textContent = 'Disconnected';
          connectionBadge.className = 'badge offline';
          dashUsername.textContent = 'Not configured';
          dashRepo.textContent = 'Not configured';
          openRepoBtn.disabled = true;
          dashSynced.textContent = '--';
          dashLastSync.textContent = '--';
          dashStreak.textContent = '--';
        }
      });
    });
  }

  loadData();

  // View Navigation
  openSettingsBtn.addEventListener('click', () => {
    dashboardView.classList.add('hidden');
    settingsView.classList.remove('hidden');
  });

  backBtn.addEventListener('click', () => {
    settingsView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    loadData();
  });

  openRepoBtn.addEventListener('click', () => {
    if (currentRepoUrl) {
      chrome.tabs.create({ url: currentRepoUrl });
    }
  });

  // Utility to display success or error messages
  function showMessage(message, isError = false) {
    statusLabel.textContent = message;
    statusLabel.className = `status ${isError ? 'error' : 'success'}`;
    statusLabel.classList.remove('hidden');

    // Automatically hide the message after 3 seconds
    setTimeout(() => {
      statusLabel.classList.add('hidden');
    }, 3000);
  }

  // Handle save button click
  saveBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const token = tokenInput.value.trim();
    const repo = repoInput.value.trim();

    // 1. Validate all fields
    if (!username) {
      return showMessage('GitHub Username is required.', true);
    }
    
    if (!token) {
      return showMessage('Personal Access Token is required.', true);
    }
    
    // Validate GitHub Token format (supports classic and fine-grained tokens)
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      return showMessage('Invalid Token format (must start with ghp_ or github_pat_).', true);
    }

    if (!repo) {
      return showMessage('Repository Name is required.', true);
    }
    
    if (repo.includes(' ')) {
      return showMessage('Repository Name cannot contain spaces.', true);
    }

    // 2. Save values to chrome.storage.sync
    chrome.storage.sync.set({
      githubUsername: username,
      githubToken: token,
      repoName: repo
    }, () => {
      if (chrome.runtime.lastError) {
        showMessage('Error saving settings.', true);
      } else {
        // Clear cached validation to force a fresh check
        chrome.storage.local.remove(['repoValidationCache', 'problemsSynced'], () => {
           showMessage('Settings saved successfully!');
           setTimeout(() => {
             settingsView.classList.add('hidden');
             dashboardView.classList.remove('hidden');
             loadData();
           }, 1000); // Switch back to dashboard after a short delay
        });
      }
    });
  });

  // Handle refresh stats button click
  refreshStatsBtn.addEventListener('click', () => {
    refreshStatsBtn.textContent = 'Refreshing...';
    refreshStatsBtn.disabled = true;

    chrome.storage.sync.get(['githubUsername', 'githubToken', 'repoName'], async (syncResult) => {
      const hasConfig = syncResult.githubUsername && syncResult.githubToken && syncResult.repoName;
      if (!hasConfig) {
        showMessage('Please configure and save GitHub settings first.', true);
        refreshStatsBtn.textContent = 'Refresh Repository Stats';
        refreshStatsBtn.disabled = false;
        return;
      }

      const countResult = await GitHubAPI.getSyncedProblemsCount(
        syncResult.githubUsername,
        syncResult.repoName,
        syncResult.githubToken
      );

      if (countResult.success) {
        chrome.storage.local.set({ problemsSynced: countResult.count }, () => {
          showMessage('Stats refreshed successfully!');
          refreshStatsBtn.textContent = 'Refresh Repository Stats';
          refreshStatsBtn.disabled = false;
          // Immediately update dashboard UI in the background
          loadData();
        });
      } else {
        showMessage('Failed to refresh stats: ' + (countResult.error || 'Unknown error'), true);
        refreshStatsBtn.textContent = 'Refresh Repository Stats';
        refreshStatsBtn.disabled = false;
      }
    });
  });
});
