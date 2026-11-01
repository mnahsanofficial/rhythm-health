"""Active samples use only in-memory repositories; never credentials or AI."""
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase import get_current_user
from app.demo import seed
from app.integrations import openrouter
from app.integrations.supabase import SupabaseConflict, SupabaseUnavailable
from app.main import app
from app.repositories import checkins, experiments, profiles
from app.services import history
from tests.test_demo import FakeDb, ALICE, BOB
from tests.test_history import row, analysis

@pytest.fixture(autouse=True)
def no_external_network(monkeypatch):
    # A missing repository/AI fake must fail before any external request can run.
    import httpx
    monkeypatch.setattr(httpx, 'request', Mock(side_effect=AssertionError('External requests are forbidden')))


client = TestClient(app)
START = '/api/demo/active'


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(profiles, 'get_by_user_id', fake.get_profile)
    monkeypatch.setattr(experiments, 'create', fake.create)
    monkeypatch.setattr(checkins, 'create_many', fake.create_many)
    monkeypatch.setattr(experiments, 'list_for_profile', lambda pid, status=None: [e for e in fake.experiments if e['profile_id'] == pid and (status is None or e['status'] == status)])
    def delete(pid, eid):
        gone = {e['id'] for e in fake.experiments if e['profile_id'] == pid and e['id'] == eid and e['is_seeded']}
        fake.experiments[:] = [e for e in fake.experiments if e['id'] not in gone]
        fake.checkins[:] = [c for c in fake.checkins if c['experiment_id'] not in gone]
    monkeypatch.setattr(experiments, 'delete_sample', delete, raising=False)
    monkeypatch.setattr(experiments, 'get', lambda pid, eid: next((e for e in fake.experiments if e['profile_id'] == pid and e['id'] == eid), None))
    monkeypatch.setattr(openrouter, 'complete', Mock(side_effect=AssertionError('No AI for samples')))
    monkeypatch.setattr(openrouter, 'decide', Mock(side_effect=AssertionError('No AI for samples')))
    app.dependency_overrides[get_current_user] = lambda: fake.current
    yield fake
    app.dependency_overrides.clear()


def test_start_sample_day_five_with_labelled_past_answers_and_no_report(db):
    response = client.post(START, json={})
    assert response.status_code == 201
    sample = response.json()
    assert sample['is_seeded'] and sample['status'] == 'active'
    assert sample['progress']['day_number'] == 5
    assert sample['prediction'] == seed.EXPERIMENT['prediction']
    assert [c['day_number'] for c in db.checkins] == [1, 2, 3]
    assert all(c['note'].startswith('Sample check-in') for c in db.checkins)
    assert not db.reports


def test_active_slot_is_respected_without_deleting_or_modifying_anything(db):
    real = db.add_real(ALICE, 'active')
    response = client.post(START, json={})
    assert response.status_code == 409
    assert 'active experiment' in response.json()['detail']
    assert db.experiments == [real] and not db.checkins


def test_second_start_does_not_reset_existing_sample(db):
    first = client.post(START, json={})
    assert first.status_code == 201
    assert client.post(START, json={}).status_code == 409
    assert len(db.experiments) == 1 and len(db.checkins) == 3


def test_remove_requires_confirmation_and_only_removes_owned_sample(db):
    sample = client.post(START, json={}).json()
    path = f"{START}/{sample['id']}/remove"
    real = db.add_real(ALICE, 'proposed')
    assert client.post(path, json={}).status_code == 422
    assert client.post(path, json={'confirmed': False}).status_code == 422
    db.current = BOB
    assert client.post(path, json={'confirmed': True}).status_code == 404
    db.current = ALICE
    assert client.post(path, json={'confirmed': True}).status_code == 200
    assert db.experiments == [real] and not db.checkins
    assert client.post(START, json={}).status_code == 201  # slot is free


def test_real_experiment_cannot_be_removed_through_sample_route(db):
    real = db.add_real(ALICE, 'active', id='00000000-0000-0000-0000-000000000011')
    assert client.post(f"{START}/{real['id']}/remove", json={'confirmed': True}).status_code == 404
    assert db.experiments == [real]


def test_auth_ownership_extra_fields_and_missing_profile(db, monkeypatch):
    assert client.post(START, json={'profile_id': 'other'}).status_code == 422
    monkeypatch.setattr(profiles, 'get_by_user_id', lambda _: None)
    assert client.post(START, json={}).status_code == 409
    app.dependency_overrides.clear()
    assert client.post(START, json={}).status_code == 401


