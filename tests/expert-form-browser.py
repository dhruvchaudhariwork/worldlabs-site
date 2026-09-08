"""Browser regressions for expert forms. Run against the local server:
python tests/expert-form-browser.py [http://localhost:3087]
Requires Python Playwright + Chromium. Form POSTs are mocked; other writes are blocked.
"""

import json
import sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3087"


def fill_application(page):
    page.locator("#full_name").fill("Browser Test")
    page.locator("#email").fill("browser-test@example.com")
    page.locator("#shipped_credits").fill("Example Game (2025), systems designer for combat and economy.")
    page.locator("#spec_1").select_option("Combat / game feel")


def block_writes(route):
    if route.request.method not in ("GET", "HEAD", "OPTIONS"):
        route.abort()
    else:
        route.continue_()


with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce", service_workers="block")
    # Register the fallback first: Playwright checks newer mock routes first.
    context.route("**/*", block_writes)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    responses = []
    requests = []
    held_requests = []

    def intercept(route):
        if route.request.method != "POST":
            route.fallback()
            return
        requests.append(route.request.post_data_json)
        response = responses.pop(0) if responses else (500, {"error": "Test service unavailable."})
        if response == "abort":
            route.abort()
        elif response == "hold":
            held_requests.append(route)
        else:
            status, body = response
            route.fulfill(status=status, content_type="application/json", body=json.dumps(body))

    context.route("**/api/apply", intercept)
    context.route("**/api/waitlist", intercept)
    page.goto(BASE + "/apply", wait_until="networkidle")

    # Required fields are caught locally and keyboard focus goes to the first error.
    page.locator("#ap-submit").click()
    expect(page.locator("#full_name")).to_be_focused()
    expect(page.locator("#full_name")).to_have_attribute("aria-invalid", "true")
    assert requests == [], "Invalid form should not consume an API attempt"
    fill_application(page)
    expect(page.locator("#full_name")).not_to_have_attribute("aria-invalid", "true")

    # Clearing a higher rank must clear/disable every dependent rank in one pass.
    page.locator("#spec_2").select_option("Game economy")
    page.locator("#spec_3").select_option("Level design")
    assert page.locator('#spec_2 option[value="Combat / game feel"]').is_disabled()
    page.locator("#spec_1").select_option("")
    for rank in (2, 3):
        expect(page.locator(f"#spec_{rank}")).to_have_value("")
        expect(page.locator(f"#spec_{rank}")).to_be_disabled()
    page.locator("#spec_1").select_option("Game economy")
    expect(page.locator("#spec_2")).to_be_enabled()
    assert page.locator('#spec_2 option[value="Level design"]').is_enabled()
    page.locator("#spec_2").select_option("Level design")
    page.locator("#spec_3").select_option("Combat / game feel")
    page.locator("#spec_2").select_option("")
    expect(page.locator("#spec_3")).to_be_disabled()
    expect(page.locator("#spec_3")).to_have_value("")

    # Optional numbers still validate when present; blank optional fields remain valid.
    page.locator("#hours_per_week").fill("99")
    page.locator("#ap-submit").click()
    expect(page.locator("#hours_per_week")).to_be_focused()
    assert requests == []
    page.locator("#hours_per_week").fill("5.5")
    page.locator("#ap-submit").click()
    expect(page.locator("#error-hours_per_week")).to_have_text("Enter a whole number.")
    expect(page.locator("#hours_per_week")).to_have_value("5.5")
    expect(page.locator("#hours_per_week")).to_be_editable()
    assert requests == []
    page.locator("#hours_per_week").fill("")

    # A malformed 200 is not a confirmed application. Two rapid submissions send once.
    responses.append((200, {}))
    page.evaluate("() => { const f = document.querySelector('#ap-form'); f.requestSubmit(); f.requestSubmit(); }")
    expect(page.locator("#ap-msg")).to_contain_text("could not confirm")
    assert len(requests) == 1
    expect(page.locator("#ap-submit")).to_be_enabled()
    expect(page.locator("#ap-done")).not_to_be_visible()
    expect(page.locator("#shipped_credits")).to_have_value("Example Game (2025), systems designer for combat and economy.")

    # Server field errors have inline text and focus; rate limits remain retryable.
    responses.append("hold")
    page.locator("#ap-submit").click()
    expect(page.locator("#full_name")).not_to_be_editable()
    expect(page.locator("#shipped_credits")).not_to_be_editable()
    for rank in (1, 2, 3):
        expect(page.locator(f"#spec_{rank}")).to_be_disabled()
    # Restoring a cached page must not accidentally unlock pending inputs.
    page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))")
    expect(page.locator("#spec_1")).to_be_disabled()
    held_requests.pop().fulfill(status=400, content_type="application/json", body=json.dumps({"error": "Please fix the highlighted fields.", "fields": {"email": "Use another email for this test."}}))
    expect(page.locator("#email")).to_be_focused()
    expect(page.locator("#full_name")).to_be_editable()
    expect(page.locator("#shipped_credits")).to_be_editable()
    expect(page.locator("#spec_1")).to_be_enabled()
    expect(page.locator("#spec_2")).to_be_enabled()
    expect(page.locator("#spec_3")).to_be_disabled()
    expect(page.locator("#error-email")).to_have_text("Use another email for this test.")
    page.locator("#email").fill("corrected@example.com")
    responses.append((429, {"error": "Too many submissions. Try again in a few minutes."}))
    page.locator("#ap-submit").click()
    expect(page.locator("#ap-msg")).to_contain_text("Too many submissions")
    expect(page.locator("#ap-submit")).to_be_enabled()

    responses.append("abort")
    page.locator("#ap-submit").click()
    expect(page.locator("#ap-msg")).to_contain_text("Check your connection")
    responses.append((200, {"ok": True, "status": "received"}))
    page.locator("#ap-submit").click()
    expect(page.locator("#ap-done")).to_be_visible()
    expect(page.locator("#ap-done")).to_be_focused()
    expect(page.locator("#ap-form")).not_to_be_visible()
    assert requests[-1]["specialties"] == ["Game economy"]
    assert requests[-1]["hours_per_week"] == ""

    page.goto(BASE + "/join", wait_until="networkidle")
    initial_count = len(requests)
    page.locator("#join-email").fill("invalid@example")
    page.locator("#join-btn").click()
    expect(page.locator("#join-email")).to_be_focused()
    expect(page.locator("#join-email-error")).to_have_text("Enter a valid email address.")
    assert len(requests) == initial_count
    page.locator("#join-email").fill("waitlist-test@example.com")
    page.locator("#join-specialty").select_option("Game economy")
    responses.append("hold")
    page.evaluate("() => { const f = document.querySelector('#join-form'); f.requestSubmit(); f.requestSubmit(); }")
    expect(page.locator("#join-email")).not_to_be_editable()
    expect(page.locator("#join-credits")).not_to_be_editable()
    expect(page.locator("#join-specialty")).to_be_disabled()
    held_requests.pop().fulfill(status=500, content_type="application/json", body=json.dumps({"error": "Test service unavailable."}))
    expect(page.locator("#join-msg")).to_have_text("Test service unavailable.")
    assert len(requests) == initial_count + 1
    expect(page.locator("#join-btn")).to_be_enabled()
    expect(page.locator("#join-email")).to_be_editable()
    expect(page.locator("#join-credits")).to_be_editable()
    expect(page.locator("#join-specialty")).to_be_enabled()
    expect(page.locator("#join-email")).to_have_value("waitlist-test@example.com")
    responses.append((200, {}))
    page.locator("#join-btn").click()
    expect(page.locator("#join-msg")).to_contain_text("could not confirm")
    expect(page.locator("#join-success")).not_to_be_visible()
    responses.append((400, {"error": "Check your email.", "fields": {"email": "Use another email for this test."}}))
    page.locator("#join-btn").click()
    expect(page.locator("#join-email")).to_be_focused()
    expect(page.locator("#join-email")).to_be_editable()
    expect(page.locator("#join-email-error")).to_have_text("Use another email for this test.")
    page.locator("#join-email").fill("waitlist-corrected@example.com")
    responses.append((200, {"ok": True}))
    page.locator("#join-btn").click()
    expect(page.locator("#join-success")).to_be_visible()
    expect(page.locator("#join-success")).to_be_focused()
    expect(page.locator("#join-form")).not_to_be_visible()

    # Browser history restores all ranks, including selects initially disabled.
    page.goto(BASE + "/apply", wait_until="networkidle")
    fill_application(page)
    page.locator("#spec_2").select_option("Game economy")
    page.locator("#spec_3").select_option("Level design")
    page.goto(BASE + "/community", wait_until="networkidle")
    page.go_back(wait_until="networkidle")
    expect(page.locator("#full_name")).to_have_value("Browser Test")
    for rank, specialty in enumerate(["Combat / game feel", "Game economy", "Level design"], start=1):
        expect(page.locator(f"#spec_{rank}")).to_have_value(specialty)
        expect(page.locator(f"#spec_{rank}")).to_be_enabled()
    page.go_forward(wait_until="networkidle")
    page.go_back(wait_until="networkidle")
    expect(page.locator("#spec_3")).to_have_value("Level design")

    # Without JavaScript, a clear email fallback replaces the unusable form.
    # This also prevents default GET submission from exposing entered details.
    nojs = browser.new_context(java_script_enabled=False, service_workers="block")
    nojs.route("**/*", block_writes)
    nojs_page = nojs.new_page()
    for path, form_id in (("/apply", "#ap-form"), ("/join", "#join-form")):
        nojs_page.goto(BASE + path, wait_until="networkidle")
        expect(nojs_page.locator(form_id)).not_to_be_visible()
        expect(nojs_page.locator("noscript p")).to_be_visible()
        expect(nojs_page.locator("noscript p")).to_contain_text("Enable JavaScript")
        expect(nojs_page.locator("noscript a")).to_have_attribute("href", "mailto:hello@tryworldlabs.com")
    nojs.close()

    # Controls remain legible and pages stay within the viewport at narrow widths.
    for width in (320, 360, 768):
        page.set_viewport_size({"width": width, "height": 900})
        for path, control in (("/apply", "#full_name"), ("/join", "#join-email")):
            page.goto(BASE + path, wait_until="networkidle")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"Overflow: {path} at {width}"
            assert page.locator(control).evaluate("el => parseFloat(getComputedStyle(el).fontSize)") >= 16

    # Shorten only the request timeout to verify a hanging connection can recover.
    timeout_page = context.new_page()
    pending_routes = []
    timeout_page.add_init_script("const original = window.setTimeout; window.setTimeout = (fn, ms, ...args) => original(fn, ms === 20000 ? 50 : ms, ...args);")
    timeout_page.route("**/api/*", lambda route: pending_routes.append(route))
    for path, button, message in (("/apply", "#ap-submit", "#ap-msg"), ("/join", "#join-btn", "#join-msg")):
        timeout_page.goto(BASE + path, wait_until="networkidle")
        if path == "/apply":
            fill_application(timeout_page)
        else:
            timeout_page.locator("#join-email").fill("timeout@example.com")
        timeout_page.locator(button).click()
        expect(timeout_page.locator(message)).to_contain_text("longer than expected")
        expect(timeout_page.locator(button)).to_be_enabled()
        expect(timeout_page.locator("#full_name" if path == "/apply" else "#join-email")).to_be_editable()
        if path == "/apply":
            expect(timeout_page.locator("#spec_2")).to_be_enabled()
            expect(timeout_page.locator("#spec_3")).to_be_disabled()
        pending_routes.pop().abort()

    assert not errors, errors
    browser.close()
    print("PASS: local validation, specialty ordering, duplicate-submit guards, server errors, malformed successes, offline retry, confirmed successes, request timeouts, back/forward restoration, no-JS fallback, and 320/360/768px layouts. Form POSTs were mocked; all other write requests were blocked.")
