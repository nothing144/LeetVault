<div align="center">
  <img src="src/assets/icons/icon128.png" alt="LeetVault Logo" width="128">
  
  # LeetVault
  
  **Automatically sync your successfully accepted LeetCode solutions directly to your GitHub repository.**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Version](https://img.shields.io/badge/version-1.0.0-success.svg)](#)
  [![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-orange.svg)](#)
</div>

---

## 📖 Overview

**LeetVault** is a lightweight, privacy-focused Chrome Extension that automates the process of building your algorithmic portfolio. Whenever you successfully submit an "Accepted" solution on LeetCode, LeetVault intercepts the solution and automatically commits it to a GitHub repository of your choice.

Stop copying and pasting code manually. Let LeetVault handle it instantly in the background.

## ✨ Features

- 🚀 **Instant Syncing**: Uploads your solution within milliseconds of an Accepted result.
- 🔒 **Privacy-First**: No external servers. Your code goes straight from your browser to GitHub via the official API.
- 📁 **Organized Structure**: Automatically generates beautiful `README.md` files containing the problem statement, constraints, and your solution metadata.
- 📊 **Local Dashboard**: Track your "Problems Synced" and "Current Streak" completely offline without unnecessary API calls.
- ⚡ **Zero-Friction**: Uses a robust network-interception architecture instead of brittle DOM-scraping to ensure 100% accuracy.

---

## 📸 Screenshots

*(Replace placeholders with actual images before Web Store publication)*

| Dashboard View | Settings Configuration | Output Repository |
| :---: | :---: | :---: |
| ![Dashboard Placeholder](https://via.placeholder.com/250x350.png?text=Dashboard) | ![Settings Placeholder](https://via.placeholder.com/250x350.png?text=Settings) | ![GitHub Placeholder](https://via.placeholder.com/250x350.png?text=Repo+Output) |

---

## ⚙️ Architecture Overview

LeetVault relies on Chrome Manifest V3 standards:
1. **Network Interceptor (`network.js`)**: Injected into the LeetCode runtime to seamlessly capture GraphQL submission payloads.
2. **Content Script (`content.js`)**: Bridges the sandboxed interceptor with the extension environment, guaranteeing no cross-origin restrictions.
3. **Service Worker (`service-worker.js`)**: Handles background GitHub API authentication, markdown generation, and repository commits.
4. **Local Dashboard (`popup.js`)**: A lightweight UI that caches repository states and tracks solving streaks locally.

---

## 🚀 Installation & Setup

### 1. Install the Extension
*(Link to Chrome Web Store coming soon. For now, you can load unpacked)*:
1. Clone this repository: `git clone https://github.com/nothing144/LeetVault.git`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `LeetVault` directory.

### 2. Configure GitHub
1. Create a new GitHub repository (e.g., `LeetCode-Solutions`).
2. Generate a Personal Access Token (Classic or Fine-Grained) with `repo` permissions.
3. Open the LeetVault extension popup.
4. Enter your GitHub Username, Token, and Repository Name.
5. Click **Save**.

---

## 📂 Example Repository Output

LeetVault automatically structures your repository for maximum readability. Each problem gets its own dedicated folder at the root of the repository:

```text
Your-Repository/
├── 1-two-sum/
│   ├── README.md
│   └── solution.java
├── 83-remove-duplicates-from-sorted-list/
│   ├── README.md
│   └── solution.py
```

---

## 📝 Supported Languages

LeetVault supports all languages available on LeetCode. The extension automatically maps the internal LeetCode language identifier to the correct file extension (e.g., `python3` → `.py`, `cpp` → `.cpp`). See [SUPPORTED_LANGUAGES.md](SUPPORTED_LANGUAGES.md) for the full matrix.

---

## 🔒 Privacy & Security

- **Your Token, Your Browser**: Your Personal Access Token is stored securely in `chrome.storage.sync` and never leaves your browser except to communicate directly with `api.github.com`.
- **No Analytics**: We do not track your usage, solving habits, or IP address.
- **Open Source**: The code is 100% open source and auditable.

---

## 🤝 Contributing

We welcome community contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started. 

Ensure you review the [Code of Conduct](CODE_OF_CONDUCT.md) before participating in the community.

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<div align="center">
  <i>Built with ❤️ for developers leveling up their algorithm skills.</i>
</div>
