"""Homepage browser regressions against an already-running local preview.

Run: python tests/home-browser.py [http://localhost:3087]
Requires separately installed Python Playwright + Chromium.
All write requests are mocked or blocked; no signup data leaves the browser.
"""
import json
import sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3087"


def block_writes(route):
    if route.request.method in ("POST", "PUT", "PATCH", "DELETE"):
        route.abort()
    else:
        route.continue_()


with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    context.route("**/*", block_writes)
    requests, responses, errors, held = [], [], [], []

    def intercept(route):
        requests.append(route.request.post_data_json)
        response = responses.pop(0) if responses else (500, {"error": "Test unavailable"})
        if response == "abort":
            route.abort()
        elif response == "hold":
            held.append(route)
        else:
            status, body = response
            route.fulfill(status=status, content_type="application/json", body=json.dumps(body))

    context.route("**/api/waitlist", intercept)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until="networkidle")

    # Reduced motion keeps the decorative video stopped until explicitly played.
    toggle = page.locator("#video-toggle")
    expect(toggle).to_have_text("Play background")
    assert page.locator("#hero-video").evaluate("el => el.paused")

    email = page.locator("#waitlist-email")
    button = page.locator("#waitlist-btn")
    message = page.locator("#waitlist-msg")
    button.click()
    expect(email).to_be_focused()
    expect(email).to_have_attribute("aria-invalid", "true")
    assert not requests
    email.fill("invalid@example")
    button.click()
    assert not requests
    email.fill("test@example.com")
    expect(email).not_to_have_attribute("aria-invalid", "true")

    # Rapid clicks send once; an empty 200 response must not become success.
    responses.append("hold")
    page.evaluate("() => { const f = document.querySelector('#waitlist-form'); f.requestSubmit(); f.requestSubmit(); }")
    expect(button).to_be_disabled()
    expect(email).not_to_be_editable()
    expect(message).to_contain_text("Saving your email")
    held.pop().fulfill(status=200, content_type="application/json", body="{}")
    expect(message).to_contain_text("could not confirm")
    assert len(requests) == 1
    expect(button).to_be_enabled()
    expect(email).to_be_editable()
    expect(email).to_have_value("test@example.com")
    responses.append((429, {"error": "Rate limited"}))
    button.click()
    expect(message).to_contain_text("Too many attempts")
    responses.append("abort")
    button.click()
    expect(message).to_contain_text("Check your connection")
    expect(email).to_have_value("test@example.com")
    responses.append((200, {"ok": True}))
    button.click()
    expect(button).to_have_text("Joined")
    expect(button).to_be_disabled()
    expect(email).to_have_attribute("readonly", "")
    expect(message).to_contain_text("new projects open")
    assert requests[-1] == {"email": "test@example.com"}

    # Exercise the video lifecycle with the real media element.
    page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
    toggle.click()
    expect(toggle).to_have_text("Pause background", timeout=15000)
    page.locator("#mk-menu-btn").click()
    assert page.locator("#hero-video").evaluate("el => el.paused")
    page.keyboard.press("Escape")
    expect(toggle).to_have_text("Pause background")
    toggle.click()
    expect(toggle).to_have_text("Play background")
    page.locator("#mk-menu-btn").click()
    page.keyboard.press("Escape")
    expect(toggle).to_have_text("Play background")
    assert page.locator("#hero-video").evaluate("el => el.paused")

    # A hanging signup times out, preserves the input, and allows a retry.
    timeout_page = context.new_page()
    pending_routes = []
    timeout_page.add_init_script("const original = window.setTimeout; window.setTimeout = (fn, ms, ...args) => original(fn, ms === 15000 ? 50 : ms, ...args);")
    timeout_page.route("**/api/waitlist", lambda route: pending_routes.append(route))
    timeout_page.goto(BASE, wait_until="networkidle")
    timeout_page.locator("#waitlist-email").fill("timeout@example.com")
    timeout_page.locator("#waitlist-btn").click()
    expect(timeout_page.locator("#waitlist-msg")).to_contain_text("longer than expected")
    expect(timeout_page.locator("#waitlist-btn")).to_be_enabled()
    expect(timeout_page.locator("#waitlist-email")).to_have_value("timeout@example.com")
    pending_routes.pop().abort()
    timeout_page.close()

    # Native form fallback stays private when JavaScript is unavailable.
    nojs = browser.new_context(java_script_enabled=False)
    nojs.route("**/*", block_writes)
    nojs_page = nojs.new_page()
    nojs_page.goto(BASE, wait_until="networkidle")
    expect(nojs_page.locator("#waitlist-form")).not_to_be_visible()
    expect(nojs_page.locator("noscript p")).to_contain_text("JavaScript")
    expect(nojs_page.locator("noscript a")).to_have_attribute("href", "mailto:hello@tryworldlabs.com")
    nojs.close()

    for width in (320, 390, 768, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        page.goto(BASE, wait_until="networkidle")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
        assert email.evaluate("el => parseFloat(getComputedStyle(el).fontSize)") >= 16
        assert page.locator(".ds-card").count() == 4
    assert not errors, errors
    browser.close()
    print("PASS: homepage validation, duplicate prevention, error/retry/success, timeout, video intent and reduced motion, no-JS fallback, and four responsive sizes. No signup data was sent.")
