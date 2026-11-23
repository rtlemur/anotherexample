(() => {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;

  const canonical = document.querySelector('link[rel="canonical"]');
  const fallbackPath = document.currentScript?.dataset.feedbackPath;
  const pageUrl = new URL(canonical?.href ?? fallbackPath ?? window.location.href, window.location.origin);
  pageUrl.search = '';
  pageUrl.hash = '';
  const storageKey = `anotherexample:page-feedback:${pageUrl.pathname}`;

  footer.insertAdjacentHTML('afterbegin', `
    <div class="page-feedback" role="group" aria-labelledby="page-feedback-question">
      <div class="page-feedback-row">
        <p id="page-feedback-question">Did this solve your problem?</p>
        <div class="page-feedback-options">
          <button class="page-feedback-vote" type="button" data-feedback-vote="yes" aria-pressed="false"><span aria-hidden="true">👍</span> Yes</button>
          <button class="page-feedback-vote" type="button" data-feedback-vote="no" aria-pressed="false"><span aria-hidden="true">👎</span> No</button>
        </div>
      </div>
      <p class="page-feedback-status" role="status"></p>
    </div>
  `);

  const buttons = footer.querySelectorAll('[data-feedback-vote]');
  const status = footer.querySelector('.page-feedback-status');
  let vote = readVote();
  if (vote) showVote();

  for (const button of buttons) {
    button.addEventListener('click', () => {
      if (vote) return;
      vote = readVote();
      if (vote) {
        showVote();
        return;
      }

      vote = button.dataset.feedbackVote;
      try {
        window.localStorage.setItem(storageKey, vote);
      } catch {
        // The current page still remembers the vote if storage is unavailable.
      }
      showVote();

      const production = ['anotherexample.com', 'www.anotherexample.com'].includes(window.location.hostname);
      if (production && typeof window.gtag === 'function') {
        window.gtag('event', `page_feedback_${vote}`, { page_location: pageUrl.href });
      }
    });
  }

  function readVote() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === 'yes' || saved === 'no' ? saved : null;
    } catch {
      return null;
    }
  }

  function showVote() {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.feedbackVote === vote));
      button.setAttribute('aria-disabled', 'true');
      button.tabIndex = -1;
    }
    status.textContent = 'Thanks for your feedback.';
  }
})();
