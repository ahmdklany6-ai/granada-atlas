# 5.27: the site opens on the opening page (js/tour.js). The browser suites written before it start on the map, so
# importing this module makes every Playwright page and context they create set window.__noIntro = true before the
# page's own scripts run (the documented test opt-out; ?nointro does the same). tests/ui_test_v25.py does not import it.
from playwright.sync_api import Browser, BrowserContext
HOOK = 'window.__noIntro = true;'
_nc, _np, _cnp = Browser.new_context, Browser.new_page, BrowserContext.new_page
def _new_context(self, *a, **k):
    c = _nc(self, *a, **k); c.add_init_script(HOOK); return c
def _new_page(self, *a, **k):
    p = _np(self, *a, **k); p.context.add_init_script(HOOK); return p
Browser.new_context, Browser.new_page = _new_context, _new_page
