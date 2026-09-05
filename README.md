# ZeroLimit

<p align="center">
<img src="./public/icon.png" width="128" height="128" alt="Logo">
<br />
A cross-platform AI coding assistant quota tracker
</p>


<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20|%20macOS%20|%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/Built%20with-Tauri%20%2B%20React-orange" alt="Built with">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## 🎯 What is ZeroLimit?

ZeroLimit is a **cross-platform desktop application** for monitoring AI coding assistant quotas using [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). Track your usage across Antigravity, Anthropic Claude, Codex, Gemini CLI, Kiro, GitHub Copilot, Cursor, OpenCode Go, Grok, and Command Code accounts in one dashboard.

Built with **Tauri + React + Rust**, ZeroLimit runs on **Windows**, **macOS**, and **Linux**.

## 🚀 Key Features

- 🔌 **Multi-Provider Support** - Monitor Gemini, Claude, OpenAI, Antigravity, Kiro, Copilot, Cursor, OpenCode Go, Grok, and Command Code accounts
- 📊 **Real-time Quota Dashboard** - Track usage per account with visual progress bars
- 🖥️ **System Tray Integration** - Quick access from your taskbar
- ⚡ **One-Click Proxy Control** - Start/stop CLIProxyAPI with a single click
- 🔄 **Auto-start on Launch** - Optionally start the proxy when the app opens
- 🌓 **Dark/Light Theme** - Beautiful UI with theme support
- 🌍 **Multilingual** - English, Chinese, Indonesian, Japanese, Korean, Vietnamese, Thai
- 🔄 **Auto-update** - Automatically check for updates and install them

## 🤖 Supported Ecosystem

| Provider | Auth Method |
|----------|-------------|
| Google Gemini | OAuth |
| Anthropic Claude | OAuth |
| OpenAI Codex | OAuth |
| Antigravity | OAuth |
| Kiro | OAuth |
| Github Copilot | OAuth |
| Cursor | OAuth (requires CLIProxyAPI Plus binary) |
| OpenCode Go | Workspace ID + auth cookie |
| Grok | xAI console API key |
| Command Code | CLI API key |

## 📦 Installation

### Windows
Download from [Releases](https://github.com/0xtbug/zero-limit/releases):
- `ZeroLimit_x.x.x_x64-setup.exe` - NSIS installer (x64)
- `ZeroLimit_x.x.x_arm64-setup.exe` - NSIS installer (ARM64)
- `ZeroLimit_x.x.x_x64_en-US.msi` - MSI installer (x64)
- `ZeroLimit_x.x.x_portable.exe` - Portable executable

### macOS
Download from [Releases](https://github.com/0xtbug/zero-limit/releases):
- `ZeroLimit_x.x.x_aarch64.dmg` - Apple Silicon (M1/M2/M3)
- `ZeroLimit_x.x.x_x64.dmg` - Intel

> ⚠️ **Note**: The app is not signed with an Apple Developer certificate. If macOS blocks the app, run:
> ```bash
> xattr -cr /Applications/ZeroLimit.app
> ```

### Linux
Download from [Releases](https://github.com/0xtbug/zero-limit/releases):
- `.deb` - Debian/Ubuntu
- `.rpm` - Fedora/RHEL
- `.AppImage` - Universal

### Building from Source

```bash
# Clone repository
git clone https://github.com/0xtbug/zero-limit.git
cd zero-limit

# Install dependencies
pnpm install

# Development
pnpm run tauri dev

# Production build
pnpm run tauri build
```

## 📸 Screenshots

### Onboarding

<img src="./screenshots/onboard.png" alt="Dashboard">

### Dashboard

![Dashboard](./screenshots/dashboard.png)

### Quota Monitoring

![Quota Monitoring](./screenshots/quota.png)
![Quota Monitoring2](./screenshots/quota2.png)

### Providers

![Providers](./screenshots/providers.png)

### Settings

![Settings](./screenshots/settings.png)

## 📖 Documentation

- [Usage Guide](docs/USAGE.md)

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (git checkout -b feature/new-feature)
3. Commit your Changes (git commit -m 'Add new feature')
4. Push to the Branch (git push origin feature/new-feature)
5. Open a Pull Request

## ⭐ Star History
<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="
      https://api.star-history.com/svg?repos=0xtbug/zero-limit&type=Date&theme=dark
    "
  />
  <source
    media="(prefers-color-scheme: light)"
    srcset="
      https://api.star-history.com/svg?repos=0xtbug/zero-limit&type=Date
    "
  />
  <img
    alt="Star History Chart"
    src="https://api.star-history.com/svg?repos=0xtbug/zero-limit&type=Date"
  />
</picture>

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ❤️ using Tauri + React
</p>
