# Musiclist (fixed)

## 使用说明
1. 将本仓库的所有文件上传到你的 `musiclist` 仓库（或任意 GitHub Pages 仓库）根目录。
2. 把你的音频文件放到 `music/` 文件夹（可以分子文件夹）。
3. 推送后，GitHub Actions 会自动扫描 `music/` 并生成 `index.json`，网页就能显示播放列表。
4. 如需手动本地测试，可直接打开 `index.html`，但**某些浏览器本地文件协议限制**可能导致不可用；建议使用静态服务器（例如 `npx http-server`）。

## 重要修复
- 避免 `config.json` 404：播放器现在优先加载根目录的 `player.config.json`，若不存在则回退到默认配置。
- `index.json` 404 回退：首次部署提供空的 `index.json`，同时提供自动生成脚本和 CI 工作流。
- 路径健壮：所有资源均使用相对路径，兼容 `https://<user>.github.io/<repo>/` 子路径。

