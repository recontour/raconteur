# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-24

### Added
- Added build tracking and standardized release logging via this CHANGELOG.
- Added `metadataBase` configuration to Next.js root layout to properly resolve Open Graph and Twitter images.

### Fixed
- Resolved console warnings related to deprecated `THREE.Clock` by locking `three.js` to version `0.183.0` until `@react-three/fiber` updates its internal implementation.
