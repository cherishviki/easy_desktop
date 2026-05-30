const fs = require("node:fs");
const path = require("node:path");

/**
 * electron-builder afterPack hook.
 * Removes unnecessary files from the packaged app to reduce size.
 */
exports.default = async function afterPack(context) {
  const appDir = context.appOutDir;
  const stats = { removed: [], skipped: [] };

  // 1. Remove unused locale files (keep only zh-CN, ~42MB saved)
  const localesDir = path.join(appDir, "locales");
  if (fs.existsSync(localesDir)) {
    const keep = new Set(["zh-CN.pak", "zh-TW.pak"]);
    const files = fs.readdirSync(localesDir);
    for (const file of files) {
      if (!keep.has(file)) {
        fs.rmSync(path.join(localesDir, file));
        stats.removed.push(`locales/${file}`);
      }
    }
  }

  // 2. Remove huge Chromium license file (~14MB saved)
  const licensePath = path.join(appDir, "LICENSES.chromium.html");
  if (fs.existsSync(licensePath)) {
    fs.rmSync(licensePath);
    stats.removed.push("LICENSES.chromium.html");
  }

  // 3. Remove ffmpeg.dll - app doesn't play media (~3MB saved)
  const ffmpegPath = path.join(appDir, "ffmpeg.dll");
  if (fs.existsSync(ffmpegPath)) {
    fs.rmSync(ffmpegPath);
    stats.removed.push("ffmpeg.dll");
  }

  // 4. Remove GPU/shader DLLs - simple UI doesn't need them (~42MB saved)
  const gpuFiles = [
    "dxcompiler.dll",
    "d3dcompiler_47.dll",
    "libEGL.dll",
    "libGLESv2.dll",
    "vk_swiftshader.dll",
    "vulkan-1.dll",
    "dxil.dll"
  ];
  for (const file of gpuFiles) {
    const filePath = path.join(appDir, file);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
      stats.removed.push(file);
    }
  }

  console.log(`\n[afterPack] Cleaned ${stats.removed.length} files from ${path.basename(appDir)}:`);
  for (const file of stats.removed) {
    console.log(`  - ${file}`);
  }
};