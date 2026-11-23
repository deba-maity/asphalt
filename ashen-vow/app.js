'use strict';
// Only same-origin, build-generated data is read. No live GitHub API or tokens.
(async () => {
  const text = (id, value) => { document.getElementById(id).textContent = value; };
  const link = (id, url) => {
    if (!url) return;
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') throw new Error('Unverified release origin');
    const element = document.getElementById(id);
    element.href = parsed.href;
    element.hidden = false;
  };
  try {
    const response = await fetch('release-data.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('Release snapshot unavailable');
    const data = await response.json();
    text('version', data.version + ' · ' + data.status);
    text('build-date', data.build_date_utc ? data.build_date_utc.slice(0, 10) : 'No artifact snapshot');
    const windows = data.artifacts.find(a => a.kind === 'windows-portable');
    if (windows) {
      text('build-size', (windows.size_bytes / 1048576).toFixed(1) + ' MiB · x86_64');
      text('checksum', windows.sha256);
      text('availability', 'Local Windows candidate verified headlessly. No public release has been published.');
    } else {
      text('build-size', 'No artifact snapshot');
      text('checksum', 'No packaged artifact metadata in this site build.');
    }
    if (data.published === true && windows && windows.download_url && data.tests.fresh_zip === 'passed') {
      // Set primary link last, so incomplete or invalid metadata stays unavailable.
      link('checksums-link', data.checksum_url);
      link('release-link', data.release_url);
      link('repository-link', data.repository_url);
      link('issues-link', data.repository_url + '/issues');
      const source = data.artifacts.find(a => a.kind === 'source');
      if (source) link('source-link', source.download_url);
      link('windows-download', windows.download_url);
      document.getElementById('windows-unavailable').hidden = true;
      text('availability', 'Published Windows candidate · unsigned unless the release build record states signed.');
      text('issue-info', 'Include BUILD.json, steps, settings and logs/godot.log. Check existing issues first.');
    }
  } catch (error) {
    text('availability', 'Public release unavailable. Release metadata could not be loaded. See the setup guide or ask the repository owner.');
    text('version', 'Candidate · metadata unavailable');
  }
})();
