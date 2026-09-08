"""Keyboard/navigation regression checks against the local preview.

Requires Python Playwright + Chromium and an already-running local server:
    python tests/navigation-browser.py --base-url http://localhost:3087

All write requests are blocked. These checks never submit forms or mutate data.
The 640x360 layout also checks reflow at the effective viewport of a 1280x720
browser viewed at 200% zoom.
"""

import argparse

from playwright.sync_api import sync_playwright


PAGES = ("index", "community", "research", "apply", "join")
VIEWPORTS = ((1440, 1000), (390, 844), (320, 568), (640, 360))


def block_writes(route):
    if route.request.method in ("POST", "PUT", "PATCH", "DELETE"):
        route.abort()
    else:
        route.continue_()


def visit(page, base_url, name):
    page.goto(f"{base_url}/{name}.html", wait_until="domcontentloaded")
    page.evaluate("document.fonts.ready")


def check_keyboard(page, name):
    page.wait_for_function("document.documentElement.dataset.siteUi === 'ready'")
    page.evaluate("window.scrollTo({top: 400, behavior: 'instant'})")
    scroll_y = page.evaluate("scrollY")
    button = page.locator("#mk-menu-btn")
    button.focus()
    page.keyboard.press("Enter")
    assert button.get_attribute("aria-expanded") == "true", name
    assert page.locator(".site-menu-shell").get_attribute("role") == "dialog", name
    assert page.evaluate("document.querySelector('#mk-overlay').contains(document.activeElement)"), name
    assert page.evaluate("document.querySelector('main').closest('[inert]') !== null"), name
    assert page.evaluate("getComputedStyle(document.querySelector('#mk-overlay')).transitionDuration === '0s'"), name

    for key in ("Tab", "Shift+Tab"):
        for _ in range(12):
            page.keyboard.press(key)
            assert page.evaluate("document.querySelector('.site-menu-shell').contains(document.activeElement)"), (name, key)

    page.keyboard.press("Escape")
    assert button.get_attribute("aria-expanded") == "false", name
    assert page.evaluate("document.activeElement.id === 'mk-menu-btn'"), name
    assert abs(page.evaluate("scrollY") - scroll_y) < 2, name
    assert page.locator("[inert]").count() == 1, name
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), name
    assert page.evaluate("""() => {
        const left = document.querySelector('.mk-nav-left').getBoundingClientRect();
        const cta = document.querySelector('.mk-cta-btn').getBoundingClientRect();
        return left.right <= cta.left && cta.right <= innerWidth - 8;
    }"""), (name, "header overlap or clipping")

    page.locator(".site-skip-link").focus()
    page.keyboard.press("Enter")
    assert page.evaluate("document.activeElement.matches('main, [role=main]')"), name


def check_history(page, base_url):
    visit(page, base_url, "index")
    trigger = page.locator(".mk-hero-btns a[href='#datasets']")
    trigger.scroll_into_view_if_needed()
    departure_scroll = page.evaluate("scrollY")
    trigger.click()
    assert page.evaluate("location.hash") == "#datasets"
    assert page.evaluate("document.activeElement.id") == "datasets"
    page.wait_for_function("document.querySelector('#datasets').getBoundingClientRect().top < innerHeight - 100")
    destination_scroll = page.evaluate("scrollY")
    assert page.locator("#datasets").bounding_box()["y"] >= 95

    # Regression: pushing history after an instant scroll broke Back restoration.
    page.go_back()
    page.wait_for_function("expected => location.hash === '' && Math.abs(scrollY - expected) < 2", arg=departure_scroll)
    assert page.evaluate("document.activeElement.id") == "main-content"
    page.go_forward()
    page.wait_for_function("expected => location.hash === '#datasets' && Math.abs(scrollY - expected) < 2", arg=destination_scroll)
    assert page.evaluate("document.activeElement.id") == "datasets"

    # Also exercise an empty fragment, which must never reach querySelector('#').
    page.locator(".mk-logo").evaluate("anchor => anchor.setAttribute('href', '#')")
    page.locator(".mk-logo").click()
    page.wait_for_function("location.hash === '' && scrollY === 0")
    assert page.evaluate("document.activeElement.id") == "main-content"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:3087")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for width, height in VIEWPORTS:
            context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
            context.route("**/*", block_writes)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            for name in PAGES:
                visit(page, base_url, name)
                check_keyboard(page, name)
            check_history(page, base_url)
            assert not errors, errors
            context.close()
            print(f"PASS: keyboard, focus, menu, header, reduced motion, history at {width}x{height}")

        context = browser.new_context(java_script_enabled=False)
        context.route("**/*", block_writes)
        page = context.new_page()
        for name in PAGES:
            visit(page, base_url, name)
            assert not page.locator("#mk-menu-btn").is_visible(), name
            assert page.locator(".mk-cta-btn").is_visible(), name
            assert page.locator("main").is_visible(), name
            assert page.locator("footer a[href]").count() > 0, name
        context.close()
        browser.close()
        print("PASS: JavaScript-disabled content and fallback navigation")


if __name__ == "__main__":
    main()
