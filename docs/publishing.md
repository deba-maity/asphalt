# Repository, release and Pages activation

No GitHub origin/authentication is configured here. Choose a repository you own or have permission to publish to. Copy **Code → HTTPS** in that actual project repository. Obtain **OWNER/REPOSITORY** from its address bar. These are account-specific values, not names supplied by this project. Public downloads require anonymously accessible release assets; private/draft assets do not qualify.

Install [GitHub CLI](https://cli.github.com/) yourself if needed. From the root:

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
git remote -v
$repositoryUrl=Read-Host 'Paste the intended project HTTPS clone URL from GitHub Code'
git remote add origin $repositoryUrl
git remote -v
gh auth login
gh auth status
git branch --show-current
git push -u origin HEAD
```

`remote add` applies while origin is absent, as here. If it already exists, inspect its destination before changing anything. Review tracked files before pushing; generated output/caches/keys are ignored. Reconcile any remote history normally; do not force-push over unrelated work.

## Settings and credentials

**Settings → Actions → General**: enable repository workflows and permit the official SHA-pinned actions. Jobs are contents-read by default. The separate publish job requests contents-write; only the Pages deploy job requests pages-write/id-token-write. Organization policy may require an administrator to permit these permissions/actions.

**Settings → Environments**: create **github-release**, optionally with a reviewer and protected branch rule. Inspect/create **github-pages**, allowing the intended default branch. **Settings → Pages → Build and deployment → Source: GitHub Actions**. Enable **Enforce HTTPS** when available; no custom domain is needed. Configure/upload/deploy jobs follow [GitHub's custom workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): deploy depends on build, uses github-pages environment, pages-write and id-token-write.

Windows/Pages need no manually supplied secret: the automatic `github.token` is job-scoped. No token is embedded in site source. Android is disabled by default and has [separate secrets](android.md). A configured future GitHub environment reviewer is a repository setting, not a requirement to approve this local preparation.

## Windows candidate and release

In **Actions → Windows candidate → Run workflow**, choose the reviewed branch. Initially leave **publish unchecked**. Inspect job logs and download **windows-candidate** from the run's Artifacts. Its outer Actions ZIP contains the versioned playable ZIP, source ZIP, release.json, portable-verification.json and SHA256SUMS.txt. Extract the outer wrapper before verifying its manifest.

After accepting the candidate's documented limits, run with **publish checked**. Build/test happen first. Separate github-release job verifies destination/origin/source, refuses existing versions, uploads a draft **prerelease**, downloads its assets and checks exact bytes, then publishes and anonymously checks public hashes. Ordinary pushes/tags do not release anything. Default build is unsigned. No arbitrary repo is created or visibility changed.

For an already built local candidate, from root:

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
$projectRepository=Read-Host 'Enter actual OWNER/REPOSITORY from the GitHub address bar'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\publish_release.ps1 -Repository $projectRepository -ReleaseDirectory .\exports\releases\v0.4.0-rc.1
```

Without `-Publish`, this creates/verifies a **draft only**. Inspect it in Releases and publish as prerelease there. Adding `-Publish` explicitly publishes after verification. The recorded source commit must already exist in the destination. Existing releases are refused; never overwrite an asset/tag silently. If a job stops after draft creation, inspect/recover that draft manually or increment the version. If publication succeeded but anonymous validation failed, keep the site's links unavailable until public access/hash checks succeed.

There are **five files** uploaded: two ZIPs, two JSONs and checksum manifest. Metadata retains build identity/null local URLs after upload so its checksums remain valid. The site snapshot adds actual public URLs separately.

## Deploy and verify the site

**Actions → Deploy download site → Run workflow** with **release_tag: v0.4.0-rc.1** only after that release is public. Blank tag deploys an honest unavailable-download site. It checks the static fallback/browser behavior, then anonymously verifies expected assets, sizes, SHA-256, checksum manifest and portable-test status. Missing/private/draft/mismatched releases fail the build. Only `site/` enters Pages; no game ZIPs, token or backend.

Get the actual HTTPS URL from **Settings → Pages → Visit site**, the deployment step output or **Deployments → github-pages**. Confirm its project subpath, images, keyboard/mobile layout, version/date/size/hash, Windows filename and separate source link. Download through the site, compare SHA-256 and do [local acceptance](local-acceptance.md). No Android button should appear. Previous releases remain available through repository Releases navigation.

From root, verify real public bytes locally:

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
$projectRepository=Read-Host 'Enter actual OWNER/REPOSITORY'
python .\tools\site_release.py --repository $projectRepository --tag v0.4.0-rc.1
python .\tools\preview_site.py --base /ashen-vow/
```

Open http://127.0.0.1:4173/ashen-vow/; Ctrl+C stops it. Verification uses GitHub API/downloads at build time only. Rate-limit/network failures block activation; do not bypass by pasting unverified URLs into HTML. Site visitors read same-origin static JSON.

## Later updates and logs

Preserve stable save IDs/migrations, increment `release-config.json` version (Android code too if distributing it), update notes, commit and push. Validate/build/publish a **new tag** and deploy that tag's snapshot. Keep previous releases. Saves stay in AppData while players extract updates into new game folders.

Logs: **Actions → selected run → job → step**. Failed validation uploads game logs; site job uploads browser reports/screenshots. Commit Checks shows status. No hosted workflow was executed here. A green headless job is not rendered/hardware acceptance. Local workflow configuration inspection cannot establish hosted success.
