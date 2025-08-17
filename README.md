# GitHub Actions Music Playlist (MP3/WAV/FLAC) + Visualizer + Themes

- 支持 `music/` 下任意子文件夹分组
- 自动生成 `index.json`（`ffprobe` 读取标题/艺人/专辑/时长）
- 对 WAV/FLAC 自动转码为 `m4a`(AAC) + `mp3` 作为网页回退（可关闭/改码率）
- 单页播放器，玻璃态 UI，WebAudio 频谱（柱状+环形），Media Session，主题/颜色可配置
- **默认 `preload="none"`**：不预取音频，点击才加载，适合大库

## 快速开始
1. 新建 GitHub 仓库，上传全部文件。
2. Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
3. 把歌放进 `music/`（可子文件夹分组），提交推送。

## 构建配置 `config.json`（仓库根目录）
```json
{
  "publish": {
    "originals": true,
    "encodeLossless": true,
    "aacBitrate": "192k",
    "mp3Bitrate": "256k"
  }
}
```
- 只想发小体积：把 `originals` 设为 `false`。
- 下调码率可进一步减小体积。

## 站点外观 `site/config.json`
```json
{
  "defaultTheme": "auto",
  "accent": "#6ea8fe",
  "viz": {
    "bars": { "stop1": "#9ec5ff", "stop2": "#6ea8fe" },
    "ring": "#9ec5ff"
  }
}
```
网页里也有 **🌗 主题**、**🎨 颜色** 的按钮，改动会存入 `localStorage`。

## Git LFS
大文件请用 Git LFS，工作流已设置 `lfs: true`，会在构建时拉取真实文件再转码+发布。
