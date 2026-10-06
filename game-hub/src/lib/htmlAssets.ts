function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(`Could not read ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function assetName(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0];
  const filename = withoutQuery.split(/[\\/]/).pop() || "";
  try {
    return decodeURIComponent(filename).toLowerCase();
  } catch {
    return filename.toLowerCase();
  }
}

export async function inlineHtmlImageAssets(html: string, files: File[]): Promise<string> {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  if (imageFiles.length === 0) return html;

  const assets = new Map<string, string>();
  await Promise.all(imageFiles.map(async (file) => {
    assets.set(assetName(file.name), await readAsDataUrl(file));
  }));

  const replaceReference = (value: string) => assets.get(assetName(value)) || value;
  const replaceSrcSet = (value: string) => {
    if (/^\s*data:/i.test(value)) return value;
    return value.split(",").map((candidate) => {
      const [source, ...descriptors] = candidate.trim().split(/\s+/);
      return [replaceReference(source), ...descriptors].join(" ");
    }).join(", ");
  };
  const withImageAttributes = html.replace(
    /\b(src|data-src|srcset|poster)\s*=\s*(["'])(.*?)\2/gi,
    (attribute, name: string, quote: string, value: string) => {
      const replacement = name.toLowerCase() === "srcset" ? replaceSrcSet(value) : replaceReference(value);
      return `${name}=${quote}${replacement}${quote}`;
    }
  );

  return withImageAttributes.replace(
    /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
    (match, quote: string, value: string) => {
      const replacement = replaceReference(value.trim());
      return replacement === value.trim() ? match : `url("${replacement}")`;
    }
  );
}