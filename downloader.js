const yts = require('yt-search');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Realistic User-Agents
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/121.0.0.0 Safari/537.36"
];

// Tracking maps for locks and deduplication
const activeDownloads = new Set(); // Tracks active queries currently being processed
const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

/**
 * Robustly search and download audio from YouTube.
 * Returns an object with { filePath, isFromCache }
 */
async function downloadAudio(query) {
    if (!query || typeof query !== 'string') {
        throw new Error('Invalid search query provided.');
    }

    const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ');
    console.log(`\n🔍 [DOWNLOADER] Processing request: "${query}"`);
    
    // 1. Check Cache First
    const cachedFile = findInCache(normalizedQuery);
    if (cachedFile) {
        console.log(`📦 [DOWNLOADER] Cache HIT for: "${query}" -> ${cachedFile}`);
        return { filePath: cachedFile, isFromCache: true };
    }

    // 2. Prevent Double Execution / Double Messages
    if (activeDownloads.has(normalizedQuery)) {
        console.log(`🛑 [DOWNLOADER] Dropped duplicate simultaneous request for: "${query}"`);
        const dupError = new Error('Duplicate execution blocked to prevent double messaging.');
        dupError.isDuplicate = true; // Flag used by bot.js to drop the action silently
        throw dupError;
    }

    // Add query to active locks list
    activeDownloads.add(normalizedQuery);

    try {
        // 3. Search for the video
        console.log(`🔎 [DOWNLOADER] Searching YouTube for: "${query}"`);
        let searchResult;
        try {
            searchResult = await yts(query);
        } catch (err) {
            console.error('❌ [DOWNLOADER] Search error:', err);
            throw new Error(`Search failed: ${err.message}`);
        }
        
        const video = searchResult.videos[0];
        if (!video) {
            console.log('❌ [DOWNLOADER] No results found.');
            throw new Error('No results found for your search.');
        }

        console.log(`🎵 [DOWNLOADER] Found: "${video.title}" (${video.url})`);

        // 4. Anti-bot variable delay
        const delay = Math.floor(Math.random() * 1500) + 500;
        console.log(`⏳ [DOWNLOADER] Anti-bot delay: ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // 5. Prepare unique temporary output path template
        const timestamp = Date.now();
        const safeTitle = video.title.replace(/[^\w\s]/gi, '').split(' ').slice(0, 3).join('_');
        const outputPath = path.join(__dirname, `temp_audio_${timestamp}_${safeTitle}.mp3`);

        console.log(`🚀 [DOWNLOADER] Starting yt-dlp download...`);
        
        // 6. Download with retry logic
        const finalPath = await downloadWithRetry(video.url, outputPath);
        
        // 7. Save to long-term cache directory
        saveToCache(normalizedQuery, finalPath);
        
        return { filePath: finalPath, isFromCache: false };

    } finally {
        // Clean up: always lift the lock for this specific query string when finished or failed
        activeDownloads.delete(normalizedQuery);
    }
}

/**
 * Download helper with robust retry and unsuppressed logs.
 */
async function downloadWithRetry(url, outputPath, attempt = 1) {
    const MAX_RETRIES = 2;
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    console.log(`📥 [DOWNLOADER] Attempt ${attempt}/${MAX_RETRIES}...`);

    const ytDlpPath = resolveYtDlpPath();
    const ffmpegDir = path.join(__dirname, 'ffmpeg', 'ffmpeg-master-latest-win64-gpl', 'bin');
    
    // FIX 1: Make filenames unique per attempt so Windows doesn't trigger WinError 32 file locks!
    const currentOutputPath = outputPath.replace('.mp3', `_att${attempt}.mp3`);

    const args = [
        '--force-ipv4',
        '--user-agent', ua,
        '-f', 'bestaudio/best',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--ffmpeg-location', ffmpegDir,
        '--js-runtimes', 'node', // FIX 2: Hands your Node runtime to yt-dlp, fixing extraction lag instantly
        '--no-playlist',
        '-o', currentOutputPath,
        url,
    ];

    console.log(`🔧 [DOWNLOADER] Using binary: ${ytDlpPath}`);

    try {
        await new Promise((resolve, reject) => {
            const childProcess = spawn(ytDlpPath, args, {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1'
                }
            });

            let stdout = '';
            let stderr = '';
            let settled = false;
            let timeoutHandle;

            const cleanup = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
            };

            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                fn(value);
            };

            childProcess.stdout.on('data', chunk => {
                const text = chunk.toString();
                stdout += text;
                process.stdout.write(text); 
            });

            childProcess.stderr.on('data', chunk => {
                const text = chunk.toString();
                stderr += text;
                process.stderr.write(text);
            });

            childProcess.on('error', err => {
                finish(reject, Object.assign(err, { stderr, stdout }));
            });

            childProcess.on('exit', (code, signal) => {
                if (settled) return;
                if (code === 0 && fs.existsSync(currentOutputPath)) {
                    const stats = fs.statSync(currentOutputPath);
                    console.log(`✅ [DOWNLOADER] Download complete! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                    finish(resolve, currentOutputPath);
                } else {
                    const error = new Error(`yt-dlp exited with code ${code}${signal ? ` (signal ${signal})` : ''}.`);
                    error.stderr = stderr;
                    error.stdout = stdout;
                    finish(reject, error);
                }
            });

            childProcess.on('close', (code, signal) => {
                if (settled) return;
                if (code === 0 && fs.existsSync(currentOutputPath)) {
                    const stats = fs.statSync(currentOutputPath);
                    console.log(`✅ [DOWNLOADER] Download complete! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                    finish(resolve, currentOutputPath);
                } else {
                    const error = new Error(`yt-dlp closed with code ${code}${signal ? ` (signal ${signal})` : ''}.`);
                    error.stderr = stderr;
                    error.stdout = stdout;
                    finish(reject, error);
                }
            });

            // FIX 3: Bumped timeout from 60 seconds to 120 seconds to give slow downloads breathing room
            timeoutHandle = setTimeout(() => {
                if (childProcess && !childProcess.killed) {
                    console.warn('⚠️ [DOWNLOADER] Download timed out after 120 seconds, killing yt-dlp.');
                    childProcess.kill('SIGTERM');
                    const error = new Error('Download timed out after 120 seconds.');
                    error.stderr = stderr;
                    error.stdout = stdout;
                    finish(reject, error);
                }
            }, 120000);
        });

        return currentOutputPath;

    } catch (err) {
        if (attempt < MAX_RETRIES) {
            console.warn(`⚠️ [DOWNLOADER] Attempt ${attempt} failed, retrying...`);
            return downloadWithRetry(url, outputPath, attempt + 1);
        }
        throw err;
    }
}

function resolveYtDlpPath() {
    const candidates = [
        path.join(__dirname, 'yt-dlp.exe'),
        path.join(__dirname, 'yt-dlp'),
        path.join(process.cwd(), 'yt-dlp.exe'),
        path.join(process.cwd(), 'yt-dlp'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return 'yt-dlp';
}

/**
 * Cache Logic
 */
function saveToCache(normalizedQuery, filePath) {
    try {
        const safeQuery = normalizedQuery.replace(/[^\w\s]/gi, '').split(' ').join('_');
        const cachePath = path.join(CACHE_DIR, `${safeQuery}.mp3`);
        if (!fs.existsSync(cachePath)) {
            fs.copyFileSync(filePath, cachePath);
            console.log(`📦 [DOWNLOADER] Saved to cache: ${safeQuery}.mp3`);
        }
    } catch (err) {
        console.warn('⚠️ [DOWNLOADER] Cache save failed:', err.message);
    }
}

// Fixed missing syntax closure
function findInCache(normalizedQuery) {
    try {
        const safeQuery = normalizedQuery.replace(/[^\w\s]/gi, '').split(' ').join('_');
        const cachePath = path.join(CACHE_DIR, `${safeQuery}.mp3`);
        if (fs.existsSync(cachePath)) return cachePath;
    } catch (err) {}
    return null;
}

module.exports = { downloadAudio };