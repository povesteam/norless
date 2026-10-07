/**
 * The manual's address: GitHub Pages' site of the repository the running version's source
 * is in (`https://github.com/<owner>/<repo>/…` → `https://<owner>.github.io/<repo>/`);
 * null without a GitHub source.
 */
export function manualOf(source: string | null): string | null {
  const match =
    source && /^https:\/\/github\.com\/([^/]+)\/([^/]+)/.exec(source);
  return match ? `https://${match[1]}.github.io/${match[2]}/` : null;
}
