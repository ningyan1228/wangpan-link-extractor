const sourceText = document.querySelector("#sourceText");
const resultText = document.querySelector("#resultText");
const extractBtn = document.querySelector("#extractBtn");
const copyBtn = document.querySelector("#copyBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const sampleBtn = document.querySelector("#sampleBtn");
const clearBtn = document.querySelector("#clearBtn");
const dedupeInput = document.querySelector("#dedupeInput");
const keepPwdInput = document.querySelector("#keepPwdInput");
const statusText = document.querySelector("#statusText");
const totalCount = document.querySelector("#totalCount");
const quarkCount = document.querySelector("#quarkCount");
const baiduCount = document.querySelector("#baiduCount");

const sample = `我用夸克网盘给你分享了「向上生长 = Grow Up (九边) (z-library.sk, 1lib.sk, z-lib.sk).epub」，点击链接或复制整段内容，打开「夸克APP」即可获取。
链接：https://pan.quark.cn/s/36d0c9535386

我用夸克网盘给你分享了「何以中国 (葛剑雄) (z-library.sk, 1lib.sk, z-lib.sk).epub」，点击链接或复制整段内容，打开「夸克APP」即可获取。
链接：https://pan.quark.cn/s/530d8878560d

【超级会员V4】通过百度网盘分享的文件：A、2027公考合集
链接：https://pan.baidu.com/s/1OxJqMz5hQjHGNA2sNHPw-w?pwd=hh2t
提取码：hh2t

【超级会员V4】通过百度网盘分享的文件：C、考公资料包（笔记题本真题）
链接：https://pan.baidu.com/s/1K2WYsAWOtDY1yS5y2fGptg?pwd=hh2t
提取码：hh2t`;

const linkPattern = /https?:\/\/(?:pan\.quark\.cn\/s\/[A-Za-z0-9_-]+|pan\.baidu\.com\/s\/[^\s，,。；;]+)/gi;

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
}

function cleanUrl(url) {
  return url.replace(/[)\]）】"'”’。；;,，]+$/g, "");
}

function detectProvider(url) {
  if (/pan\.quark\.cn/i.test(url)) return "quark";
  if (/pan\.baidu\.com/i.test(url)) return "baidu";
  return "unknown";
}

function tidyTitle(rawTitle) {
  return (rawTitle || "")
    .replace(/\s+/g, " ")
    .replace(/^[:：\-\s]+/, "")
    .replace(/[，,。；;]+$/g, "")
    .replace(/^[「『“"'【\s]+|[」』”"'】\s]+$/g, "")
    .trim();
}

function stripShareNoise(line) {
  return line
    .replace(/^\s*【[^】]*】\s*/, "")
    .replace(/^\s*我用夸克网盘给你分享了\s*/, "")
    .replace(/^\s*通过百度网盘分享的文件[:：]\s*/, "")
    .replace(/^\s*百度网盘分享的文件[:：]\s*/, "")
    .replace(/^\s*分享的文件[:：]\s*/, "")
    .trim();
}

function extractTitle(provider, beforeLink) {
  const before = beforeLink.trim();
  const quoted = before.match(/分享了\s*[「『“"]([\s\S]*?)[」』”"]/);
  if (quoted) return tidyTitle(quoted[1]);

  if (provider === "baidu") {
    const baiduTitle = before.match(/(?:通过)?百度网盘分享的文件[:：]\s*([^\n]+)/);
    if (baiduTitle) return tidyTitle(baiduTitle[1]);
  }

  const lines = before
    .split("\n")
    .map((line) => stripShareNoise(line))
    .map((line) => tidyTitle(line))
    .filter(Boolean)
    .filter((line) => !/^链接[:：]/.test(line))
    .filter((line) => !/点击链接|复制整段内容|打开/.test(line));

  return lines.at(-1) || "";
}

function extractPwd(url, afterLink) {
  const explicit = afterLink.match(/提取码[:：\s]*([A-Za-z0-9]{4,16})/i);
  if (explicit) return explicit[1];

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("pwd") || "";
  } catch {
    const fallback = url.match(/[?&]pwd=([A-Za-z0-9]{4,16})/i);
    return fallback ? fallback[1] : "";
  }
}

function parseShares(input, options = {}) {
  const text = normalizeText(input);
  const matches = [...text.matchAll(linkPattern)].map((match) => ({
    rawUrl: match[0],
    index: match.index,
  }));

  const seen = new Set();
  const items = [];

  matches.forEach((match, index) => {
    const url = cleanUrl(match.rawUrl);
    if (options.dedupe && seen.has(url)) return;
    seen.add(url);

    const provider = detectProvider(url);
    const start = index === 0 ? 0 : matches[index - 1].index + matches[index - 1].rawUrl.length;
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    const section = text.slice(start, end);
    const localLinkIndex = section.indexOf(match.rawUrl);
    const beforeLink = section.slice(0, localLinkIndex);
    const afterLink = section.slice(localLinkIndex + match.rawUrl.length);

    items.push({
      provider,
      title: extractTitle(provider, beforeLink),
      url,
      pwd: provider === "baidu" ? extractPwd(url, afterLink) : "",
    });
  });

  return items;
}

function formatShares(items, options = {}) {
  return items
    .map((item) => {
      const lines = [];
      if (item.title) lines.push(item.title);
      lines.push(`链接：${item.url}`);
      if (options.keepPwd && item.pwd) lines.push(`提取码：${item.pwd}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = `status ${type}`.trim();
}

function updateMetrics(items) {
  totalCount.textContent = String(items.length);
  quarkCount.textContent = String(items.filter((item) => item.provider === "quark").length);
  baiduCount.textContent = String(items.filter((item) => item.provider === "baidu").length);
}

function runExtract() {
  const items = parseShares(sourceText.value, {
    dedupe: dedupeInput.checked,
  });
  resultText.value = formatShares(items, {
    keepPwd: keepPwdInput.checked,
  });
  updateMetrics(items);

  if (items.length) {
    setStatus(`已提取 ${items.length} 条`, "ok");
  } else {
    setStatus("未找到链接", "warn");
  }
}

async function copyResult() {
  const value = resultText.value.trim();
  if (!value) {
    setStatus("没有结果", "warn");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setStatus("已复制", "ok");
  } catch {
    resultText.focus();
    resultText.select();
    document.execCommand("copy");
    setStatus("已复制", "ok");
  }
}

function downloadResult() {
  const value = resultText.value.trim();
  if (!value) {
    setStatus("没有结果", "warn");
    return;
  }

  const blob = new Blob([value + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "网盘链接提取结果.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("已下载", "ok");
}

extractBtn.addEventListener("click", runExtract);
sourceText.addEventListener("input", runExtract);
dedupeInput.addEventListener("change", runExtract);
keepPwdInput.addEventListener("change", runExtract);
copyBtn.addEventListener("click", copyResult);
downloadBtn.addEventListener("click", downloadResult);

sampleBtn.addEventListener("click", () => {
  sourceText.value = sample;
  runExtract();
  sourceText.focus();
});

clearBtn.addEventListener("click", () => {
  sourceText.value = "";
  resultText.value = "";
  updateMetrics([]);
  setStatus("等待输入");
  sourceText.focus();
});

runExtract();
