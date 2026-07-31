# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - Initial Open Source Release

### Added
- Complete LeetCode Network interception engine ensuring 100% accuracy for solution capture.
- Automated GitHub API integration using Personal Access Tokens.
- Local Dashboard popup with real-time syncing status, streak tracking, and repository folder counting.
- Robust markdown generator parsing LeetCode problem descriptions, constraints, examples, and metadata.
- Clean root-level folder generation in the user's GitHub repository.

### Fixed
- Eliminated race conditions between legacy DOM scrapers and the new Network interception pipeline.
- Fixed an issue where the extension attempted redundant uploads when refreshing an already accepted LeetCode submission page.
