(() => {
  const dropdowns = document.querySelectorAll('.nav-dropdown');

  document.addEventListener('click', event => {
    for (const dropdown of dropdowns) {
      if (dropdown.open && !dropdown.contains(event.target)) dropdown.open = false;
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    for (const dropdown of dropdowns) {
      if (!dropdown.open) continue;
      dropdown.open = false;
      dropdown.querySelector('summary').focus();
    }
  });
})();
