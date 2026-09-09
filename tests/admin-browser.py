"""Admin inbox browser regressions. All API requests are mocked; writes are blocked.
Run: python tests/admin-browser.py [http://localhost:3090]
Requires Python Playwright + Chromium and an already-running local preview.
"""
import json
import sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3090'
rows = [dict(id=f'00000000-0000-4000-8000-{i:012}', full_name=f'Applicant {i:03}', email=f'applicant{i}@example.com', status='pending', created_at='2026-09-08T10:00:00Z', specialties=['Game economy'], shipped_credits='Example RPG, economy designer', admin_notes='') for i in range(52)]
signups = [dict(id='waitlist-1', email='waitlist@example.com', specialty='Level design', credits='Example platform game', created_at='2026-09-08T10:00:00Z')]
server = dict(authed=False, fail_save=False, fail_load=False)


def block_writes(route):
    if route.request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        route.abort()
    else:
        route.continue_()


def api(route):
    parsed = urlparse(route.request.url)
    path = parsed.path.rsplit('/', 1)[-1]
    status = 200
    if path == 'session':
        data = dict(authed=server['authed'])
    elif path == 'login':
        if route.request.post_data_json['password'] != 'browser-test-password':
            status, data = 401, dict(error='Incorrect password.')
        else:
            server['authed'] = True
            data = dict(ok=True)
    elif path == 'logout':
        server['authed'] = False
        data = dict(ok=True)
    elif not server['authed']:
        status, data = 401, dict(error='Not authenticated')
    elif path == 'decide':
        if server['fail_save']:
            status, data = 500, dict(error='Could not save the review. Try again.')
        else:
            body = route.request.post_data_json
            row = next(row for row in rows if row['id'] == body['id'])
            row.update(body)
            data = dict(ok=True, application=row)
    elif server['fail_load']:
        status, data = 500, dict(error='Could not load submissions. Please try again.')
    else:
        params = parse_qs(parsed.query)
        page, size = int(params.get('page', ['1'])[0]), int(params.get('limit', ['25'])[0])
        search = params.get('q', [''])[0].lower()
        candidates = rows if path == 'applications' else signups
        if path == 'applications' and params.get('status', ['all'])[0] != 'all':
            candidates = [row for row in candidates if row['status'] == params['status'][0]]
        candidates = [row for row in candidates if search in json.dumps(row).lower()]
        counts = {value:sum(row['status'] == value for row in rows) for value in ['pending', 'reviewing', 'approved', 'rejected']}
        data = dict(ok=True, counts=counts, pagination=dict(page=page, pageSize=size, total=len(candidates), hasMore=page*size < len(candidates)))
        data['applications' if path == 'applications' else 'signups'] = candidates[(page-1)*size:page*size]
    route.fulfill(status=status, content_type='application/json', body=json.dumps(data))


with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport=dict(width=1440, height=1000), reduced_motion='reduce', service_workers='block')
    context.route('**/*', block_writes)
    context.route('**/api/admin/**', api)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/admin', wait_until='networkidle')
    expect(page.locator('#app')).not_to_be_visible()
    page.locator('#pw').fill('wrong-password')
    page.locator('#gate-btn').click()
    expect(page.locator('#gate-err')).to_have_text('Incorrect password.')
    page.locator('#pw').fill('browser-test-password')
    page.locator('#gate-btn').click()
    expect(page.locator('#page-info')).to_have_text('1-25 of 52')
    expect(page.locator('.ad-item')).to_have_count(25)
    page.locator('.ad-item').first.click()
    page.locator('#admin-notes').fill('Ask about crafting economies.')
    page.locator('.ad-item').nth(1).click()
    page.locator('.ad-item').first.click()
    expect(page.locator('#admin-notes')).to_have_value('Ask about crafting economies.')
    page.locator('#refresh').click()
    expect(page.locator('#feedback')).to_contain_text('unsaved notes')
    expect(page.locator('#admin-notes')).to_have_value('Ask about crafting economies.')
    server['fail_save'] = True
    page.locator('[data-act="notes"]').click()
    expect(page.locator('#save-msg')).to_contain_text('Could not save')
    expect(page.locator('#admin-notes')).to_be_enabled()
    expect(page.locator('#admin-notes')).to_have_value('Ask about crafting economies.')
    server['fail_save'] = False
    page.locator('[data-act="notes"]').click()
    expect(page.locator('#feedback')).to_have_text('Notes saved.')
    page.locator('[data-act="reviewing"]').click()
    expect(page.locator('#feedback')).to_have_text('Application marked reviewing.')
    expect(page.locator('#page-info')).to_have_text('1-25 of 51')
    page.locator('[data-status="reviewing"]').click()
    expect(page.locator('.ad-item')).to_have_count(1)
    page.locator('.ad-item').click()
    expect(page.locator('#admin-notes')).to_have_value('Ask about crafting economies.')
    page.locator('[data-status="pending"]').click()
    expect(page.locator('#next')).to_be_enabled()
    page.locator('#next').click()
    expect(page.locator('#page-info')).to_have_text('26-50 of 51')
    page.locator('#next').click()
    expect(page.locator('#page-info')).to_have_text('51-51 of 51')
    page.locator('.ad-item').click()
    page.locator('[data-act="reviewing"]').click()
    expect(page.locator('#page-info')).to_have_text('26-50 of 50')
    expect(page.locator('#feedback')).to_have_text('Application marked reviewing.')
    page.locator('#search').fill('Applicant 050')
    expect(page.locator('.ad-item')).to_have_count(1)
    expect(page.locator('.ad-item')).to_contain_text('Applicant 050')
    expect(page.locator('#page-info')).to_have_text('1-1 of 1')
    page.locator('#search').fill('nothing-matches')
    expect(page.locator('#list')).to_contain_text('No submissions match')
    page.locator('[data-kind="waitlist"]').click()
    expect(page.locator('#tabs')).not_to_be_visible()
    page.locator('.ad-item').click()
    expect(page.locator('#detail')).to_contain_text('Example platform game')
    expect(page.locator('#detail')).to_contain_text('waitlist@example.com')
    assert page.locator('#detail [data-act]').count() == 0
    for width in (320, 390, 768):
        page.set_viewport_size(dict(width=width, height=844))
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    server['fail_load'] = True
    page.locator('#refresh').click()
    expect(page.locator('#feedback')).to_contain_text('Could not load')
    expect(page.locator('#refresh')).to_be_enabled()
    server['fail_load'] = False
    page.locator('#refresh').click()
    expect(page.locator('#feedback')).to_have_text('')
    server['authed'] = False
    page.locator('#refresh').click()
    expect(page.locator('#gate')).to_be_visible()
    expect(page.locator('#gate-err')).to_contain_text('session expired')
    expect(page.locator('.ad-item')).to_have_count(0)
    page.locator('#pw').fill('browser-test-password')
    page.locator('#gate-btn').click()
    expect(page.locator('#app')).to_be_visible()
    page.locator('#logout').click()
    expect(page.locator('#gate-err')).to_have_text('Signed out.')
    assert not errors, errors
    browser.close()
    print('PASS: admin sign-in, private views, pagination, search, application/waitlist switching, notes and failed saves, status changes, refresh recovery, session expiry, logout, and 320/390/768px layouts. All API requests were mocked.')
