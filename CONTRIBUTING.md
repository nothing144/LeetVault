# Contributing to LeetVault

First off, thank you for considering contributing to LeetVault! It's people like you that make open-source software great.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please create an issue using the Bug Report template. Ensure you include:
- A clear description of the problem
- Steps to reproduce
- The expected behavior
- Screenshots (if applicable)

### Suggesting Enhancements
Have an idea for a new feature? We'd love to hear it! Open an issue using the Feature Request template and explain:
- What the feature is
- Why it would be useful
- How it might be implemented

### Pull Requests
1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests (or test manually and document your results).
3. Ensure the code follows the existing architectural patterns (Manifest V3, modular JS).
4. Do not include excessive `console.log()` statements in production code.
5. Issue that PR!

## Local Development Setup
1. Clone your fork: `git clone https://github.com/nothing144/LeetVault.git`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `LeetVault` directory.
5. Whenever you make changes, click the "Refresh" icon on the extension card in Chrome.

## Architecture Rules
- **No dependencies**: We aim to keep the extension lightweight. Avoid adding heavy npm packages unless absolutely necessary.
- **Vanilla JS**: This project uses modern Vanilla JS (ES6+) without a build step to keep the barrier to entry low.
- **Privacy First**: Any new feature must respect user privacy. We do not transmit data anywhere except directly to the GitHub API.

Thank you for contributing!
