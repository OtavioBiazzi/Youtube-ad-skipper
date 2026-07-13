export function getYouTubeVideoIdFromUrl(input: string | URL) {
  let url: URL;

  try {
    url = input instanceof URL ? input : new URL(String(input), "https://www.youtube.com");
  } catch (err) {
    return "";
  }

  const queryId = url.searchParams.get("v");
  if (queryId) return queryId;

  const embedMatch = url.pathname.match(/^\/embed\/([^/?#]+)/);
  if (embedMatch?.[1]) return decodeURIComponent(embedMatch[1]);

  const shortsMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);
  if (shortsMatch?.[1]) return decodeURIComponent(shortsMatch[1]);

  return "";
}

export function getYouTubeVideoKeyFromUrl(input: string | URL) {
  let url: URL;

  try {
    url = input instanceof URL ? input : new URL(String(input), "https://www.youtube.com");
  } catch (err) {
    return "";
  }

  const videoId = getYouTubeVideoIdFromUrl(url);
  if (videoId) return "watch:" + videoId;
  return url.pathname + url.search;
}
