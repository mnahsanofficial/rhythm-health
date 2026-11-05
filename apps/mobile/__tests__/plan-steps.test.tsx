import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ProposalFlow } from '../src/proposal';
import { profile, proposeResponse } from '../../../frontend/tests/support/fixtures';

const proposal = proposeResponse.proposal!;
const available = { ...proposeResponse, personal_guess_available: true };
let reply: unknown;
beforeEach(() => {
  reply = available;
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => reply } as Response));
});
afterEach(() => jest.restoreAllMocks());

const press = (name: string) => act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
async function toPlan() {
  render(<ProposalFlow token="fake" offline={false} profile={profile} initialQuestion={proposal.question} onExpired={jest.fn()} onStarted={jest.fn()} />);
  await press('Design experiment');
  await screen.findByRole('header', { name: proposal.intervention.change_short! });
}

describe('the plan, one step per screen', () => {
  test('1: the change in one line, the rest behind Details', async () => {
    await toPlan();
    expect(screen.queryByText(proposal.hypothesis)).toBeNull();
    expect(screen.queryByText('We predict')).toBeNull();
    expect(screen.queryByLabelText(/^Your guess for/)).toBeNull();
    await press('Details');
    expect(screen.getByText(proposal.hypothesis)).toBeVisible();
    expect(screen.getByText(`When: ${proposal.intervention.timing}`)).toBeVisible();
    expect(screen.getByText(`How often: ${proposal.intervention.frequency}`)).toBeVisible();
  });

  test('2: your guess, and Back returns to the change', async () => {
    await toPlan(); await press('Next');
    expect(screen.getByLabelText(`Your guess for ${proposal.metrics[0].label}`)).toBeVisible();
    expect(screen.queryByText('We predict')).toBeNull();
    await press('Back');
    expect(screen.getByRole('header', { name: proposal.intervention.change_short! })).toBeVisible();
  });

  test('3: the reveal puts your guess beside the range, with confidence as a caption', async () => {
    await toPlan(); await press('Next');
    fireEvent.changeText(screen.getByLabelText(/^Your guess for/), '10');
    await press('Show prediction');
    expect(screen.getByText('Your guess')).toBeVisible();
    expect(screen.getByText('+10%')).toBeVisible();
    expect(screen.getByText('+8% to +15%')).toBeVisible();
    expect(screen.getByText('Confidence: Moderate')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start this experiment' })).toBeNull();
  });

  test('4: the days, then Start', async () => {
    await toPlan(); await press('Next');
    fireEvent.changeText(screen.getByLabelText(/^Your guess for/), '10');
    await press('Show prediction'); await press('Next');
    expect(screen.getByTestId('plan-days')).toBeVisible();
    expect(screen.getByText("We'll compare your 3 normal days with your 7 test days. Your check-ins decide, not the AI.")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start this experiment' })).toBeVisible();
  });

  test('with no guess available it goes from the change straight to the prediction', async () => {
    reply = { ...proposeResponse, personal_guess_available: false };
    await toPlan(); await press('Next');
    expect(screen.queryByText('Your guess')).toBeNull();
    expect(screen.getByText('+8% to +15%')).toBeVisible();
  });

  test('a review note stays on the first step, as one row', async () => {
    reply = { ...available, classification: { ...available.classification, risk: 'review' }, safety: { ...available.safety, reason: 'Check with someone you trust first.' } };
    await toPlan();
    expect(screen.queryByText('Check with someone you trust first.')).toBeNull();
    await press('A note before you begin');
    expect(screen.getByText('Check with someone you trust first.')).toBeVisible();
  });
});
