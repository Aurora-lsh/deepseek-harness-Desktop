(() => {
  const entries = [...document.querySelectorAll('[data-view]')]

  window.dshDesktopSetState = (active, unread) => {
    for (const entry of entries) {
      const selected = entry.dataset.view === active
      entry.classList.toggle('active', selected)
      if (selected) entry.setAttribute('aria-current', 'page')
      else entry.removeAttribute('aria-current')
    }
    document.querySelector('[data-view="chat"]')?.classList.toggle('has-unread', unread)
  }
})()