@pytest.mark.parametrize('failure,status', [(SupabaseConflict(), 409), (SupabaseUnavailable('down'), 503)])
def test_start_races_and_outages(db, failure, status):
    db.fail_on_create = failure
    assert client.post(START, json={}).status_code == status
    assert not db.checkins


def test_checkin_failure_cleans_up_only_the_new_sample(db, monkeypatch):
    real = db.add_real(ALICE, 'proposed')
    monkeypatch.setattr(checkins, 'create_many', Mock(side_effect=SupabaseUnavailable('down')))
    assert client.post(START, json={}).status_code == 503
    assert db.experiments == [real]


def test_completed_samples_never_enter_public_history(db):
    real = db.add_real(ALICE, 'completed', id='00000000-0000-0000-0000-000000000012')
    db.add_real(ALICE, 'completed', is_seeded=True)
    for path in ['/api/experiments', '/api/experiments?status=completed']:
        response = client.get(path)
        assert response.status_code == 200
        assert [e['id'] for e in response.json()] == [real['id']]


def test_sample_context_excluded_even_if_repository_returns_it(monkeypatch):
    real, sample = row(1, is_seeded=False), row(2, is_seeded=True)
    monkeypatch.setattr(experiments, 'list_completed', lambda *_: [sample, real])
    from app.repositories import reports
    read = Mock(return_value=[{'experiment_id': real['id'], 'analysis': analysis()}])
    monkeypatch.setattr(reports, 'list_for_experiments', read)
    context = history.load('fake-profile', 'sleep')
    read.assert_called_once_with([real['id']])
    assert context.track_record.experiments == 1


def test_repository_filters_samples_before_pagination_and_deletes_by_owner_id_marker(monkeypatch):
    rest = Mock(return_value=[])
    monkeypatch.setattr(experiments, 'rest_request', rest)
    experiments.list_completed('owner', 20)
    assert rest.call_args.kwargs['params']['is_seeded'] == 'eq.false'
    experiments.delete_sample('owner', 'sample-id')
    assert rest.call_args.kwargs['params'] == {'profile_id': 'eq.owner', 'id': 'eq.sample-id', 'is_seeded': 'eq.true'}


def test_sample_never_calls_paid_report_writer(db, monkeypatch):
    sample = client.post(START, json={}).json()
    assert 'id' in sample
    writer = Mock(side_effect=AssertionError('Paid report must be blocked'))
    monkeypatch.setattr('app.api.reports.write_narrative', writer)
    # Even a completed sample requested directly must not enter the paid writer.
    db.experiments[0]['status'] = 'completed'
    assert client.post(f"/api/experiments/{sample['id']}/report?regenerate=true").status_code == 409
    writer.assert_not_called()


def test_reset_completed_demo_does_not_delete_active_sample(db, monkeypatch):
    from app.repositories import reports
    # Use FakeDb's cascade so existing completed-demo behaviour is exercised as well.
    monkeypatch.setattr(experiments, 'delete_sample', db.delete_sample)
    monkeypatch.setattr(reports, 'upsert', db.upsert_report)
    monkeypatch.setattr(reports, 'save_narrative', db.save_narrative)
    sample = client.post(START, json={}).json()
    assert client.post('/api/demo/reset', json={}).status_code == 200
    assert any(e['id'] == sample['id'] and e['status'] == 'active' for e in db.experiments)
    assert len([c for c in db.checkins if c['experiment_id'] == sample['id']]) == 3


def test_removing_sample_allows_starting_a_real_proposed_experiment(db, monkeypatch):
    sample = client.post(START, json={}).json()
    real = db.add_real(ALICE, 'proposed', id='00000000-0000-0000-0000-000000000013')
    path = f"/api/experiments/{real['id']}/start"
    assert client.post(path).status_code == 409
    assert client.post(f"{START}/{sample['id']}/remove", json={'confirmed': True}).status_code == 200
    def start(_pid, _eid, started_at):
        real.update(status='active', started_at=started_at)
        return real
    monkeypatch.setattr(experiments, 'start', start)
    response = client.post(path)
    assert response.status_code == 200 and response.json()['is_seeded'] is False


def test_removal_outage_does_not_claim_success(db, monkeypatch):
    sample = client.post(START, json={}).json()
    monkeypatch.setattr(experiments, 'delete_sample', Mock(side_effect=SupabaseUnavailable('down')))
    response = client.post(f"{START}/{sample['id']}/remove", json={'confirmed': True})
    assert response.status_code == 503
    assert db.experiments[0]['id'] == sample['id']
